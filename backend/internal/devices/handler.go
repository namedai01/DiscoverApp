// Package devices keeps the registry of push-notification device tokens.
package devices

import (
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/httpx"
	"github.com/namedai01/memopin/backend/internal/users"
)

const maxTokenLen = 4096

// Handler serves /v1/me/devices. DefaultPhotoURL seeds the photo of a caller
// whose user row is created on the fly.
type Handler struct {
	Q               *store.Queries
	DefaultPhotoURL string
}

type registerRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

// Register stores the caller's device token. A token already registered to
// someone else (shared device, new login) moves to the caller.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	caller, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, httpx.Unauthorized("missing identity"))
		return
	}
	var req registerRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, err)
		return
	}
	switch {
	case req.Token == "" || len(req.Token) > maxTokenLen:
		httpx.Error(w, httpx.BadRequest("token must be 1 to 4096 characters"))
		return
	case req.Platform != "android" && req.Platform != "ios" && req.Platform != "web":
		httpx.Error(w, httpx.BadRequest("platform must be android, ios or web"))
		return
	}

	if _, err := users.Ensure(r.Context(), h.Q, caller, h.DefaultPhotoURL); err != nil {
		httpx.Error(w, err)
		return
	}
	if err := h.Q.UpsertDevice(r.Context(), store.UpsertDeviceParams{
		Token: req.Token, UserID: caller.UID, Platform: req.Platform,
	}); err != nil {
		httpx.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Unregister removes the caller's own row for {token}; someone else's token
// or an unknown one is left alone. Both answer 204.
func (h *Handler) Unregister(w http.ResponseWriter, r *http.Request) {
	caller, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, httpx.Unauthorized("missing identity"))
		return
	}
	// chi hands back the raw path segment when the request carries a RawPath
	// (clients percent-encode the ":" in FCM tokens), so decode it here.
	token, err := url.PathUnescape(chi.URLParam(r, "token"))
	if err != nil || token == "" {
		httpx.Error(w, httpx.BadRequest("invalid token in path"))
		return
	}
	if err := h.Q.DeleteDevice(r.Context(), store.DeleteDeviceParams{
		Token: token, UserID: caller.UID,
	}); err != nil {
		httpx.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
