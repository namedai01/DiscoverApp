// Package seed loads places from a JSON file and upserts them into locations.
package seed

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/db/store"
)

// Location is one place to seed. Key is the stable identity (the old
// Firestore doc id or a slug): re-seeding the same key updates the row.
type Location struct {
	Key           string  `json:"key"`
	VenueName     string  `json:"venueName"`
	VenueLocation string  `json:"venueLocation"`
	Description   string  `json:"description"`
	ImageURL      string  `json:"imageUrl"`
	Lat           float64 `json:"lat"`
	Lng           float64 `json:"lng"`
}

// row is the wire form: lat and lng are pointers so a missing coordinate is
// not mistaken for 0.
type row struct {
	Key           string   `json:"key"`
	VenueName     string   `json:"venueName"`
	VenueLocation string   `json:"venueLocation"`
	Description   string   `json:"description"`
	ImageURL      string   `json:"imageUrl"`
	Lat           *float64 `json:"lat"`
	Lng           *float64 `json:"lng"`
}

// Load reads a JSON array of places and validates every row. It returns
// either all rows or an error naming the first bad 0-based row index.
func Load(r io.Reader) ([]Location, error) {
	dec := json.NewDecoder(r)
	var raws []json.RawMessage
	if err := dec.Decode(&raws); err != nil {
		return nil, fmt.Errorf("seed: decode json array: %w", err)
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return nil, errors.New("seed: unexpected data after the json array")
	}

	locs := make([]Location, 0, len(raws))
	seen := make(map[string]struct{}, len(raws))
	for i, raw := range raws {
		var rw *row
		rowDec := json.NewDecoder(bytes.NewReader(raw))
		rowDec.DisallowUnknownFields()
		if err := rowDec.Decode(&rw); err != nil {
			return nil, fmt.Errorf("seed: row %d: %w", i, err)
		}
		if rw == nil {
			return nil, fmt.Errorf("seed: row %d: must be an object", i)
		}
		loc, err := validate(*rw)
		if err != nil {
			return nil, fmt.Errorf("seed: row %d: %w", i, err)
		}
		if _, dup := seen[loc.Key]; dup {
			return nil, fmt.Errorf("seed: row %d: duplicate key %q", i, loc.Key)
		}
		seen[loc.Key] = struct{}{}
		locs = append(locs, loc)
	}
	return locs, nil
}

func validate(r row) (Location, error) {
	switch {
	case strings.TrimSpace(r.Key) == "":
		return Location{}, errors.New("key is required")
	case strings.TrimSpace(r.VenueName) == "":
		return Location{}, errors.New("venueName is required")
	case r.Lat == nil:
		return Location{}, errors.New("lat is required")
	case r.Lng == nil:
		return Location{}, errors.New("lng is required")
	case *r.Lat < -90 || *r.Lat > 90:
		return Location{}, errors.New("lat out of range (-90..90)")
	case *r.Lng < -180 || *r.Lng > 180:
		return Location{}, errors.New("lng out of range (-180..180)")
	}
	return Location{
		Key:           r.Key,
		VenueName:     r.VenueName,
		VenueLocation: r.VenueLocation,
		Description:   r.Description,
		ImageURL:      r.ImageURL,
		Lat:           *r.Lat,
		Lng:           *r.Lng,
	}, nil
}

// Apply upserts every location in one transaction, keyed on seed_key, and
// reports how many rows were inserted and how many already existed and were
// updated. Updating keeps the row's uuid, so stories keep pointing at it.
func Apply(ctx context.Context, pool *pgxpool.Pool, locs []Location) (inserted, updated int, err error) {
	return run(ctx, pool, locs, true)
}

// DryRun does what Apply does and then rolls the transaction back, so the
// counts are real but nothing is kept.
func DryRun(ctx context.Context, pool *pgxpool.Pool, locs []Location) (inserted, updated int, err error) {
	return run(ctx, pool, locs, false)
}

func run(ctx context.Context, pool *pgxpool.Pool, locs []Location, commit bool) (inserted, updated int, err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, 0, fmt.Errorf("seed: begin: %w", err)
	}
	// Rollback after a successful Commit is a no-op, so this is always safe.
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()

	inserted, updated, err = upsertAll(ctx, tx, locs)
	if err != nil {
		return 0, 0, err
	}
	if !commit {
		return inserted, updated, nil
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, 0, fmt.Errorf("seed: commit: %w", err)
	}
	return inserted, updated, nil
}

func upsertAll(ctx context.Context, tx pgx.Tx, locs []Location) (inserted, updated int, err error) {
	q := store.New(tx)
	for i, l := range locs {
		isNew, err := q.UpsertSeedLocation(ctx, store.UpsertSeedLocationParams{
			SeedKey:       l.Key,
			VenueName:     l.VenueName,
			VenueLocation: l.VenueLocation,
			Description:   l.Description,
			ImageUrl:      l.ImageURL,
			Lat:           l.Lat,
			Lng:           l.Lng,
		})
		if err != nil {
			return 0, 0, fmt.Errorf("seed: row %d (%s): %w", i, l.Key, err)
		}
		if isNew {
			inserted++
		} else {
			updated++
		}
	}
	return inserted, updated, nil
}
