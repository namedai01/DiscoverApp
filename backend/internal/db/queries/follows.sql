-- name: Follow :exec
INSERT INTO follows (follower_id, target_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: Unfollow :exec
DELETE FROM follows WHERE follower_id = $1 AND target_id = $2;

-- name: IsFollowing :one
SELECT EXISTS (
    SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2
);
