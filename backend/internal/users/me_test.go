package users_test

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/config"
	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/server"
	"github.com/namedai01/memopin/backend/internal/testutil"
	"github.com/namedai01/memopin/backend/internal/users"
)

const (
	defaultPhoto = "https://example.test/default.png"
	bucket       = "memopin-test.firebasestorage.app"
	storageBase  = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/"
)

func TestMain(m *testing.M) { os.Exit(testutil.RunMain(m)) }

func newHandler(t *testing.T) (http.Handler, *pgxpool.Pool) {
	t.Helper()
	pool := testutil.NewPool(t)
	h := server.NewRouter(server.Deps{
		Pool:     pool,
		Verifier: auth.Fake{},
		Cfg: config.Config{
			AuthMode:            "fake",
			StorageBucket:       bucket,
			DefaultUserPhotoURL: defaultPhoto,
		},
	})
	return h, pool
}

func decodeUser(t *testing.T, body []byte) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		t.Fatalf("decode %s: %v", body, err)
	}
	return m
}

func countUsers(t *testing.T, pool *pgxpool.Pool) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM users").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestGetMe_RequiresAuth(t *testing.T) {
	h, _ := newHandler(t)
	if w := testutil.Do(t, h, "GET", "/v1/me", "", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", w.Code)
	}
	if w := testutil.DoToken(t, h, "GET", "/v1/me", "garbage", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestGetMe_CreatesOnFirstCall(t *testing.T) {
	h, pool := newHandler(t)

	w := testutil.DoToken(t, h, "GET", "/v1/me", "fake:u1:+84900000001", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	got := decodeUser(t, w.Body.Bytes())
	if got["id"] != "u1" || got["displayName"] != "user u1" || got["photoUrl"] != defaultPhoto {
		t.Fatalf("profile = %v", got)
	}
	if got["followerCount"] != float64(0) {
		t.Fatalf("followerCount = %v", got["followerCount"])
	}
	if _, present := got["isFollowing"]; present {
		t.Fatalf("isFollowing must be omitted on /me: %v", got)
	}

	// A rename survives later GET /v1/me calls and no duplicate row appears.
	if w := testutil.Do(t, h, "PATCH", "/v1/me", "u1", map[string]string{"displayName": "An"}); w.Code != http.StatusOK {
		t.Fatalf("patch status = %d, body = %s", w.Code, w.Body)
	}
	w = testutil.DoToken(t, h, "GET", "/v1/me", "fake:u1:+84900000001", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("second get status = %d", w.Code)
	}
	if name := decodeUser(t, w.Body.Bytes())["displayName"]; name != "An" {
		t.Fatalf("displayName after patch = %v, want An", name)
	}
	if n := countUsers(t, pool); n != 1 {
		t.Fatalf("users rows = %d, want 1", n)
	}
}

func TestGetMe_DefaultNameHasNoPhone(t *testing.T) {
	h, _ := newHandler(t)
	w := testutil.DoToken(t, h, "GET", "/v1/me", "fake:abcdefgh123:+84900000001", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), "84900000001") {
		t.Fatalf("phone leaked in body: %s", w.Body)
	}
	if name := decodeUser(t, w.Body.Bytes())["displayName"]; name != "user abcdef" {
		t.Fatalf("displayName = %v, want user abcdef", name)
	}

	w = testutil.Do(t, h, "GET", "/v1/me", "u1", nil)
	if name := decodeUser(t, w.Body.Bytes())["displayName"]; name != "user u1" {
		t.Fatalf("short uid displayName = %v, want user u1", name)
	}
}

func TestGetMe_FollowerCount(t *testing.T) {
	h, pool := newHandler(t)
	testutil.Do(t, h, "GET", "/v1/me", "u1", nil)
	testutil.Do(t, h, "GET", "/v1/me", "u2", nil)
	if _, err := pool.Exec(t.Context(), "INSERT INTO follows (follower_id, target_id) VALUES ('u2', 'u1')"); err != nil {
		t.Fatal(err)
	}
	w := testutil.Do(t, h, "GET", "/v1/me", "u1", nil)
	if n := decodeUser(t, w.Body.Bytes())["followerCount"]; n != float64(1) {
		t.Fatalf("followerCount = %v, want 1", n)
	}
}

func TestPatchMe_DisplayName(t *testing.T) {
	h, _ := newHandler(t)

	w := testutil.Do(t, h, "PATCH", "/v1/me", "u1", map[string]string{"displayName": "  An  "})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	if name := decodeUser(t, w.Body.Bytes())["displayName"]; name != "An" {
		t.Fatalf("displayName = %v, want trimmed An", name)
	}

	for name, dn := range map[string]string{
		"blank":    "   ",
		"empty":    "",
		"51 chars": strings.Repeat("a", 51),
		"51 runes": strings.Repeat("é", 51),
	} {
		t.Run(name, func(t *testing.T) {
			w := testutil.Do(t, h, "PATCH", "/v1/me", "u1", map[string]string{"displayName": dn})
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, body = %s", w.Code, w.Body)
			}
		})
	}

	// 50 runes (more than 50 bytes) is fine.
	if w := testutil.Do(t, h, "PATCH", "/v1/me", "u1", map[string]string{"displayName": strings.Repeat("é", 50)}); w.Code != http.StatusOK {
		t.Fatalf("50 runes: status = %d, body = %s", w.Code, w.Body)
	}
}

