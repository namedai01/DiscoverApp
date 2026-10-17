-- name: UpsertSeedLocation :one
-- Keyed on seed_key so re-running a seed updates in place and keeps the uuid
-- that stories point at. inserted is true for a new row (xmax is 0 unless the
-- row was rewritten by ON CONFLICT DO UPDATE).
INSERT INTO locations (seed_key, venue_name, venue_location, description, image_url, geog)
VALUES (
    sqlc.arg('seed_key')::text,
    sqlc.arg('venue_name')::text,
    sqlc.arg('venue_location')::text,
    sqlc.arg('description')::text,
    sqlc.arg('image_url')::text,
    ST_SetSRID(ST_MakePoint(sqlc.arg('lng')::float8, sqlc.arg('lat')::float8), 4326)::geography
)
ON CONFLICT (seed_key) DO UPDATE SET
    venue_name     = EXCLUDED.venue_name,
    venue_location = EXCLUDED.venue_location,
    description    = EXCLUDED.description,
    image_url      = EXCLUDED.image_url,
    geog           = EXCLUDED.geog
RETURNING (xmax = 0)::bool AS inserted;
