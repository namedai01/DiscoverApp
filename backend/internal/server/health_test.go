package server_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/config"
	"github.com/namedai01/memopin/backend/internal/server"
	"github.com/namedai01/memopin/backend/internal/testutil"
)

func TestMain(m *testing.M) { os.Exit(testutil.RunMain(m)) }

func get(t *testing.T, pool *pgxpool.Pool, path string) *httptest.ResponseRecorder {
	t.Helper()
	h := server.NewRouter(server.Deps{Pool: pool, Cfg: config.Config{}})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w
}

func TestHealthz_DBUp(t *testing.T) {
	w := get(t, testutil.NewPool(t), "/healthz")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	if got := strings.TrimSpace(w.Body.String()); got != `{"status":"ok"}` {
		t.Fatalf("body = %s", got)
	}
}

func TestHealthz_DBDown(t *testing.T) {
	// A separate pool on the same database, closed: Ping must fail.
	closed, err := pgxpool.New(context.Background(), testutil.NewPool(t).Config().ConnString())
	if err != nil {
		t.Fatal(err)
	}
	closed.Close()

	w := get(t, closed, "/healthz")
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	if got := strings.TrimSpace(w.Body.String()); got != `{"status":"db_unavailable"}` {
		t.Fatalf("body = %s", got)
	}
}
