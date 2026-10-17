package stories_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/config"
	"github.com/namedai01/memopin/backend/internal/server"
	"github.com/namedai01/memopin/backend/internal/testutil"
)

const bucket = "test-bucket"

func TestMain(m *testing.M) { os.Exit(testutil.RunMain(m)) }

// fakeNotifier reports every StoryCreated call on a channel.
type fakeNotifier struct{ calls chan uuid.UUID }

func (f *fakeNotifier) StoryCreated(_ context.Context, id uuid.UUID) { f.calls <- id }

func newHandler(t *testing.T) (http.Handler, *pgxpool.Pool, *fakeNotifier) {
	t.Helper()
	pool := testutil.NewPool(t)
	n := &fakeNotifier{calls: make(chan uuid.UUID, 10)}
	h := server.NewRouter(server.Deps{
		Pool:     pool,
		Verifier: auth.Fake{},
		Notifier: n,
		Cfg: config.Config{
			AuthMode:            "fake",
			StorageBucket:       bucket,
			DefaultUserPhotoURL: "https://example.test/default.png",
		},
	})
	return h, pool, n
}

func imageURL(uid string) string {
	return "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/uploads%2F" + uid + "%2Fa.jpg?alt=media"
}

func storyBody(uid string, lat, lng float64) map[string]any {
	return map[string]any{
		"title": "Sunset", "type": "photo", "description": "nice",
		"imageUrl": imageURL(uid), "lat": lat, "lng": lng,
	}
}

func countStories(t *testing.T, pool *pgxpool.Pool) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM stories").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestCreateStory_PicksNearestLocation(t *testing.T) {
	h, pool, _ := newHandler(t)
	testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)
	danang := testutil.SeedLocation(t, pool, "Da Nang", 16.05, 108.20)

	w := testutil.DoToken(t, h, "POST", "/v1/stories", "fake:u1:+84900000001", storyBody("u1", 16.06, 108.21))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	var got struct {
		ID, Title, Type, Description, ImageURL string
		CreatedAt                              time.Time
		Location                               struct{ ID, VenueName string }
		Owner                                  struct{ ID, DisplayName, PhotoURL string }
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Location.ID != danang.String() || got.Location.VenueName != "Da Nang" {
		t.Errorf("location = %+v, want Da Nang %s", got.Location, danang)
	}
	if got.Owner.ID != "u1" || got.Owner.DisplayName != "user u1" || got.Owner.PhotoURL != "https://example.test/default.png" {
		t.Errorf("owner = %+v (caller row should be created on the fly)", got.Owner)
	}
	if _, err := uuid.Parse(got.ID); err != nil || got.Title != "Sunset" || got.Type != "photo" ||
		got.Description != "nice" || got.ImageURL != imageURL("u1") || got.CreatedAt.IsZero() {
		t.Errorf("story = %+v", got)
	}
}

func TestCreateStory_NoLocations(t *testing.T) {
	h, pool, n := newHandler(t)
	w := testutil.Do(t, h, "POST", "/v1/stories", "u1", storyBody("u1", 16.06, 108.21))
	if w.Code != http.StatusUnprocessableEntity || !strings.Contains(w.Body.String(), `"unprocessable"`) {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	if c := countStories(t, pool); c != 0 {
		t.Fatalf("stories = %d, want 0", c)
	}
	var users int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM users").Scan(&users); err != nil || users != 0 {
		t.Fatalf("users = %d (err %v), want 0: a 422 must write nothing", users, err)
	}
	select {
	case id := <-n.calls:
		t.Fatalf("notifier called for rejected story %s", id)
	default:
	}
}

