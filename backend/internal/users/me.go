// Package users serves the caller's own profile and user lookups.
package users

import (
	"context"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/httpx"
)

const (
	maxDisplayNameRunes = 50
	defaultNameUIDChars = 6
)

// Handler serves /v1/me. DefaultPhotoURL seeds the photo of new users.
type Handler struct {
	Q               *store.Queries
	Bucket          string
	DefaultPhotoURL string
}

// UserJSON is the public shape of a user. IsFollowing is omitted when nil.
type UserJSON struct {
	ID            string `json:"id"`
	DisplayName   string `json:"displayName"`
	PhotoURL      string `json:"photoUrl"`
	FollowerCount int64  `json:"followerCount"`
	IsFollowing   *bool  `json:"isFollowing,omitempty"`
}

// Ensure returns the caller's user row, creating it on first sight with the
// display name "user <first 6 chars of uid>" and the default photo. The phone
// is stored but never put in the name, since names are shown publicly. An
// existing row is returned untouched (never rewritten), so renames survive. Handlers that write
// rows referencing the caller call it first.
func Ensure(ctx context.Context, q *store.Queries, id auth.Identity, defaultPhoto string) (store.User, error) {
	err := q.InsertUserIfAbsent(ctx, store.InsertUserIfAbsentParams{
		ID:          id.UID,
		DisplayName: "user " + id.UID[:min(len(id.UID), defaultNameUIDChars)],
		PhotoUrl:    nonEmpty(defaultPhoto),
		Phone:       nonEmpty(id.Phone),
	})
	if err != nil {
		return store.User{}, err
	}
	return q.GetUser(ctx, id.UID)
}

// GetMe returns the caller's profile, creating it on first call.
func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	id, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, r, httpx.Unauthorized("missing identity"))
		return
	}
	if _, err := Ensure(r.Context(), h.Q, id, h.DefaultPhotoURL); err != nil {
		httpx.Error(w, r, err)
		return
	}
	h.writeMe(w, r, id)
}

type patchMeRequest struct {
	DisplayName *string `json:"displayName"`
	PhotoURL    *string `json:"photoUrl"`
}

// PatchMe updates the caller's display name and/or photo.
func (h *Handler) PatchMe(w http.ResponseWriter, r *http.Request) {
	id, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, r, httpx.Unauthorized("missing identity"))
		return
	}
	var req patchMeRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if req.DisplayName != nil {
		name := strings.TrimSpace(*req.DisplayName)
		if n := utf8.RuneCountInString(name); n < 1 || n > maxDisplayNameRunes {
			httpx.Error(w, r, httpx.BadRequest("displayName must be 1 to 50 characters"))
			return
		}
		req.DisplayName = &name
	}
	if req.PhotoURL != nil && !ValidImageURL(h.Bucket, id.UID, *req.PhotoURL) {
		httpx.Error(w, r, httpx.BadRequest("photoUrl must be an upload in your own storage folder"))
		return
	}

	if _, err := Ensure(r.Context(), h.Q, id, h.DefaultPhotoURL); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if _, err := h.Q.UpdateUser(r.Context(), store.UpdateUserParams{
		ID:          id.UID,
		DisplayName: req.DisplayName,
		PhotoUrl:    req.PhotoURL,
	}); err != nil {
		httpx.Error(w, r, err)
		return
	}
	h.writeMe(w, r, id)
}

// writeMe renders the caller's profile; the user row must already exist.
func (h *Handler) writeMe(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	row, err := h.Q.GetUserWithStats(r.Context(), store.GetUserWithStatsParams{ID: id.UID, ViewerID: id.UID})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, UserJSON{
		ID:            row.ID,
		DisplayName:   row.DisplayName,
		PhotoURL:      PhotoOrDefault(row.PhotoUrl, h.DefaultPhotoURL),
		FollowerCount: row.FollowerCount,
	})
}

// ValidImageURL reports whether url is an object in uid's own upload folder of
// the given Firebase Storage bucket:
// https://firebasestorage.googleapis.com/v0/b/<bucket>/o/uploads%2F<uid>%2F<object>...
func ValidImageURL(bucket, uid, url string) bool {
	if bucket == "" || uid == "" {
		return false
	}
	prefix := "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/uploads%2F" + uid + "%2F"
	rest, found := strings.CutPrefix(url, prefix)
	return found && rest != "" && !strings.HasPrefix(rest, "?")
}

func nonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// PhotoOrDefault is the stored photo URL, or defaultPhoto when none is stored
// (NULL or empty). Defaults are applied at render time, so changing
// DEFAULT_USER_PHOTO_URL also updates users who never set a photo.
func PhotoOrDefault(stored *string, defaultPhoto string) string {
	if stored == nil || *stored == "" {
		return defaultPhoto
	}
	return *stored
}
