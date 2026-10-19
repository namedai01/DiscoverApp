# Memopin backend

Go HTTP API for Memopin: places, stories, follows and device tokens for push notifications. Postgres (with PostGIS) for data, Firebase Auth for identity, Firebase Cloud Messaging for push. Design: `docs/superpowers/specs/2026-10-17-platform-design.md`.

All commands run from `backend/`.

## Requirements

- Go 1.24 (the `go.mod` directive; use `GOTOOLCHAIN=local` so Go never downloads another toolchain)
- Docker (local Postgres and the integration tests)

## Setup

```bash
cp .env.example .env     # gitignored; keep values quoted
make dev                 # starts Postgres in Docker, then runs the API on :8080
curl -s localhost:8080/healthz
```

`make dev` runs `docker compose up -d db`, loads `.env` and runs `go run ./cmd/api`. Migrations are embedded and applied at startup. The local database listens on host port **5433** (not 5432, which is often taken by another project).

`.env.example` uses `AUTH_MODE=fake`, so you do not need Firebase credentials locally. Send `Authorization: Bearer fake:<uid>:<phone>`:

```bash
curl -s -H 'Authorization: Bearer fake:u1:+84900000001' localhost:8080/v1/me
```

To run the whole stack in containers (API on `:8080`, same fake auth):

```bash
docker compose up --build -d
docker compose down -v
```

### Real Firebase auth locally

Set `AUTH_MODE=firebase` and `APP_ENV` as you like, fill `FIREBASE_PROJECT_ID` and `STORAGE_BUCKET`, then run `gcloud auth application-default login`. Google credentials come only from Application Default Credentials; no service account key file is used anywhere.

## Configuration

Read from the environment (see `.env.example`).

| Variable | Default | Required when | Notes |
|---|---|---|---|
| `APP_ENV` | `prod` | never | `dev` or `prod`. Defaults to `prod` so a missing value fails closed. |
| `DATABASE_URL` | none | always | Parsed with `pgxpool.ParseConfig`, so `sslmode` and `pool_max_conns` go in the URL. For Neon prefer `sslmode=verify-full` (it verifies the server certificate; `require` encrypts but does not authenticate the server). |
| `PORT` | `8080` | never | 1..65535. Cloud Run sets it. |
| `AUTH_MODE` | `firebase` | never | `firebase` or `fake`. `fake` is refused unless `APP_ENV=dev`. |
| `FIREBASE_PROJECT_ID` | none | `AUTH_MODE=firebase` | Firebase project that issues the ID tokens. |
| `STORAGE_BUCKET` | none | `AUTH_MODE=firebase` | `<PROJECT_ID>.firebasestorage.app`. Image URLs on write must live in this bucket under `uploads/<caller uid>/`. |
| `DEFAULT_USER_PHOTO_URL` | empty | never | Photo for users who have not set one. Copied onto new users at first login, and also returned at render time (user and story-owner `photoUrl`) for any user whose stored photo is empty. When the variable is empty, `photoUrl` is `""` and clients need their own placeholder. |
| `CORS_ORIGINS` | empty | `APP_ENV=prod` | Comma-separated allowed origins. |

Local database URL: `postgres://memopin:memopin@localhost:5433/memopin?sslmode=disable`.

The database must be UTF-8 with a non-`C` `LC_CTYPE` (for example `en_US.UTF-8`, which is Neon's default and the `postgis/postgis` image's). Case-insensitive search over Vietnamese names depends on it.

## Tests

```bash
make test        # go test -count=1 -p 1 ./...
make lint        # go vet ./...
```

Integration tests start a PostGIS container, so Docker must be running. They need no Google credentials. `-p 1` runs one test package at a time: each package starts its own Postgres container, and several at once run a small Docker VM (about 1 GB RAM) out of memory.

`make sqlc` regenerates `internal/db/store` from `internal/db/queries/*.sql` (needs the `sqlc` CLI; generated code is committed).

## Seed

`seed/locations.json` holds the places (an array of `key`, `venueName`, `venueLocation`, `description`, `imageUrl`, `lat`, `lng`). `key` is the stable identity: running the seed again updates the row and keeps its id, so stories keep pointing at it. Keys must not have leading or trailing whitespace.

```bash
set -a; . ./.env; set +a
go run ./cmd/seed                 # upsert, prints inserted=N updated=M
go run ./cmd/seed -dry-run        # same counts, seed changes rolled back
go run ./cmd/seed -file other.json
```

