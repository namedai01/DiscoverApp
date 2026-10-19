package testutil

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Do sends a request to h as the fake-auth user uid (token "fake:<uid>:", no
// phone). An empty uid sends no Authorization header. A non-nil body is sent
// as JSON.
func Do(t *testing.T, h http.Handler, method, path, uid string, body any) *httptest.ResponseRecorder {
	t.Helper()
	token := ""
	if uid != "" {
		token = "fake:" + uid + ":"
	}
	return DoToken(t, h, method, path, token, body)
}

// DoToken is like Do but sends token verbatim as the bearer token, for tests
// that need a phone ("fake:<uid>:<phone>") or a malformed token. An empty
// token sends no Authorization header.
func DoToken(t *testing.T, h http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode request body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}
