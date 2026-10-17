-- name: UpsertUser :one
-- The no-op DO UPDATE makes RETURNING yield the existing row, so a renamed
-- user keeps their display name.
INSERT INTO users (id, display_name, photo_url, phone)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
RETURNING *;

-- name: UpdateUser :one
UPDATE users
SET display_name = COALESCE(sqlc.narg('display_name'), display_name),
    photo_url    = COALESCE(sqlc.narg('photo_url'), photo_url),
    updated_at   = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: GetUserWithStats :one
SELECT u.id,
       u.display_name,
       u.photo_url,
       (SELECT count(*) FROM follows f WHERE f.target_id = u.id)::bigint AS follower_count,
       EXISTS (
           SELECT 1 FROM follows f
           WHERE f.target_id = u.id AND f.follower_id = sqlc.arg('viewer_id')
       ) AS is_following
FROM users u
WHERE u.id = sqlc.arg('id');

-- name: UserExists :one
SELECT EXISTS (SELECT 1 FROM users WHERE id = $1);

-- name: ListUsers :many
-- q, when set, is a pre-built pattern from httpx.LikePrefix.
SELECT u.id,
       u.display_name,
       u.photo_url,
       count(f.follower_id)::bigint AS follower_count
FROM users u
LEFT JOIN follows f ON f.target_id = u.id
WHERE sqlc.narg('q')::text IS NULL OR lower(u.display_name) LIKE sqlc.narg('q')::text ESCAPE '\'
GROUP BY u.id
ORDER BY follower_count DESC, lower(u.display_name), u.id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');