func TestCreateStory_Validation(t *testing.T) {
	h, pool, n := newHandler(t)
	testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)

	with := func(k string, v any) map[string]any {
		b := storyBody("u1", 21, 105)
		if v == nil {
			delete(b, k)
		} else {
			b[k] = v
		}
		return b
	}
	cases := map[string]map[string]any{
		"foreign image":      with("imageUrl", imageURL("u2")),
		"missing image":      with("imageUrl", nil),
		"missing title":      with("title", nil),
		"blank title":        with("title", "   "),
		"long title":         with("title", strings.Repeat("a", 101)),
		"long type":          with("type", strings.Repeat("a", 51)),
		"long description":   with("description", strings.Repeat("a", 2001)),
		"lat too big":        with("lat", 91),
		"lat too small":      with("lat", -91),
		"lng too big":        with("lng", 181),
		"missing lat":        with("lat", nil),
		"missing lng":        with("lng", nil),
		"unknown body field": with("extra", 1),
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			w := testutil.Do(t, h, "POST", "/v1/stories", "u1", body)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, body = %s", w.Code, w.Body)
			}
		})
	}
	if c := countStories(t, pool); c != 0 {
		t.Fatalf("stories = %d, want 0", c)
	}
	var users int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM users").Scan(&users); err != nil || users != 0 {
		t.Fatalf("users = %d (err %v), want 0: validation must precede any write", users, err)
	}
	select {
	case id := <-n.calls:
		t.Fatalf("notifier called for rejected story %s", id)
	default:
	}
}

func TestCreateStory_RequiresAuth(t *testing.T) {
	h, _, _ := newHandler(t)
	w := testutil.Do(t, h, "POST", "/v1/stories", "", storyBody("u1", 1, 1))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestCreateStory_NotifiesOnce(t *testing.T) {
	h, pool, n := newHandler(t)
	testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)

	w := testutil.Do(t, h, "POST", "/v1/stories", "u1", storyBody("u1", 21, 105))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	var got struct{ ID string }
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	select {
	case id := <-n.calls:
		if id.String() != got.ID {
			t.Fatalf("notified %s, want %s", id, got.ID)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("notifier not called")
	}
	select {
	case id := <-n.calls:
		t.Fatalf("notifier called twice (second: %s)", id)
	case <-time.After(100 * time.Millisecond):
	}
}

// panickingNotifier panics on every call and signals that it was reached.
type panickingNotifier struct{ called chan struct{} }

func (p panickingNotifier) StoryCreated(context.Context, uuid.UUID) {
	p.called <- struct{}{}
	panic("boom")
}

// syncBuffer is a bytes.Buffer safe for the notify goroutine and the test.
type syncBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuffer) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.Write(p)
}

func (s *syncBuffer) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.String()
}

