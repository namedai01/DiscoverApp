-- name: NearestLocation :one
-- Closest location to the given point by geodesic distance (uses the gist
-- index); ties break by id so the answer is stable.
SELECT l.id, l.venue_name
FROM locations l
ORDER BY l.geog <-> ST_SetSRID(ST_MakePoint(sqlc.arg('lng')::float8, sqlc.arg('lat')::float8), 4326)::geography,
         l.id
LIMIT 1;

-- name: CreateStory :one
-- One statement: insert, then return the joined row.
WITH ins AS (
    INSERT INTO stories (owner_id, location_id, title, type, description, image_url)
    VALUES (sqlc.arg('owner_id'), sqlc.arg('location_id'), sqlc.arg('title'), sqlc.arg('type'),
            sqlc.arg('description'), sqlc.arg('image_url'))
    RETURNING *
)
SELECT s.id,
       s.title,
       s.type,
       s.description,
       s.image_url,
       s.created_at,
       l.id AS location_id,
       l.venue_name,
       u.id AS owner_id,
       u.display_name AS owner_display_name,
       u.photo_url AS owner_photo_url
FROM ins s
JOIN users u ON u.id = s.owner_id
JOIN locations l ON l.id = s.location_id;

-- name: ListStoriesByLocation :many
-- Keyset page, newest first. cursor_time and cursor_id are both set or both
-- NULL (first page).
SELECT s.id,
       s.title,
       s.type,
       s.description,
       s.image_url,
       s.created_at,
       l.id AS location_id,
       l.venue_name,
       u.id AS owner_id,
       u.display_name AS owner_display_name,
       u.photo_url AS owner_photo_url
FROM stories s
JOIN users u ON u.id = s.owner_id
JOIN locations l ON l.id = s.location_id
WHERE s.location_id = sqlc.arg('location_id')
  AND (sqlc.narg('cursor_time')::timestamptz IS NULL
       OR (s.created_at, s.id) < (sqlc.narg('cursor_time')::timestamptz, sqlc.narg('cursor_id')::uuid))
ORDER BY s.created_at DESC, s.id DESC
LIMIT sqlc.arg('lim');

-- name: ListStoriesByOwner :many
SELECT s.id,
       s.title,
       s.type,
       s.description,
       s.image_url,
       s.created_at,
       l.id AS location_id,
       l.venue_name,
       u.id AS owner_id,
       u.display_name AS owner_display_name,
       u.photo_url AS owner_photo_url
FROM stories s
JOIN users u ON u.id = s.owner_id
JOIN locations l ON l.id = s.location_id
WHERE s.owner_id = sqlc.arg('owner_id')
  AND (sqlc.narg('cursor_time')::timestamptz IS NULL
       OR (s.created_at, s.id) < (sqlc.narg('cursor_time')::timestamptz, sqlc.narg('cursor_id')::uuid))
ORDER BY s.created_at DESC, s.id DESC
LIMIT sqlc.arg('lim');
