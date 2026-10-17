package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func req(target string) *http.Request {
	return httptest.NewRequest(http.MethodGet, target, nil)
}

func TestPage_Clamp(t *testing.T) {
	tests := []struct {
		target        string
		limit, offset int
		wantStatus    int // 0 = no error
	}{
		{"/x", 20, 0, 0},
		{"/x?limit=500", 100, 0, 0},
		{"/x?limit=0", 1, 0, 0},
		{"/x?limit=-3", 1, 0, 0},
		{"/x?limit=50&offset=7", 50, 7, 0},
		{"/x?limit=abc", 0, 0, http.StatusBadRequest},
		{"/x?offset=abc", 0, 0, http.StatusBadRequest},
		{"/x?offset=-1", 0, 0, http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.target, func(t *testing.T) {
			limit, offset, err := Page(req(tt.target))
			if tt.wantStatus != 0 {
				var apiErr *APIError
				if !errors.As(err, &apiErr) || apiErr.Status != tt.wantStatus {
					t.Fatalf("err = %v, want APIError status %d", err, tt.wantStatus)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if limit != tt.limit || offset != tt.offset {
				t.Fatalf("got limit=%d offset=%d, want %d %d", limit, offset, tt.limit, tt.offset)
			}
		})
	}
}

func TestError_APIErrorBody(t *testing.T) {
	w := httptest.NewRecorder()
	Error(w, NotFound("no such thing"))
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); strings.TrimSpace(got) != `{"error":{"code":"not_found","message":"no such thing"}}` {
		t.Fatalf("body = %s", got)
	}
}

func TestError_UnknownErrorHidden(t *testing.T) {
	w := httptest.NewRecorder()
	Error(w, errors.New("secret db detail"))
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", w.Code)
	}
	if strings.Contains(w.Body.String(), "secret") {
		t.Fatalf("internal error leaked: %s", w.Body.String())
	}
	var body struct{ Error struct{ Code string } }
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || body.Error.Code != "internal" {
		t.Fatalf("body = %s", w.Body.String())
	}
}

func TestDecode(t *testing.T) {
	type in struct {
		Name string `json:"name"`
	}
	post := func(body string) *http.Request {
		return httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	}

	var v in
	if err := Decode(post(`{"name":"a"}`), &v); err != nil || v.Name != "a" {
		t.Fatalf("valid body: %v %+v", err, v)
	}
	for name, body := range map[string]string{
		"unknown field": `{"name":"a","uid":"evil"}`,
		"malformed":     `{`,
		"trailing data": `{"name":"a"} {"name":"b"}`,
		"too large":     `{"name":"` + strings.Repeat("a", 1<<20) + `"}`,
	} {
		t.Run(name, func(t *testing.T) {
			err := Decode(post(body), &in{})
			var apiErr *APIError
			if !errors.As(err, &apiErr) || apiErr.Status != http.StatusBadRequest {
				t.Fatalf("err = %v, want 400 APIError", err)
			}
		})
	}
}

func TestLikePrefix(t *testing.T) {
	tests := map[string]string{
		"hồ":   "hồ%",
		"HỒ":   "hồ%",
		"100%": `100\%%`,
		"a_b":  `a\_b%`,
		`a\b`:  `a\\b%`,
		"":     "%",
	}
	for in, want := range tests {
		if got := LikePrefix(in); got != want {
			t.Errorf("LikePrefix(%q) = %q, want %q", in, got, want)
		}
	}
}
