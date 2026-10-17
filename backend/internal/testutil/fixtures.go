package testutil

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SeedUser inserts a user with the given id and display name.
func SeedUser(t *testing.T, pool *pgxpool.Pool, uid, name string) {
	t.Helper()
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO users (id, display_name) VALUES ($1, $2)", uid, name); err != nil {
		t.Fatalf("seed user %q: %v", uid, err)
	}
}

// SeedLocation inserts a location at (lat, lng) and returns its id.
func SeedLocation(t *testing.T, pool *pgxpool.Pool, name string, lat, lng float64) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(t.Context(),
		`INSERT INTO locations (venue_name, geog)
		 VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)
		 RETURNING id`, name, lat, lng).Scan(&id)
	if err != nil {
		t.Fatalf("seed location %q: %v", name, err)
	}
	return id
}

// SeedStory inserts a story by owner at loc, created at the given time, with
// fixed title and image values, and returns its id.
func SeedStory(t *testing.T, pool *pgxpool.Pool, owner string, loc uuid.UUID, at time.Time) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(t.Context(),
		`INSERT INTO stories (owner_id, location_id, title, image_url, created_at)
		 VALUES ($1, $2, 'story', 'https://example.test/story.jpg', $3)
		 RETURNING id`, owner, loc, at).Scan(&id)
	if err != nil {
		t.Fatalf("seed story: %v", err)
	}
	return id
}
