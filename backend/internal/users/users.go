package users

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/httpx"
)

// List returns users, most followed first (ties by display name). An optional
// q is a case-insensitive display-name prefix; limit and offset page the
// result. isFollowing is not part of the list.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := httpx.Page(r)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var pattern *string
	if q := strings.TrimSpace(r.URL.Query().Get("q")); q != "" {
		p := httpx.LikePrefix(q)
		pattern = &p
	}
	rows, err := h.Q.ListUsers(r.Context(), store.ListUsersParams{
		Q:   pattern,
		Lim: int32(limit),
		Off: int32(offset),
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	items := make([]UserJSON, len(rows))
	for i, row := range rows {
		items[i] = UserJSON{
			ID:            row.ID,
			DisplayName:   row.DisplayName,
			PhotoURL:      deref(row.PhotoUrl),
			FollowerCount: row.FollowerCount,
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

// Get returns one user with isFollowing set for the caller, or 404.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, r, httpx.Unauthorized("missing identity"))
		return
	}
	row, err := h.Q.GetUserWithStats(r.Context(), store.GetUserWithStatsParams{
		ID:       chi.URLParam(r, "id"),
		ViewerID: id.UID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, r, httpx.NotFound("user not found"))
		return
	}
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, UserJSON{
		ID:            row.ID,
		DisplayName:   row.DisplayName,
		PhotoURL:      deref(row.PhotoUrl),
		FollowerCount: row.FollowerCount,
		IsFollowing:   &row.IsFollowing,
	})
}
