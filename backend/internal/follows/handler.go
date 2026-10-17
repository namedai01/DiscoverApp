// Package follows serves following and unfollowing users.
package follows

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/httpx"
	"github.com/namedai01/memopin/backend/internal/users"
)

// Handler serves /v1/users/{id}/follow. DefaultPhotoURL seeds the photo of a
// caller whose user row is created on the fly.
type Handler struct {
	Q               *store.Queries
	DefaultPhotoURL string
}

// target validates the caller and the {id} path parameter: it rejects
// following yourself (400) and unknown users (404).
func (h *Handler) target(w http.ResponseWriter, r *http.Request) (caller auth.Identity, target string, ok bool) {
	caller, authed := auth.FromContext(r.Context())
	if !authed {
		httpx.Error(w, httpx.Unauthorized("missing identity"))
		return caller, "", false
	}
	target = chi.URLParam(r, "id")
	if target == caller.UID {
		httpx.Error(w, httpx.BadRequest("you cannot follow yourself"))
		return caller, "", false
	}
	exists, err := h.Q.UserExists(r.Context(), target)
	if err != nil {
		httpx.Error(w, err)
		return caller, "", false
	}
	if !exists {
		httpx.Error(w, httpx.NotFound("user not found"))
		return caller, "", false
	}
	return caller, target, true
}

// Follow makes the caller follow {id}. Following twice is a no-op; both
// answer 204.
func (h *Handler) Follow(w http.ResponseWriter, r *http.Request) {
	caller, target, ok := h.target(w, r)
	if !ok {
		return
	}
	if _, err := users.Ensure(r.Context(), h.Q, caller, h.DefaultPhotoURL); err != nil {
		httpx.Error(w, err)
		return
	}
	if err := h.Q.Follow(r.Context(), store.FollowParams{FollowerID: caller.UID, TargetID: target}); err != nil {
		httpx.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Unfollow removes the caller's follow of {id}. Unfollowing someone you do not
// follow is a no-op; both answer 204.
func (h *Handler) Unfollow(w http.ResponseWriter, r *http.Request) {
	caller, target, ok := h.target(w, r)
	if !ok {
		return
	}
	if err := h.Q.Unfollow(r.Context(), store.UnfollowParams{FollowerID: caller.UID, TargetID: target}); err != nil {
		httpx.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
