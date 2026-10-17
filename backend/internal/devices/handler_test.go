package devices_test

import (
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/config"
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

// owner returns the user owning token, or "" when the row does not exist.
func owner(t *testing.T, pool *pgxpool.Pool, token string) string {
	t.Helper()
	var uid string
	rows, err := pool.Query(t.Context(), "SELECT user_id FROM devices WHERE token = $1", token)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	if rows.Next() {
		if err := rows.Scan(&uid); err != nil {
			t.Fatal(err)
		}
	}
	return uid
}

func TestRegisterDevice_Upsert(t *testing.T) {
	h, pool := newHandler(t)
	body := map[string]string{"token": "t1", "platform": "android"}

	// u1 never called /v1/me: the user row is created on the fly.
	if w := testutil.Do(t, h, "POST", "/v1/me/devices", "u1", body); w.Code != http.StatusNoContent {
		t.Fatalf("u1 register: status = %d, body = %s", w.Code, w.Body)
	}
	if got := owner(t, pool, "t1"); got != "u1" {
		t.Fatalf("owner = %q, want u1", got)
	}

	// Same token again as u2 (shared device, new login): ownership moves.
	var before, after string
	if err := pool.QueryRow(t.Context(), "SELECT updated_at::text FROM devices WHERE token = 't1'").Scan(&before); err != nil {
		t.Fatal(err)
	}
	if w := testutil.Do(t, h, "POST", "/v1/me/devices", "u2", map[string]string{"token": "t1", "platform": "ios"}); w.Code != http.StatusNoContent {
		t.Fatalf("u2 register: status = %d, body = %s", w.Code, w.Body)
	}
	if got := owner(t, pool, "t1"); got != "u2" {
		t.Fatalf("owner = %q, want u2", got)
	}
	var platform string
	if err := pool.QueryRow(t.Context(), "SELECT platform, updated_at::text FROM devices WHERE token = 't1'").Scan(&platform, &after); err != nil {
		t.Fatal(err)
	}
	if platform != "ios" || after == before {
		t.Errorf("platform = %q, updated_at %s -> %s: want ios and a refreshed timestamp", platform, before, after)
	}
	var n int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM devices").Scan(&n); err != nil || n != 1 {
		t.Fatalf("devices = %d (err %v), want 1", n, err)
	}
}

func TestRegisterDevice_Validation(t *testing.T) {
	h, pool := newHandler(t)
	cases := map[string]any{
		"bad platform":  map[string]string{"token": "t1", "platform": "pc"},
		"no platform":   map[string]string{"token": "t1"},
		"empty token":   map[string]string{"token": "", "platform": "web"},
		"missing token": map[string]string{"platform": "web"},
		"long token":    map[string]string{"token": strings.Repeat("a", 4097), "platform": "web"},
		"unknown field": map[string]string{"token": "t1", "platform": "web", "extra": "x"},
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			w := testutil.Do(t, h, "POST", "/v1/me/devices", "u1", body)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, body = %s", w.Code, w.Body)
			}
		})
	}
	// The longest allowed token is accepted.
	if w := testutil.Do(t, h, "POST", "/v1/me/devices", "u1", map[string]string{"token": strings.Repeat("a", 4096), "platform": "web"}); w.Code != http.StatusNoContent {
		t.Errorf("4096-char token: status = %d, body = %s", w.Code, w.Body)
	}
	if w := testutil.Do(t, h, "POST", "/v1/me/devices", "", map[string]string{"token": "t", "platform": "web"}); w.Code != http.StatusUnauthorized {
		t.Errorf("anonymous: status = %d, want 401", w.Code)
	}
	var users int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM users WHERE id <> 'u1'").Scan(&users); err != nil || users != 0 {
		t.Fatalf("unexpected users: %d (err %v)", users, err)
	}
}

func TestDeleteDevice_OnlyOwn(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	testutil.SeedUser(t, pool, "u2", "Binh")
	if w := testutil.Do(t, h, "POST", "/v1/me/devices", "u1", map[string]string{"token": "t1", "platform": "android"}); w.Code != http.StatusNoContent {
		t.Fatalf("register: %d", w.Code)
	}

	if w := testutil.Do(t, h, "DELETE", "/v1/me/devices/t1", "u2", nil); w.Code != http.StatusNoContent {
		t.Fatalf("foreign delete: status = %d, want 204", w.Code)
	}
	if got := owner(t, pool, "t1"); got != "u1" {
		t.Fatalf("row owner = %q after foreign delete, want u1 (row must remain)", got)
	}

	if w := testutil.Do(t, h, "DELETE", "/v1/me/devices/t1", "u1", nil); w.Code != http.StatusNoContent {
		t.Fatalf("own delete: status = %d", w.Code)
	}
	if got := owner(t, pool, "t1"); got != "" {
		t.Fatalf("row owner = %q after own delete, want gone", got)
	}
	// Deleting again, or an unknown token, is still 204.
	if w := testutil.Do(t, h, "DELETE", "/v1/me/devices/t1", "u1", nil); w.Code != http.StatusNoContent {
		t.Fatalf("repeat delete: status = %d", w.Code)
	}
	if w := testutil.Do(t, h, "DELETE", "/v1/me/devices/t1", "", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous delete: status = %d, want 401", w.Code)
	}
}
