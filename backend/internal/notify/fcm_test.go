package notify

import (
	"context"
	"errors"
	"fmt"
	"os"
	"slices"
	"sync"
	"testing"
	"time"

	"firebase.google.com/go/v4/messaging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/testutil"
)

func TestMain(m *testing.M) { os.Exit(testutil.RunMain(m)) }

var errUnregistered = errors.New("registration-token-not-registered")

// fakeSender records every multicast and answers with a canned response.
type fakeSender struct {
	mu    sync.Mutex
	calls []*messaging.MulticastMessage
	// respond builds the response for a call; nil means every send succeeds.
	respond func(call int, msg *messaging.MulticastMessage) (*messaging.BatchResponse, error)
}

func (f *fakeSender) SendEachForMulticast(_ context.Context, msg *messaging.MulticastMessage) (*messaging.BatchResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, msg)
	if f.respond != nil {
		return f.respond(len(f.calls)-1, msg)
	}
	return success(len(msg.Tokens)), nil
}

func success(n int) *messaging.BatchResponse {
	resp := &messaging.BatchResponse{SuccessCount: n}
	for range n {
		resp.Responses = append(resp.Responses, &messaging.SendResponse{Success: true})
	}
	return resp
}

func newFCM(t *testing.T, s Sender) (*FCM, *pgxpool.Pool) {
	t.Helper()
	pool := testutil.NewPool(t)
	f := NewFCM(store.New(pool), s, nil)
	f.isUnregistered = func(err error) bool { return errors.Is(err, errUnregistered) }
	return f, pool
}

func seedDevice(t *testing.T, pool *pgxpool.Pool, uid, token string) {
	t.Helper()
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO devices (token, user_id, platform) VALUES ($1, $2, 'android')", token, uid); err != nil {
		t.Fatalf("seed device %q: %v", token, err)
	}
}

func seedFollow(t *testing.T, pool *pgxpool.Pool, follower, target string) {
	t.Helper()
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO follows (follower_id, target_id) VALUES ($1, $2)", follower, target); err != nil {
		t.Fatalf("seed follow: %v", err)
	}
}

func deviceTokens(t *testing.T, pool *pgxpool.Pool) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), "SELECT token FROM devices ORDER BY token")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		out = append(out, s)
	}
	return out
}

func TestFCM_SendsToFollowersOnly(t *testing.T) {
	s := &fakeSender{}
	f, pool := newFCM(t, s)
	for _, u := range [][2]string{{"u1", "An"}, {"u2", "Binh"}, {"u3", "Chi"}, {"u4", "Dung"}} {
		testutil.SeedUser(t, pool, u[0], u[1])
	}
	loc := testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)
	story := testutil.SeedStory(t, pool, "u2", loc, mustTime())
	seedFollow(t, pool, "u1", "u2")
	seedFollow(t, pool, "u3", "u2")
	seedFollow(t, pool, "u2", "u4") // u2 follows u4: not a recipient of u2's story
	seedDevice(t, pool, "u1", "t1")
	seedDevice(t, pool, "u3", "t3")
	seedDevice(t, pool, "u4", "t4") // not a follower of u2
	seedDevice(t, pool, "u2", "t2") // the poster's own device

	f.StoryCreated(t.Context(), story)

	if len(s.calls) != 1 {
		t.Fatalf("sender calls = %d, want 1", len(s.calls))
	}
	msg := s.calls[0]
	got := slices.Clone(msg.Tokens)
	slices.Sort(got)
	if !slices.Equal(got, []string{"t1", "t3"}) {
		t.Errorf("tokens = %v, want [t1 t3]", got)
	}
	if msg.Notification == nil || msg.Notification.Title != "Memopin" || msg.Notification.Body != "Binh has just posted a new story." {
		t.Errorf("notification = %+v", msg.Notification)
	}
	want := map[string]string{"type": "new_story", "storyId": story.String(), "locationId": loc.String()}
	if fmt.Sprint(msg.Data) != fmt.Sprint(want) {
		t.Errorf("data = %v, want %v", msg.Data, want)
	}
}

func TestFCM_NoFollowerTokensNoSend(t *testing.T) {
	s := &fakeSender{}
	f, pool := newFCM(t, s)
	testutil.SeedUser(t, pool, "u2", "Binh")
	loc := testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)
	story := testutil.SeedStory(t, pool, "u2", loc, mustTime())

	f.StoryCreated(t.Context(), story)
	f.StoryCreated(t.Context(), uuid.New()) // unknown story: logged, nothing sent

	if len(s.calls) != 0 {
		t.Fatalf("sender calls = %d, want 0", len(s.calls))
	}
}