func TestPatchMe_CreatesUserIfMissing(t *testing.T) {
	h, pool := newHandler(t)
	w := testutil.Do(t, h, "PATCH", "/v1/me", "fresh", map[string]string{"displayName": "New"})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	if n := countUsers(t, pool); n != 1 {
		t.Fatalf("users rows = %d, want 1", n)
	}
}

func TestPatchMe_RejectsUnknownFields(t *testing.T) {
	h, _ := newHandler(t)
	// The caller identity only ever comes from the token.
	w := testutil.Do(t, h, "PATCH", "/v1/me", "u1", map[string]string{"id": "u2", "displayName": "X"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
}

func TestPatchMe_PhotoURLMustBeOwnFolder(t *testing.T) {
	h, _ := newHandler(t)

	other := storageBase + "uploads%2Fu2%2Fa.jpg?alt=media&token=t"
	if w := testutil.Do(t, h, "PATCH", "/v1/me", "u1", map[string]string{"photoUrl": other}); w.Code != http.StatusBadRequest {
		t.Fatalf("other user's folder: status = %d, body = %s", w.Code, w.Body)
	}

	own := storageBase + "uploads%2Fu1%2Fa.jpg?alt=media&token=t"
	w := testutil.Do(t, h, "PATCH", "/v1/me", "u1", map[string]string{"photoUrl": own})
	if w.Code != http.StatusOK {
		t.Fatalf("own folder: status = %d, body = %s", w.Code, w.Body)
	}
	if got := decodeUser(t, w.Body.Bytes())["photoUrl"]; got != own {
		t.Fatalf("photoUrl = %v, want %v", got, own)
	}

	// Updating only the name leaves the photo alone.
	w = testutil.Do(t, h, "PATCH", "/v1/me", "u1", map[string]string{"displayName": "Bo"})
	if got := decodeUser(t, w.Body.Bytes())["photoUrl"]; got != own {
		t.Fatalf("photoUrl after name-only patch = %v, want %v", got, own)
	}
}

func TestEnsure_Idempotent(t *testing.T) {
	_, pool := newHandler(t)
	q := store.New(pool)
	id := auth.Identity{UID: "u1", Phone: "+84900000001"}
	a, err := users.Ensure(t.Context(), q, id, defaultPhoto)
	if err != nil {
		t.Fatal(err)
	}
	xmin := func() string {
		var x string
		if err := pool.QueryRow(t.Context(), "SELECT xmin::text FROM users WHERE id = 'u1'").Scan(&x); err != nil {
			t.Fatal(err)
		}
		return x
	}
	before := xmin()
	b, err := users.Ensure(t.Context(), q, id, defaultPhoto)
	if err != nil {
		t.Fatal(err)
	}
	if a.ID != b.ID || a.DisplayName != b.DisplayName || countUsers(t, pool) != 1 {
		t.Fatalf("a = %+v, b = %+v", a, b)
	}
	if after := xmin(); after != before {
		t.Fatalf("second Ensure rewrote the row (xmin %s -> %s)", before, after)
	}
}

func TestValidImageURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want bool
	}{
		{"own folder", storageBase + "uploads%2Fu1%2Fa.jpg?alt=media", true},
		{"other folder", storageBase + "uploads%2Fu2%2Fa.jpg?alt=media", false},
		{"uid prefix of another uid", storageBase + "uploads%2Fu10%2Fa.jpg", false},
		{"folder only, no object", storageBase + "uploads%2Fu1%2F", false},
		{"other bucket", "https://firebasestorage.googleapis.com/v0/b/evil/o/uploads%2Fu1%2Fa.jpg", false},
		{"http scheme", "http://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/uploads%2Fu1%2Fa.jpg", false},
		{"other host", "https://example.test/v0/b/" + bucket + "/o/uploads%2Fu1%2Fa.jpg", false},
		{"empty", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := users.ValidImageURL(bucket, "u1", tt.url); got != tt.want {
				t.Fatalf("ValidImageURL = %v, want %v", got, tt.want)
			}
		})
	}
	if users.ValidImageURL("", "u1", "https://firebasestorage.googleapis.com/v0/b//o/uploads%2Fu1%2Fa.jpg") {
		t.Fatal("empty bucket must never validate")
	}
	if users.ValidImageURL(bucket, "", storageBase+"uploads%2F%2Fa.jpg") {
		t.Fatal("empty uid must never validate")
	}
}

func TestPatchMe_DisplayNameStoredAsNFC(t *testing.T) {
	h, pool := newHandler(t)
	nfd := "Ho\u0302\u0300 Nam" // decomposed "H\u1ed3 Nam"
	w := testutil.Do(t, h, "PATCH", "/v1/me", "u1", map[string]string{"displayName": nfd})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	var stored string
	if err := pool.QueryRow(t.Context(), "SELECT display_name FROM users WHERE id = 'u1'").Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != "H\u1ed3 Nam" {
		t.Fatalf("stored display name = %q, want NFC %q", stored, "H\u1ed3 Nam")
	}
}
