package follows_test

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/config"
	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/server"
	"github.com/namedai01/memopin/backend/internal/testutil"
)

func TestMain(m *testing.M) { os.Exit(testutil.RunMain(m)) }

func newHandler(t *testing.T) (http.Handler, *pgxpool.Pool) {
	t.Helper()
	pool := testutil.NewPool(t)
	h := server.NewRouter(server.Deps{
		Pool:     pool,
		Verifier: auth.Fake{},
		Cfg:      config.Config{AuthMode: "fake", DefaultUserPhotoURL: "https://example.test/default.png"},
	})
	return h, pool
}

func getUser(t *testing.T, h http.Handler, as, id string) map[string]any {
	t.Helper()
	w := testutil.Do(t, h, "GET", "/v1/users/"+id, as, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET user %s: status = %d, body = %s", id, w.Code, w.Body)
	}
	var m map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func countFollows(t *testing.T, pool *pgxpool.Pool) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM follows").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestFollow_Idempotent(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	testutil.SeedUser(t, pool, "u2", "Binh")

	for i := range 2 {
		w := testutil.Do(t, h, "PUT", "/v1/users/u2/follow", "u1", nil)
		if w.Code != http.StatusNoContent || w.Body.Len() != 0 {
			t.Fatalf("put #%d: status = %d, body = %q", i+1, w.Code, w.Body)
		}
	}
	got := getUser(t, h, "u1", "u2")
	if got["followerCount"] != float64(1) || got["isFollowing"] != true {
		t.Fatalf("after follow: %v", got)
	}
}

func TestUnfollow_Idempotent(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	testutil.SeedUser(t, pool, "u2", "Binh")
	testutil.Do(t, h, "PUT", "/v1/users/u2/follow", "u1", nil)

	for i := range 2 {
		w := testutil.Do(t, h, "DELETE", "/v1/users/u2/follow", "u1", nil)
		if w.Code != http.StatusNoContent || w.Body.Len() != 0 {
			t.Fatalf("delete #%d: status = %d, body = %q", i+1, w.Code, w.Body)
		}
	}
	got := getUser(t, h, "u1", "u2")
	if got["followerCount"] != float64(0) || got["isFollowing"] != false {
		t.Fatalf("after unfollow: %v", got)
	}
}

func TestUnfollow_NeverFollowedIs204(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u2", "Binh")
	// Caller has no users row at all; unfollow must still be a clean no-op.
	if w := testutil.Do(t, h, "DELETE", "/v1/users/u2/follow", "ghost", nil); w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
}

func TestFollow_Self(t *testing.T) {
	h, pool := newHandler(t)
	for _, method := range []string{"PUT", "DELETE"} {
		w := testutil.Do(t, h, method, "/v1/users/u1/follow", "u1", nil)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("%s self: status = %d, body = %s", method, w.Code, w.Body)
		}
	}
	// Rejected before any write: not even the caller's users row is created.
	var n int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM users").Scan(&n); err != nil || n != 0 {
		t.Fatalf("users rows = %d, err = %v", n, err)
	}
}

func TestFollow_UnknownUser(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	w := testutil.Do(t, h, "PUT", "/v1/users/nobody/follow", "u1", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	if n := countFollows(t, pool); n != 0 {
		t.Fatalf("follows rows = %d", n)
	}
}

func TestUnfollow_UnknownUser(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	if w := testutil.Do(t, h, "DELETE", "/v1/users/nobody/follow", "u1", nil); w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
}

func TestFollow_CreatesCallerRow(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u2", "Binh")
	// u1 never called /v1/me; follow must not hit the FK.
	w := testutil.DoToken(t, h, "PUT", "/v1/users/u2/follow", "fake:u1:+84900000001", nil)
	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	var name string
	if err := pool.QueryRow(t.Context(), "SELECT display_name FROM users WHERE id = 'u1'").Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "user +84900000001" {
		t.Fatalf("display_name = %q", name)
	}
	if n := countFollows(t, pool); n != 1 {
		t.Fatalf("follows rows = %d", n)
	}
}

func TestFollow_RequiresAuth(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u2", "Binh")
	for _, method := range []string{"PUT", "DELETE"} {
		if w := testutil.Do(t, h, method, "/v1/users/u2/follow", "", nil); w.Code != http.StatusUnauthorized {
			t.Fatalf("%s: status = %d", method, w.Code)
		}
	}
}

func TestIsFollowing(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	testutil.SeedUser(t, pool, "u2", "Binh")
	q := store.New(pool)

	got, err := q.IsFollowing(t.Context(), store.IsFollowingParams{FollowerID: "u1", TargetID: "u2"})
	if err != nil || got {
		t.Fatalf("before follow: got = %v, err = %v", got, err)
	}
	testutil.Do(t, h, "PUT", "/v1/users/u2/follow", "u1", nil)
	got, err = q.IsFollowing(t.Context(), store.IsFollowingParams{FollowerID: "u1", TargetID: "u2"})
	if err != nil || !got {
		t.Fatalf("after follow: got = %v, err = %v", got, err)
	}
	// Direction matters.
	got, err = q.IsFollowing(t.Context(), store.IsFollowingParams{FollowerID: "u2", TargetID: "u1"})
	if err != nil || got {
		t.Fatalf("reverse: got = %v, err = %v", got, err)
	}
}