func TestFCM_PrunesUnregisteredTokens(t *testing.T) {
	s := &fakeSender{respond: func(_ int, msg *messaging.MulticastMessage) (*messaging.BatchResponse, error) {
		resp := &messaging.BatchResponse{}
		for _, tok := range msg.Tokens {
			switch tok {
			case "t1":
				resp.FailureCount++
				resp.Responses = append(resp.Responses, &messaging.SendResponse{Error: errUnregistered})
			case "t2":
				resp.FailureCount++
				resp.Responses = append(resp.Responses, &messaging.SendResponse{Error: errors.New("quota exceeded")})
			default:
				resp.SuccessCount++
				resp.Responses = append(resp.Responses, &messaging.SendResponse{Success: true})
			}
		}
		return resp, nil
	}}
	f, pool := newFCM(t, s)
	for _, u := range [][2]string{{"u1", "An"}, {"u2", "Binh"}, {"u3", "Chi"}, {"u4", "Dung"}} {
		testutil.SeedUser(t, pool, u[0], u[1])
	}
	loc := testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)
	story := testutil.SeedStory(t, pool, "u4", loc, mustTime())
	for _, u := range []string{"u1", "u2", "u3"} {
		seedFollow(t, pool, u, "u4")
	}
	seedDevice(t, pool, "u1", "t1")
	seedDevice(t, pool, "u2", "t2")
	seedDevice(t, pool, "u3", "t3")

	f.StoryCreated(t.Context(), story)

	// t1 is gone; t2 failed for another reason and t3 succeeded: both stay.
	if got := deviceTokens(t, pool); !slices.Equal(got, []string{"t2", "t3"}) {
		t.Fatalf("devices left = %v, want [t2 t3]", got)
	}
}

func TestFCM_ChunksOver500(t *testing.T) {
	s := &fakeSender{}
	f, pool := newFCM(t, s)
	testutil.SeedUser(t, pool, "poster", "Binh")
	loc := testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)
	story := testutil.SeedStory(t, pool, "poster", loc, mustTime())
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO users (id, display_name) SELECT 'f' || g, 'F' || g FROM generate_series(1, 501) g"); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO follows (follower_id, target_id) SELECT id, 'poster' FROM users WHERE id LIKE 'f%'"); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO devices (token, user_id, platform) SELECT 'tok' || id, id, 'web' FROM users WHERE id LIKE 'f%'"); err != nil {
		t.Fatal(err)
	}

	f.StoryCreated(t.Context(), story)

	if len(s.calls) != 2 {
		t.Fatalf("sender calls = %d, want 2", len(s.calls))
	}
	if a, b := len(s.calls[0].Tokens), len(s.calls[1].Tokens); a != 500 || b != 1 {
		t.Errorf("chunk sizes = %d, %d; want 500, 1", a, b)
	}
}

func TestFCM_WholeCallErrorStillSendsRemainingChunks(t *testing.T) {
	s := &fakeSender{respond: func(call int, msg *messaging.MulticastMessage) (*messaging.BatchResponse, error) {
		if call == 0 {
			return nil, errors.New("fcm down")
		}
		return success(len(msg.Tokens)), nil
	}}
	f, pool := newFCM(t, s)
	testutil.SeedUser(t, pool, "poster", "Binh")
	loc := testutil.SeedLocation(t, pool, "Hanoi", 21.03, 105.85)
	story := testutil.SeedStory(t, pool, "poster", loc, mustTime())
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO users (id, display_name) SELECT 'f' || g, 'F' || g FROM generate_series(1, 501) g"); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO follows (follower_id, target_id) SELECT id, 'poster' FROM users WHERE id LIKE 'f%'"); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO devices (token, user_id, platform) SELECT 'tok' || id, id, 'web' FROM users WHERE id LIKE 'f%'"); err != nil {
		t.Fatal(err)
	}

	f.StoryCreated(t.Context(), story)

	if len(s.calls) != 2 {
		t.Fatalf("sender calls = %d, want 2 (second chunk must still be attempted)", len(s.calls))
	}
	if got := len(deviceTokens(t, pool)); got != 501 {
		t.Errorf("devices = %d, want 501: a failed call must not prune tokens", got)
	}
}

func TestShort(t *testing.T) {
	for in, want := range map[string]string{"": "", "abc": "abc", "12345678": "12345678", "123456789": "12345678…"} {
		if got := short(in); got != want {
			t.Errorf("short(%q) = %q, want %q", in, got, want)
		}
	}
}

func mustTime() time.Time { return time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC) }