func TestCreateStory_NotifierPanicIsContained(t *testing.T) {
	pool := testutil.NewPool(t)
	n := panickingNotifier{called: make(chan struct{}, 1)}
	h := server.NewRouter(server.Deps{
		Pool: pool, Verifier: auth.Fake{}, Notifier: n,
		Cfg: config.Config{AuthMode: "fake", StorageBucket: bucket},
	})
	testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)

	logs := &syncBuffer{}
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(logs, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })

	w := testutil.Do(t, h, "POST", "/v1/stories", "u1", storyBody("u1", 21, 105))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	select {
	case <-n.called:
	case <-time.After(5 * time.Second):
		t.Fatal("notifier not called")
	}
	deadline := time.Now().Add(5 * time.Second)
	for !strings.Contains(logs.String(), "notify panic") {
		if time.Now().After(deadline) {
			t.Fatalf("panic not logged; logs: %s", logs.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
}

type page struct {
	Items []struct {
		ID    string
		Owner struct{ ID string }
	}
	NextCursor *string
}

func getPage(t *testing.T, h http.Handler, as, path string) page {
	t.Helper()
	w := testutil.Do(t, h, "GET", path, as, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET %s: status = %d, body = %s", path, w.Code, w.Body)
	}
	var p page
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestLocationStories_NewestFirstWithCursor(t *testing.T) {
	h, pool, _ := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	loc := testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)
	other := testutil.SeedLocation(t, pool, "Hue", 16.46, 107.59)
	base := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	oldest := testutil.SeedStory(t, pool, "u1", loc, base)
	tieA := testutil.SeedStory(t, pool, "u1", loc, base.Add(time.Hour))
	tieB := testutil.SeedStory(t, pool, "u1", loc, base.Add(time.Hour))
	testutil.SeedStory(t, pool, "u1", other, base.Add(2*time.Hour)) // other location: never listed

	path := "/v1/locations/" + loc.String() + "/stories"
	var seen []string
	p := getPage(t, h, "", path+"?limit=1") // public: no token
	for pages := 0; ; pages++ {
		if pages > 5 {
			t.Fatal("cursor never ends")
		}
		if len(p.Items) != 1 {
			t.Fatalf("page %d has %d items, want 1", pages, len(p.Items))
		}
		seen = append(seen, p.Items[0].ID)
		if p.NextCursor == nil {
			break
		}
		p = getPage(t, h, "", path+"?limit=1&cursor="+*p.NextCursor)
	}
	if len(seen) != 3 {
		t.Fatalf("seen %v, want 3 stories", seen)
	}
	if seen[2] != oldest.String() {
		t.Errorf("last = %s, want oldest %s", seen[2], oldest)
	}
	got := map[string]int{}
	for _, id := range seen {
		got[id]++
	}
	if got[tieA.String()] != 1 || got[tieB.String()] != 1 {
		t.Errorf("identical created_at stories must each appear once: %v", seen)
	}

	// limit=2 -> 2 items + cursor; next page -> 1 item and a null cursor.
	p1 := getPage(t, h, "", path+"?limit=2")
	if len(p1.Items) != 2 || p1.NextCursor == nil {
		t.Fatalf("page 1 = %+v", p1)
	}
	p2 := getPage(t, h, "", path+"?limit=2&cursor="+*p1.NextCursor)
	if len(p2.Items) != 1 || p2.NextCursor != nil {
		t.Fatalf("page 2 = %+v", p2)
	}
	// Exactly-full last page has no cursor.
	if p := getPage(t, h, "", path+"?limit=3"); len(p.Items) != 3 || p.NextCursor != nil {
		t.Fatalf("full page = %+v", p)
	}
}

func TestLocationStories_EmptyAndErrors(t *testing.T) {
	h, pool, _ := newHandler(t)
	loc := testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)

	w := testutil.Do(t, h, "GET", "/v1/locations/"+loc.String()+"/stories", "", nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"items":[]`) || !strings.Contains(w.Body.String(), `"nextCursor":null`) {
		t.Fatalf("empty: status = %d, body = %s", w.Code, w.Body)
	}
	for path, want := range map[string]int{
		"/v1/locations/not-a-uuid/stories":                          http.StatusNotFound,
		"/v1/locations/" + uuid.NewString() + "/stories":            http.StatusNotFound,
		"/v1/locations/" + loc.String() + "/stories?cursor=garbage": http.StatusBadRequest,
		"/v1/locations/" + loc.String() + "/stories?limit=abc":      http.StatusBadRequest,
	} {
		if w := testutil.Do(t, h, "GET", path, "", nil); w.Code != want {
			t.Errorf("GET %s = %d, want %d (body %s)", path, w.Code, want, w.Body)
		}
	}
}

func TestUserStories_FollowGate(t *testing.T) {
	h, pool, _ := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	testutil.SeedUser(t, pool, "u2", "Binh")
	loc := testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)
	testutil.SeedStory(t, pool, "u2", loc, time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC))

	w := testutil.Do(t, h, "GET", "/v1/users/u2/stories", "u1", nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("non-follower: status = %d, body = %s", w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), "items") || strings.Contains(w.Body.String(), "story") {
		t.Fatalf("403 leaked story data: %s", w.Body)
	}

	if w := testutil.Do(t, h, "PUT", "/v1/users/u2/follow", "u1", nil); w.Code != http.StatusNoContent {
		t.Fatalf("follow: %d", w.Code)
	}
	if p := getPage(t, h, "u1", "/v1/users/u2/stories"); len(p.Items) != 1 || p.Items[0].Owner.ID != "u2" {
		t.Fatalf("follower page = %+v", p)
	}
	if p := getPage(t, h, "u2", "/v1/users/u2/stories"); len(p.Items) != 1 {
		t.Fatalf("self page = %+v", p)
	}
}

func TestUserStories_UnknownUserAndAuth(t *testing.T) {
	h, pool, _ := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	if w := testutil.Do(t, h, "GET", "/v1/users/nobody/stories", "u1", nil); w.Code != http.StatusNotFound {
		t.Errorf("unknown user = %d, want 404", w.Code)
	}
	if w := testutil.Do(t, h, "GET", "/v1/users/u1/stories", "", nil); w.Code != http.StatusUnauthorized {
		t.Errorf("anonymous = %d, want 401", w.Code)
	}
	if w := testutil.Do(t, h, "GET", "/v1/users/u1/stories?cursor=garbage", "u1", nil); w.Code != http.StatusBadRequest {
		t.Errorf("garbage cursor = %d, want 400", w.Code)
	}
}
