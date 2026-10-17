package auth_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
