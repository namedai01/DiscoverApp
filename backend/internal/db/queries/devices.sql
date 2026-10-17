-- name: UpsertDevice :exec
-- A token belongs to one user at a time: registering it again (shared device,
-- new login) moves it to the caller.
INSERT INTO devices (token, user_id, platform)
VALUES ($1, $2, $3)
ON CONFLICT (token) DO UPDATE
SET user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    updated_at = now();

-- name: DeleteDevice :exec
DELETE FROM devices WHERE token = $1 AND user_id = $2;

-- name: StoryNotifyInfo :one
-- What a new-story push needs: the story, its location and who posted it.
SELECT s.id AS story_id,
       s.location_id,
       s.owner_id,
       u.display_name AS owner_display_name
FROM stories s
JOIN users u ON u.id = s.owner_id
WHERE s.id = $1;

-- name: FollowerTokens :many
-- Device tokens of everyone following the given user, never the user's own.
SELECT d.token
FROM follows f
JOIN devices d ON d.user_id = f.follower_id
WHERE f.target_id = $1
  AND f.follower_id <> $1
ORDER BY d.token;

-- name: DeleteTokens :exec
DELETE FROM devices WHERE token = ANY(sqlc.arg('tokens')::text[]);
