// Package stories serves creating stories and listing them by location or by
// owner.
package stories

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/httpx"
	"github.com/namedai01/memopin/backend/internal/notify"
	"github.com/namedai01/memopin/backend/internal/users"
)

const (
	maxTitleRunes       = 100
	maxTypeRunes        = 50
	maxDescriptionRunes = 2000
	notifyTimeout       = 10 * time.Second
)

// Handler serves /v1/stories and the per-location and per-user story lists.
// DefaultPhotoURL seeds the photo of a caller whose user row is created on
// the fly; Bucket is the Firebase Storage bucket image URLs must point into.
type Handler struct {
	Q               *store.Queries
	Bucket          string
	DefaultPhotoURL string
	Notifier        notify.Notifier
}

// StoryJSON is the public shape of a story.
type StoryJSON struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	ImageURL    string    `json:"imageUrl"`
	CreatedAt   time.Time `json:"createdAt"`
	Location    struct {
		ID        string `json:"id"`
		VenueName string `json:"venueName"`
	} `json:"location"`
	Owner struct {
		ID          string `json:"id"`
		DisplayName string `json:"displayName"`
		PhotoURL    string `json:"photoUrl"`
	} `json:"owner"`
}

// storyRow is the joined row every story query returns; the other query row
// types have identical fields and convert to it.
type storyRow = store.ListStoriesByLocationRow

func toJSON(r storyRow) StoryJSON {
	s := StoryJSON{
		ID: r.ID.String(), Title: r.Title, Type: r.Type, Description: r.Description,
		ImageURL: r.ImageUrl, CreatedAt: r.CreatedAt.UTC(),
	}
	s.Location.ID, s.Location.VenueName = r.LocationID.String(), r.VenueName
	s.Owner.ID, s.Owner.DisplayName = r.OwnerID, r.OwnerDisplayName
	if r.OwnerPhotoUrl != nil {
		s.Owner.PhotoURL = *r.OwnerPhotoUrl
	}
	return s
}

type createRequest struct {
	Title       string   `json:"title"`
	Type        string   `json:"type"`
	Description string   `json:"description"`
	ImageURL    string   `json:"imageUrl"`
	Lat         *float64 `json:"lat"`
	Lng         *float64 `json:"lng"`
}

// validate checks the body and returns the title with surrounding space
// trimmed.
func (h *Handler) validate(req createRequest, uid string) (title string, err error) {
	title = strings.TrimSpace(req.Title)
	switch {
	case title == "" || utf8.RuneCountInString(title) > maxTitleRunes:
		return "", httpx.BadRequest("title must be 1 to 100 characters")
	case utf8.RuneCountInString(req.Type) > maxTypeRunes:
		return "", httpx.BadRequest("type must be at most 50 characters")
	case utf8.RuneCountInString(req.Description) > maxDescriptionRunes:
		return "", httpx.BadRequest("description must be at most 2000 characters")
	case req.Lat == nil || *req.Lat < -90 || *req.Lat > 90:
		return "", httpx.BadRequest("lat is required and must be between -90 and 90")
	case req.Lng == nil || *req.Lng < -180 || *req.Lng > 180:
		return "", httpx.BadRequest("lng is required and must be between -180 and 180")
	case !users.ValidImageURL(h.Bucket, uid, req.ImageURL):
		return "", httpx.BadRequest("imageUrl must be an upload in your own storage folder")
	}
	return title, nil
}

