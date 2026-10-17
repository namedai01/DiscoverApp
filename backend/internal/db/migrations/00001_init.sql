-- +goose Up
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
    id           text PRIMARY KEY,
    display_name text NOT NULL,
    photo_url    text,
    phone        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_display_name_idx ON users (lower(display_name) text_pattern_ops);

CREATE TABLE locations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seed_key       text UNIQUE,
    venue_name     text NOT NULL,
    venue_location text NOT NULL DEFAULT '',
    description    text NOT NULL DEFAULT '',
    image_url      text NOT NULL DEFAULT '',
    geog           geography(Point, 4326) NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX locations_geog_idx ON locations USING gist (geog);
CREATE INDEX locations_venue_name_idx ON locations (lower(venue_name) text_pattern_ops);

CREATE TABLE stories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
    title       text NOT NULL,
    type        text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    image_url   text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stories_location_idx ON stories (location_id, created_at DESC, id DESC);
CREATE INDEX stories_owner_idx ON stories (owner_id, created_at DESC, id DESC);

CREATE TABLE follows (
    follower_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_id   text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, target_id),
    CHECK (follower_id <> target_id)
);
CREATE INDEX follows_target_idx ON follows (target_id);

CREATE TABLE devices (
    token      text PRIMARY KEY,
    user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform   text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX devices_user_idx ON devices (user_id);

-- +goose Down
-- The postgis extension is left installed: it may predate this migration.
DROP TABLE devices;
DROP TABLE follows;
DROP TABLE stories;
DROP TABLE locations;
DROP TABLE users;
