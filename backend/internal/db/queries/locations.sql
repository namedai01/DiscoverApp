-- name: ListLocations :many
-- q, when set, is a pre-built pattern from httpx.LikePrefix. geog is never
-- selected raw: lat/lng come from the geometry cast.
SELECT l.id,
       l.venue_name,
       l.venue_location,
       l.description,
       l.image_url,
       ST_Y(l.geog::geometry)::float8 AS lat,
       ST_X(l.geog::geometry)::float8 AS lng,
       (SELECT count(*) FROM stories s WHERE s.location_id = l.id)::bigint AS story_count
FROM locations l
WHERE sqlc.narg('q')::text IS NULL OR lower(l.venue_name) LIKE sqlc.narg('q')::text ESCAPE '\'
ORDER BY lower(l.venue_name), l.id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: GetLocation :one
SELECT l.id,
       l.venue_name,
       l.venue_location,
       l.description,
       l.image_url,
       ST_Y(l.geog::geometry)::float8 AS lat,
       ST_X(l.geog::geometry)::float8 AS lng,
       (SELECT count(*) FROM stories s WHERE s.location_id = l.id)::bigint AS story_count
FROM locations l
WHERE l.id = sqlc.arg('id');
