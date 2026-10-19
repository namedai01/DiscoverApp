// Package stories serves creating stories and listing them by location or by
// owner.
package stories

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/text/unicode/norm"

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
	notifyTimeout       = 5 * time.Second
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

func toJSON(r storyRow, defaultPhoto string) StoryJSON {
	s := StoryJSON{
		ID: r.ID.String(), Title: r.Title, Type: r.Type, Description: r.Description,
		ImageURL: r.ImageUrl, CreatedAt: r.CreatedAt.UTC(),
	}
	s.Location.ID, s.Location.VenueName = r.LocationID.String(), r.VenueName
	s.Owner.ID, s.Owner.DisplayName = r.OwnerID, r.OwnerDisplayName
	s.Owner.PhotoURL = users.PhotoOrDefault(r.OwnerPhotoUrl, defaultPhoto)
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

// validate normalizes the text fields to NFC in place (so lengths count
// characters as stored), checks the body and returns the title with
// surrounding space trimmed.
func (h *Handler) validate(req *createRequest, uid string) (title string, err error) {
	req.Type = norm.NFC.String(req.Type)
	req.Description = norm.NFC.String(req.Description)
	title = norm.NFC.String(strings.TrimSpace(req.Title))
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
		httpx.Error(w, r, httpx.Unauthorized("missing identity"))
		return
	}
	var req createRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}
	title, err := h.validate(&req, caller.UID)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}

	ctx := r.Context()
	// Look the location up before the first write, so a 422 leaves nothing
	// behind (not even the caller's user row).
	loc, err := h.Q.NearestLocation(ctx, store.NearestLocationParams{Lat: *req.Lat, Lng: *req.Lng})
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, r, httpx.Unprocessable("no locations exist yet to attach the story to"))
		return
	}
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	if _, err := users.Ensure(ctx, h.Q, caller, h.DefaultPhotoURL); err != nil {
		httpx.Error(w, r, err)
		return
	}
	row, err := h.Q.CreateStory(ctx, store.CreateStoryParams{
		OwnerID: caller.UID, LocationID: loc.ID, Title: title, Type: req.Type,
		Description: req.Description, ImageUrl: req.ImageURL,
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}

	// The story is stored. Push delivery runs before the response (a Cloud
	// Run instance may be throttled or stopped once it is sent) but can never
	// change it: it is bounded, detached from the client's cancellation, and
	// its failures and panics are only logged.
	h.notify(r.Context(), row.ID)

	httpx.JSON(w, http.StatusCreated, toJSON(storyRow(row), h.DefaultPhotoURL))
}

// notify tells the Notifier about a stored story, synchronously, with a
// notifyTimeout deadline that survives the request being cancelled. A panic
// is logged and swallowed.
func (h *Handler) notify(ctx context.Context, id uuid.UUID) {
	defer func() {
		if rec := recover(); rec != nil {
			slog.Error("notify panic", "story_id", id, "panic", rec)
		}
	}()
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), notifyTimeout)
	defer cancel()
	h.Notifier.StoryCreated(ctx, id)
}

// ListByLocation returns a location's stories, newest first. It is public;
// an unknown or malformed location id is 404.
func (h *Handler) ListByLocation(w http.ResponseWriter, r *http.Request) {
	locID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, httpx.NotFound("location not found"))
		return
	}
	if _, err := h.Q.GetLocation(r.Context(), locID); errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, r, httpx.NotFound("location not found"))
		return
	} else if err != nil {
		httpx.Error(w, r, err)
		return
	}
	limit, cursorTime, cursorID, err := pageParams(r)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	rows, err := h.Q.ListStoriesByLocation(r.Context(), store.ListStoriesByLocationParams{
		LocationID: locID, CursorTime: cursorTime, CursorID: cursorID, Lim: int32(limit + 1),
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	h.writePage(w, rows, limit)
}

// ListByOwner returns a user's stories, newest first. Only the owner and the
// owner's followers may read them; an unknown user is 404 before the gate.
func (h *Handler) ListByOwner(w http.ResponseWriter, r *http.Request) {
	caller, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, r, httpx.Unauthorized("missing identity"))
		return
	}
	ownerID := chi.URLParam(r, "id")
	exists, err := h.Q.UserExists(r.Context(), ownerID)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	if !exists {
		httpx.Error(w, r, httpx.NotFound("user not found"))
		return
	}
	if caller.UID != ownerID {
		following, err := h.Q.IsFollowing(r.Context(), store.IsFollowingParams{FollowerID: caller.UID, TargetID: ownerID})
		if err != nil {
			httpx.Error(w, r, err)
			return
		}
		if !following {
			httpx.Error(w, r, httpx.Forbidden("follow this user to see their stories"))
			return
		}
	}
	limit, cursorTime, cursorID, err := pageParams(r)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	rows, err := h.Q.ListStoriesByOwner(r.Context(), store.ListStoriesByOwnerParams{
		OwnerID: ownerID, CursorTime: cursorTime, CursorID: cursorID, Lim: int32(limit + 1),
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	items := make([]storyRow, len(rows))
	for i, row := range rows {
		items[i] = storyRow(row)
	}
	h.writePage(w, items, limit)
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
func (h *Handler) writePage(w http.ResponseWriter, rows []storyRow, limit int) {
	var next *string
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[limit-1]
		c := EncodeCursor(last.CreatedAt, last.ID)
		next = &c
	}
	items := make([]StoryJSON, len(rows))
	for i, row := range rows {
		items[i] = toJSON(row, h.DefaultPhotoURL)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": next})
}
