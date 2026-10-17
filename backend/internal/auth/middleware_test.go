package auth_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/testutil"
)

// probe records whether it ran and the identity it saw.
type probe struct {
	called bool
	id     auth.Identity
	ok     bool
}

func (p *probe) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.called = true
	p.id, p.ok = auth.FromContext(r.Context())
	w.WriteHeader(http.StatusNoContent)
}

func TestRequired_NoHeader(t *testing.T) {
	p := &probe{}
	w := testutil.DoToken(t, auth.Required(auth.Fake{})(p), "GET", "/", "", nil)
	if w.Code != http.StatusUnauthorized || p.called {
		t.Fatalf("status = %d, handler called = %v", w.Code, p.called)
	}
	if body := w.Body.String(); !strings.Contains(body, `"code":"unauthorized"`) {
		t.Fatalf("body = %s", body)
	}
}

func TestRequired_BadToken(t *testing.T) {
	for _, token := range []string{"garbage", "fake::", "fake:", "expired"} {
		p := &probe{}
		w := testutil.DoToken(t, auth.Required(auth.Fake{})(p), "GET", "/", token, nil)
		if w.Code != http.StatusUnauthorized || p.called {
			t.Fatalf("token %q: status = %d, handler called = %v", token, w.Code, p.called)
		}
	}
}

func TestRequired_NonBearerScheme(t *testing.T) {
	p := &probe{}
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Basic fake:u1:")
	w := httptest.NewRecorder()
	auth.Required(auth.Fake{})(p).ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized || p.called {
		t.Fatalf("status = %d, handler called = %v", w.Code, p.called)
	}
}

func TestRequired_ValidToken(t *testing.T) {
	p := &probe{}
	w := testutil.DoToken(t, auth.Required(auth.Fake{})(p), "GET", "/", "fake:u1:+84900000001", nil)
	if w.Code != http.StatusNoContent || !p.called || !p.ok {
		t.Fatalf("status = %d, called = %v, ok = %v", w.Code, p.called, p.ok)
	}
	if p.id != (auth.Identity{UID: "u1", Phone: "+84900000001"}) {
		t.Fatalf("identity = %+v", p.id)
	}
}

func TestOptional_NoHeader(t *testing.T) {
	p := &probe{}
	w := testutil.DoToken(t, auth.Optional(auth.Fake{})(p), "GET", "/", "", nil)
	if w.Code != http.StatusNoContent || !p.called {
		t.Fatalf("status = %d, handler called = %v", w.Code, p.called)
	}
	if p.ok {
		t.Fatalf("identity present without a token: %+v", p.id)
	}
}

func TestOptional_BadTokenStill401(t *testing.T) {
	p := &probe{}
	w := testutil.DoToken(t, auth.Optional(auth.Fake{})(p), "GET", "/", "garbage", nil)
	if w.Code != http.StatusUnauthorized || p.called {
		t.Fatalf("status = %d, handler called = %v", w.Code, p.called)
	}
}

func TestOptional_ValidToken(t *testing.T) {
	p := &probe{}
	w := testutil.DoToken(t, auth.Optional(auth.Fake{})(p), "GET", "/", "fake:u1:", nil)
	if w.Code != http.StatusNoContent || !p.ok || p.id.UID != "u1" {
		t.Fatalf("status = %d, ok = %v, id = %+v", w.Code, p.ok, p.id)
	}
}

// stubVerifier returns a fixed error.
type stubVerifier struct{ err error }

func (s stubVerifier) Verify(context.Context, string) (auth.Identity, error) {
	return auth.Identity{}, s.err
}

const unavailableBody = `{"error":{"code":"internal","message":"authentication temporarily unavailable"}}`

func TestVerifierOutage_503(t *testing.T) {
	outage := errors.New("fetch public keys: connection refused")
	for name, mw := range map[string]func(auth.Verifier) func(http.Handler) http.Handler{
		"required": auth.Required,
		"optional": auth.Optional,
	} {
		t.Run(name, func(t *testing.T) {
			p := &probe{}
			w := testutil.DoToken(t, mw(stubVerifier{outage})(p), "GET", "/", "any-token", nil)
			if w.Code != http.StatusServiceUnavailable || p.called {
				t.Fatalf("status = %d, handler called = %v", w.Code, p.called)
			}
			if got := strings.TrimSpace(w.Body.String()); got != unavailableBody {
				t.Fatalf("body = %s", got)
			}
			if strings.Contains(w.Body.String(), "connection refused") {
				t.Fatalf("verifier error leaked: %s", w.Body)
			}
		})
	}
}

func TestInvalidToken_401(t *testing.T) {
	// Wrapped sentinel, as the Firebase verifier returns it.
	v := stubVerifier{fmt.Errorf("%w: %w", auth.ErrInvalidToken, errors.New("token expired"))}
	p := &probe{}
	w := testutil.DoToken(t, auth.Required(v)(p), "GET", "/", "any-token", nil)
	if w.Code != http.StatusUnauthorized || p.called {
		t.Fatalf("status = %d, handler called = %v", w.Code, p.called)
	}
}

func TestFake_RejectionsAreInvalidToken(t *testing.T) {
	for _, token := range []string{"garbage", "fake::", "fake:", "fake:u1", "other:u1:"} {
		if _, err := (auth.Fake{}).Verify(context.Background(), token); !errors.Is(err, auth.ErrInvalidToken) {
			t.Fatalf("token %q: err = %v, want ErrInvalidToken", token, err)
		}
	}
}

func TestVerifyFailure_LoggedAtWarnWithRequestID(t *testing.T) {
	var buf bytes.Buffer
	old := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(old) })

	h := chimw.RequestID(auth.Required(auth.Fake{})(&probe{}))
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer garbage")
	req.Header.Set("X-Request-Id", "req-123")
	h.ServeHTTP(httptest.NewRecorder(), req)

	log := buf.String()
	for _, want := range []string{"level=WARN", "request_id=req-123", "invalid_token=true"} {
		if !strings.Contains(log, want) {
			t.Fatalf("log %q missing %q", log, want)
		}
	}
	if strings.Contains(log, "garbage") {
		t.Fatalf("log must not contain the token: %s", log)
	}
}