It needs only `DATABASE_URL` and applies schema migrations first (also in `-dry-run`), so it works on an empty database. Against Neon use the direct URL: `DATABASE_URL='<neon direct url>' go run ./cmd/seed`.

In the container image: `docker compose run --rm --entrypoint /app/bin/seed api`.

## API

JSON, camelCase. Errors: `{"error":{"code":"<code>","message":"<text>"}}` with codes `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `unprocessable`, `internal`. Every error uses this body, including unknown routes (404 `not_found`), wrong methods (405 `bad_request`, "method not allowed") and panics (500 `internal`). Timestamps are RFC 3339 UTC. Lists take `limit` (default 20, clamped to 1..100; non-integer is 400); offset lists also take `offset`, story lists take an opaque `cursor`.

Identity comes only from `Authorization: Bearer <Firebase ID token>`. A missing, expired or forged token on a required route is 401; if Firebase cannot be reached to verify a token, the answer is 503 `authentication temporarily unavailable` (retry later, do not sign the user out).

| Method + path | Auth | Purpose |
|---|---|---|
| `GET /healthz` | none | 200 `{"status":"ok"}`, 503 if a fresh DB ping fails |
| `GET /v1/me` | required | Own profile; creates it on first call (`displayName` defaults to `user <first 6 chars of uid>`; the phone is never shown) |
| `PATCH /v1/me` | required | Update `displayName` and/or `photoUrl` |
| `GET /v1/locations?q=&limit=&offset=` | none | Places with story counts; `q` is a case-insensitive name prefix |
| `GET /v1/locations/{id}` | none | Place details |
| `GET /v1/locations/{id}/stories?cursor=&limit=` | none | Local stories, newest first, with owner info |
| `GET /v1/users?q=&limit=&offset=` | none | People, most followed first; `q` is a display-name prefix |
| `GET /v1/users/{id}` | required | Public profile with `isFollowing` |
| `GET /v1/users/{id}/stories?cursor=&limit=` | required, self or follower | A user's timeline; 403 for non-followers |
| `PUT /v1/users/{id}/follow` | required | Follow (idempotent, 204) |
| `DELETE /v1/users/{id}/follow` | required | Unfollow (idempotent, 204) |
| `POST /v1/stories` | required | Create a story; the server attaches the nearest place from `lat`/`lng`. `imageUrl` must be in the caller's uploads folder. Notifies followers by push before responding (bounded to 5 s; a push failure never changes the 201) |
| `POST /v1/me/devices` | required | Register an FCM token (`token`, `platform`) |
| `DELETE /v1/me/devices/{token}` | required | Remove an FCM token |

Push notifications: title `Memopin`, body `<displayName> has just posted a new story.`, data `{"type":"new_story","storyId":"...","locationId":"..."}`.

## Deploy (Cloud Run + Neon)

Full steps are in `docs/setup/firebase-gcp.md`: section 7a (Neon) and 7b (Google Cloud: secret, service account, deploy). In short, from the repo root:

```bash
gcloud run deploy memopin-api --source backend --region <REGION> \
  --service-account "$SA" \
  --set-secrets DATABASE_URL=database-url:latest \
  --set-env-vars "^@^APP_ENV=prod@AUTH_MODE=firebase@FIREBASE_PROJECT_ID=<PROJECT_ID>@STORAGE_BUCKET=<PROJECT_ID>.firebasestorage.app@CORS_ORIGINS=<WEB_ORIGINS>" \
  --allow-unauthenticated
```

`CORS_ORIGINS` is required in prod (the config refuses to start without it). Several origins contain commas, so the setup doc switches gcloud's list delimiter with `--set-env-vars "^@^APP_ENV=prod@...@CORS_ORIGINS=<WEB_ORIGINS>"`.

- `--source backend` builds `backend/Dockerfile`: multi-stage, `golang:1.24` build with `CGO_ENABLED=0`, `distroless/static-debian12:nonroot` runtime, listening on `$PORT`.
- Use the Neon **direct** connection string, never the `-pooler` host: goose migrations hold a session advisory lock, which a transaction pooler breaks. Append `&pool_max_conns=5`, and use `sslmode=verify-full` rather than `require`.
- Migrations run at startup. Several instances may start at once; the session lock makes them apply the schema one after another.
- Credentials: the Cloud Run service account (Application Default Credentials). Never create a key file or set `GOOGLE_APPLICATION_CREDENTIALS`.
- After the first deploy, seed Neon from your laptop (see Seed).
