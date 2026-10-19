package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/config"
	"github.com/namedai01/memopin/backend/internal/server"
)

// panicVerifier panics when a required route asks it to verify a token.
type panicVerifier struct{}

func (panicVerifier) Verify(context.Context, string) (auth.Identity, error) { panic("boom") }

// routerNoDB serves routes that never touch the database.
func routerNoDB(v auth.Verifier) http.Handler {
	return server.NewRouter(server.Deps{Cfg: config.Config{AuthMode: "fake"}, Verifier: v})
}

type errBody struct {
	Error struct{ Code, Message string }
}

func assertEnvelope(t *testing.T, w *httptest.ResponseRecorder, status int, code, message string) {
	t.Helper()
	if w.Code != status {
		t.Fatalf("status = %d, want %d (body %s)", w.Code, status, w.Body)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Fatalf("Content-Type = %q", ct)
	}
	var b errBody
	if err := json.Unmarshal(w.Body.Bytes(), &b); err != nil {
		t.Fatalf("body is not JSON: %v: %s", err, w.Body)
	}
	if b.Error.Code != code || (message != "" && b.Error.Message != message) {
		t.Fatalf("error = %+v, want code %q message %q", b.Error, code, message)
	}
}

func captureLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })
	return &buf
}

func TestRouter_NotFoundUsesEnvelope(t *testing.T) {
	w := httptest.NewRecorder()
	routerNoDB(auth.Fake{}).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/nope", nil))
	assertEnvelope(t, w, http.StatusNotFound, "not_found", "")
}

func TestRouter_MethodNotAllowedUsesEnvelope(t *testing.T) {
	w := httptest.NewRecorder()
	routerNoDB(auth.Fake{}).ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/healthz", nil))
	assertEnvelope(t, w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
}

func TestRouter_PanicUsesEnvelopeAndIsLogged(t *testing.T) {
	logs := captureLogs(t)
	r := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	r.Header.Set("Authorization", "Bearer anything")
	r.Header.Set("X-Request-Id", "req-42")
	w := httptest.NewRecorder()
	routerNoDB(panicVerifier{}).ServeHTTP(w, r)

	assertEnvelope(t, w, http.StatusInternalServerError, "internal", "internal server error")
	if strings.Contains(w.Body.String(), "boom") {
		t.Fatalf("panic value leaked: %s", w.Body)
	}
	got := logs.String()
	if !strings.Contains(got, "boom") || !strings.Contains(got, "request_id=req-42") {
		t.Fatalf("panic not logged with request id: %s", got)
	}
	if !strings.Contains(got, "status=500") {
		t.Fatalf("request line should record 500: %s", got)
	}
}

func TestRequestLog_UsesRoutePatternNotPath(t *testing.T) {
	logs := captureLogs(t)
	h := routerNoDB(auth.Fake{})

	// 401 (no Authorization), but the route still matches.
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodDelete, "/v1/me/devices/FCM-SECRET-TOKEN", nil))
	got := logs.String()
	if strings.Contains(got, "FCM-SECRET-TOKEN") {
		t.Fatalf("token leaked into logs: %s", got)
	}
	if !strings.Contains(got, `route=/v1/me/devices/{token}`) {
		t.Fatalf("route pattern not logged: %s", got)
	}

	logs.Reset()
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/nope/SECRET", nil))
	got = logs.String()
	if strings.Contains(got, "SECRET") || !strings.Contains(got, "route=unmatched") {
		t.Fatalf("unmatched request logged wrongly: %s", got)
	}
}
