// Package locations serves the public location list, search and lookup.
package locations

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/httpx"
)

// Handler serves /v1/locations.
type Handler struct {
	Q *store.Queries
}

// LocationJSON is the public shape of a location.
type LocationJSON struct {
	ID            string  `json:"id"`
	VenueName     string  `json:"venueName"`
	VenueLocation string  `json:"venueLocation"`
	Description   string  `json:"description"`
	ImageURL      string  `json:"imageUrl"`
	Lat           float64 `json:"lat"`
	Lng           float64 `json:"lng"`
	StoryCount    int64   `json:"storyCount"`
}

// List returns locations sorted by name. An optional q is a case-insensitive
// name prefix; limit and offset page the result.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := httpx.Page(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var pattern *string
	if q := strings.TrimSpace(r.URL.Query().Get("q")); q != "" {
		p := httpx.LikePrefix(q)
		pattern = &p
	}
	rows, err := h.Q.ListLocations(r.Context(), store.ListLocationsParams{
		Q:   pattern,
		Lim: int32(limit),
		Off: int32(offset),
	})
	if err != nil {
		httpx.Error(w, err)
		return
	}
	items := make([]LocationJSON, len(rows))
	for i, row := range rows {
		items[i] = LocationJSON{
			ID: row.ID.String(), VenueName: row.VenueName, VenueLocation: row.VenueLocation,
			Description: row.Description, ImageURL: row.ImageUrl,
			Lat: row.Lat, Lng: row.Lng, StoryCount: row.StoryCount,
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

// Get returns one location, or 404 for an unknown or malformed id.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, httpx.NotFound("location not found"))
		return
	}
	row, err := h.Q.GetLocation(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, httpx.NotFound("location not found"))
		return
	}
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, LocationJSON{
		ID: row.ID.String(), VenueName: row.VenueName, VenueLocation: row.VenueLocation,
		Description: row.Description, ImageURL: row.ImageUrl,
		Lat: row.Lat, Lng: row.Lng, StoryCount: row.StoryCount,
	})
}