// Create posts a story for the caller at the location nearest to lat/lng.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	caller, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, httpx.Unauthorized("missing identity"))
		return
	}
	var req createRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, err)
		return
	}
	title, err := h.validate(req, caller.UID)
	if err != nil {
		httpx.Error(w, err)
		return
	}

	ctx := r.Context()
	if _, err := users.Ensure(ctx, h.Q, caller, h.DefaultPhotoURL); err != nil {
		httpx.Error(w, err)
		return
	}
	loc, err := h.Q.NearestLocation(ctx, store.NearestLocationParams{Lat: *req.Lat, Lng: *req.Lng})
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, httpx.Unprocessable("no locations exist yet to attach the story to"))
		return
	}
	if err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.Q.CreateStory(ctx, store.CreateStoryParams{
		OwnerID: caller.UID, LocationID: loc.ID, Title: title, Type: req.Type,
		Description: req.Description, ImageUrl: req.ImageURL,
	})
	if err != nil {
		httpx.Error(w, err)
		return
	}

	// The story is stored; push delivery must not delay or fail the response,
	// nor die with the request context.
	go func(ctx context.Context, id uuid.UUID) {
		ctx, cancel := context.WithTimeout(ctx, notifyTimeout)
		defer cancel()
		h.Notifier.StoryCreated(ctx, id)
	}(context.WithoutCancel(ctx), row.ID)

	httpx.JSON(w, http.StatusCreated, toJSON(storyRow(row)))
}

// ListByLocation returns a location's stories, newest first. It is public;
// an unknown or malformed location id is 404.
func (h *Handler) ListByLocation(w http.ResponseWriter, r *http.Request) {
	locID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, httpx.NotFound("location not found"))
		return
	}
	if _, err := h.Q.GetLocation(r.Context(), locID); errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, httpx.NotFound("location not found"))
		return
	} else if err != nil {
		httpx.Error(w, err)
		return
	}
	limit, cursorTime, cursorID, err := pageParams(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	rows, err := h.Q.ListStoriesByLocation(r.Context(), store.ListStoriesByLocationParams{
		LocationID: locID, CursorTime: cursorTime, CursorID: cursorID, Lim: int32(limit + 1),
	})
	if err != nil {
		httpx.Error(w, err)
		return
	}
	writePage(w, rows, limit)
}

// ListByOwner returns a user's stories, newest first. Only the owner and the
// owner's followers may read them; an unknown user is 404 before the gate.
func (h *Handler) ListByOwner(w http.ResponseWriter, r *http.Request) {
	caller, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, httpx.Unauthorized("missing identity"))
		return
	}
	ownerID := chi.URLParam(r, "id")
	exists, err := h.Q.UserExists(r.Context(), ownerID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	if !exists {
		httpx.Error(w, httpx.NotFound("user not found"))
		return
	}
	if caller.UID != ownerID {
		following, err := h.Q.IsFollowing(r.Context(), store.IsFollowingParams{FollowerID: caller.UID, TargetID: ownerID})
		if err != nil {
			httpx.Error(w, err)
			return
		}
		if !following {
			httpx.Error(w, httpx.Forbidden("follow this user to see their stories"))
			return
		}
	}
	limit, cursorTime, cursorID, err := pageParams(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	rows, err := h.Q.ListStoriesByOwner(r.Context(), store.ListStoriesByOwnerParams{
		OwnerID: ownerID, CursorTime: cursorTime, CursorID: cursorID, Lim: int32(limit + 1),
	})
	if err != nil {
		httpx.Error(w, err)
		return
	}
	items := make([]storyRow, len(rows))
	for i, row := range rows {
		items[i] = storyRow(row)
	}
	writePage(w, items, limit)
}

// pageParams parses limit and the optional cursor; the cursor is a zero
// (invalid) pair on the first page.
func pageParams(r *http.Request) (limit int, t pgtype.Timestamptz, id pgtype.UUID, err error) {
	if limit, err = httpx.Limit(r); err != nil {
		return 0, t, id, err
	}
	if c := r.URL.Query().Get("cursor"); c != "" {
		ct, cid, derr := DecodeCursor(c)
		if derr != nil {
			return 0, t, id, httpx.BadRequest("invalid cursor")
		}
		t = pgtype.Timestamptz{Time: ct, Valid: true}
		id = pgtype.UUID{Bytes: cid, Valid: true}
	}
	return limit, t, id, nil
}

// writePage renders rows fetched with limit+1: a surplus row means another
// page exists, and the cursor points at the last row shown.
func writePage(w http.ResponseWriter, rows []storyRow, limit int) {
	var next *string
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[limit-1]
		c := EncodeCursor(last.CreatedAt, last.ID)
		next = &c
	}
	items := make([]StoryJSON, len(rows))
	for i, row := range rows {
		items[i] = toJSON(row)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": next})
}
