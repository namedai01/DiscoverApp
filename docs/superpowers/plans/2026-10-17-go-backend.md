# Go Backend (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Go HTTP API on Postgres that owns all Memopin data and rules now done client-side against Firestore, plus FCM push and a locations seed, deployed to Cloud Run with Neon Postgres.

**Prerequisite:** Phase 0 done by the user (`docs/setup/firebase-gcp.md`). Tasks 1–8 run fully local without it; Task 9 Step 5 (deploy) needs it.

**Architecture:** `backend/` is a standalone Go module. chi router → feature packages (`users`, `locations`, `follows`, `stories`, `devices`) → sqlc-generated queries on pgx. Firebase Admin SDK verifies ID tokens (`internal/auth`) and sends FCM (`internal/notify`). Every external dependency sits behind a small interface so tests use fakes plus a real Postgres from testcontainers.

**Tech Stack:** Go 1.24, chi v5, pgx v5 (pgxpool), sqlc, goose v3 (embedded migrations), firebase.google.com/go/v4, caarlos0/env v11, log/slog, testcontainers-go (postgres module), image `postgis/postgis:16-3.4`.

**Spec:** `docs/superpowers/specs/2026-10-17-platform-design.md`

## Global Constraints

- Module path: `github.com/namedai01/memopin/backend`; `go 1.24` in `go.mod`. Run all commands from `backend/`.
- Identity comes only from a verified Firebase ID token (`Authorization: Bearer <token>`). Never read a uid from body/query.
- JSON is camelCase. Error body: `{"error":{"code":"<code>","message":"<text>"}}`. Codes: `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `unprocessable`, `internal`.
- Timestamps: RFC 3339 UTC.
- List limits: default 20, max 100; `limit` outside 1..100 → clamp, non-integer → 400.
- Default display name on first login: `user <first 6 chars of uid>` (ruling R21; the phone number is never part of a public name).
- Image URLs accepted on write must start with `https://firebasestorage.googleapis.com/v0/b/<STORAGE_BUCKET>/o/uploads%2F<caller uid>%2F`.
- Push body copy: `<displayName> has just posted a new story.`; title `Memopin`; data `{"type":"new_story","storyId":"<id>","locationId":"<id>"}`.
- Config via env (`.env.example` lists all): `APP_ENV` (`dev` | `prod`), `DATABASE_URL`, `PORT` (default 8080; Cloud Run sets it), `FIREBASE_PROJECT_ID`, `STORAGE_BUCKET` (`<PROJECT_ID>.firebasestorage.app`), `DEFAULT_USER_PHOTO_URL`, `CORS_ORIGINS` (comma list), `AUTH_MODE` (`firebase` | `fake`; `fake` refused unless `APP_ENV=dev`).
- Google credentials come only from Application Default Credentials (`firebase.NewApp(ctx, &firebase.Config{ProjectID: ...})` with no option). No service account key file, no `GOOGLE_APPLICATION_CREDENTIALS` in docs or `.env.example`.
- `DATABASE_URL` is the only DB setting, parsed with `pgxpool.ParseConfig` (so `sslmode`, `pool_max_conns` come from the URL). Local: `postgres://memopin:memopin@localhost:5433/memopin?sslmode=disable`. Prod: Neon direct endpoint `...neon.tech/memopin?sslmode=require&pool_max_conns=5`. Never the Neon `-pooler` host (goose migrations need a session).
- The pool must survive Neon compute sleeping after 5 min idle: rely on pgxpool's ping-before-use of idle connections; `/healthz` returns 503 only if a fresh `Ping` fails.
- Local `backend/.env` is gitignored; `make dev` loads it (`set -a; . ./.env; set +a`). `.env.example` is committed with the local values above.
- Integration tests need Docker running. `go test ./...` must pass with no Google credentials.

## Review Focus

1. Search text containing `%`, `_` or `\` → treated literally, not as LIKE wildcards. (Task 4, Task 5)
2. Expired/forged/missing token on a required route → 401, never falls through as anonymous. (Task 3)
3. Non-follower requests another user's timeline → 403 with no story data; self is always allowed. (Task 6)
4. Double follow / double unfollow (retry, double tap) → idempotent 204, follower count unchanged. (Task 5)
5. Story posted when the `locations` table is empty, or image URL from another user's folder → 422 / 400, nothing inserted. (Task 6)

---

## File Structure

```
backend/
  go.mod, Makefile, sqlc.yaml, compose.yaml, Dockerfile, .env.example, README.md
  cmd/api/main.go                    wire config, pool, migrations, firebase, router
  cmd/seed/main.go                   upsert places from seed/locations.json
  seed/locations.json                seed data (committed)
  internal/config/config.go          Config struct + Load()
  internal/db/migrations/*.sql       goose migrations (embedded)
  internal/db/migrate.go             Migrate(ctx, pool) using embed.FS
  internal/db/queries/*.sql          one file per feature
  internal/db/store/                 sqlc output (generated, committed)
  internal/httpx/                    JSON write/read, error type, pagination parsing
  internal/auth/                     Verifier interface, Firebase + fake impls, middleware
  internal/users/                    /v1/me, /v1/users
  internal/locations/                /v1/locations
  internal/follows/                  follow/unfollow
  internal/stories/                  create + list stories
  internal/devices/                  FCM token registry
  internal/notify/                   Notifier interface, FCM impl
  internal/server/router.go          NewRouter(deps) http.Handler
  internal/testutil/                 Postgres container, fixtures, request helpers
```

---

### Task 1: Module scaffold, config, health check

**Files:**
- Create: `backend/go.mod`, `backend/Makefile`, `backend/compose.yaml`, `backend/.env.example`, `backend/.gitignore`
- Create: `backend/internal/config/config.go`, `backend/internal/httpx/httpx.go`, `backend/internal/server/router.go`, `backend/cmd/api/main.go`
- Create: `backend/internal/testutil/pg.go`
- Test: `backend/internal/server/health_test.go`, `backend/internal/config/config_test.go`

**Interfaces:**
- Produces:
  - `config.Load() (config.Config, error)`; `Config{Env, Port, DatabaseURL, FirebaseProjectID, StorageBucket, CORSOrigins []string, AuthMode string}`
  - `httpx.JSON(w http.ResponseWriter, status int, v any)`, `httpx.Error(w, err error)`, `httpx.Decode(r *http.Request, v any) error` (rejects unknown fields, body > 1 MiB)
  - `httpx.APIError{Status int; Code, Message string}` implementing `error`; helpers `httpx.BadRequest(msg)`, `NotFound(msg)`, `Forbidden(msg)`, `Unauthorized(msg)`, `Unprocessable(msg)`, `Conflict(msg)`. Non-`APIError` → 500 `internal`, real error logged, message hidden.
  - `httpx.Page(r) (limit, offset int, err error)` per Global Constraints.
  - `server.Deps{Pool *pgxpool.Pool; Verifier auth.Verifier; Notifier notify.Notifier; Cfg config.Config}` (fields added by later tasks) and `server.NewRouter(d server.Deps) http.Handler`
  - `testutil.NewPool(t *testing.T) *pgxpool.Pool` — one container per package (`sync.Once` + `TestMain`), migrated, tables truncated per test.

- [ ] **Step 1: Write failing tests** — `TestHealthz_DBUp` (GET `/healthz` → 200 `{"status":"ok"}`), `TestHealthz_DBDown` (closed pool → 503 `{"status":"db_unavailable"}`), `TestLoad_FakeAuthOnlyInDev` (`AUTH_MODE=fake`, `APP_ENV=prod` → error), `TestPage_Clamp` (`limit=500` → 100, `limit=abc` → 400).
- [ ] **Step 2:** `go test ./...` → FAIL (undefined).
- [ ] **Step 3: Implement** the files above. Router middleware: `RequestID`, `RealIP`, slog request logger, `Recoverer`, CORS from `CORS_ORIGINS`, 15 s timeout. `compose.yaml`: service `db` with `postgis/postgis:16-3.4`, port 5432, volume. Makefile targets: `dev` (compose up + `go run ./cmd/api`), `test`, `sqlc`, `lint` (`go vet ./...`).
- [ ] **Step 4:** `go test ./...` → PASS.
- [ ] **Step 5: Commit** `feat(backend): scaffold api with config and health check`

### Task 2: Schema and sqlc

**Files:**
- Create: `backend/internal/db/migrations/00001_init.sql`, `backend/internal/db/migrate.go`, `backend/sqlc.yaml`
- Test: `backend/internal/db/migrate_test.go`

**Interfaces:**
- Produces: `db.Migrate(ctx context.Context, pool *pgxpool.Pool) error` (called by `cmd/api` at startup and by `testutil.NewPool`); sqlc package `store` at `internal/db/store` with `store.New(pool) *store.Queries`.

Schema (the decision; write it as the migration):

| Table | Columns / constraints |
|---|---|
| `users` | `id text PK`, `display_name text NOT NULL`, `photo_url text`, `phone text`, `created_at`, `updated_at` (timestamptz, default now()) |
| `locations` | `id uuid PK default gen_random_uuid()`, `seed_key text UNIQUE`, `venue_name text NOT NULL`, `venue_location text NOT NULL DEFAULT ''`, `description text NOT NULL DEFAULT ''`, `image_url text NOT NULL DEFAULT ''`, `geog geography(Point,4326) NOT NULL`, `created_at` |
| `stories` | `id uuid PK`, `owner_id text NOT NULL → users ON DELETE CASCADE`, `location_id uuid NOT NULL → locations ON DELETE RESTRICT`, `title text NOT NULL`, `type text NOT NULL DEFAULT ''`, `description text NOT NULL DEFAULT ''`, `image_url text NOT NULL`, `created_at` |
| `follows` | `follower_id`, `target_id` (text → users ON DELETE CASCADE), `created_at`, `PK(follower_id, target_id)`, `CHECK (follower_id <> target_id)` |
| `devices` | `token text PK`, `user_id text NOT NULL → users ON DELETE CASCADE`, `platform text NOT NULL CHECK (platform IN ('android','ios','web'))`, `updated_at` |

Indexes: `CREATE EXTENSION postgis`; GiST on `locations.geog`; `lower(venue_name) text_pattern_ops`; `lower(display_name) text_pattern_ops`; `stories(location_id, created_at DESC, id DESC)`; `stories(owner_id, created_at DESC, id DESC)`; `follows(target_id)`; `devices(user_id)`.

- [ ] **Step 1: Write failing test** `TestMigrate_UpDownUp` — up, `goose.Reset`, up again, no error; then insert `follows` row with equal ids → error code `23514`.
- [ ] **Step 2:** `go test ./internal/db/...` → FAIL.
- [ ] **Step 3: Implement** migration (with `-- +goose Down`), `migrate.go` (embed `migrations/*.sql`, `goose.SetDialect("postgres")`, `goose.UpContext` via `stdlib.OpenDBFromPool`), `sqlc.yaml` (engine postgresql, `sql_package: pgx/v5`, `emit_json_tags: false`, uuid → `github.com/google/uuid.UUID`, timestamptz → `time.Time`).
- [ ] **Step 4:** `go test ./internal/db/...` → PASS; `sqlc generate` succeeds (empty queries dir allowed with a `-- placeholder` query file).
- [ ] **Step 5: Commit** `feat(backend): add postgres schema and migrations`

### Task 3: Auth and `/v1/me`

**Files:**
- Create: `backend/internal/auth/auth.go`, `backend/internal/auth/firebase.go`, `backend/internal/auth/fake.go`
- Create: `backend/internal/db/queries/users.sql`, `backend/internal/users/me.go`
- Modify: `backend/internal/server/router.go`, `backend/cmd/api/main.go`
- Test: `backend/internal/auth/middleware_test.go`, `backend/internal/users/me_test.go`

**Interfaces:**
- Produces:
  - `auth.Identity{UID, Phone string}`; `auth.Verifier` interface `{ Verify(ctx context.Context, idToken string) (auth.Identity, error) }`
  - `auth.NewFirebase(ctx, app *firebase.App) (auth.Verifier, error)` (uses `VerifyIDToken`, not the revocation-check variant)
  - `auth.Fake{}` — token format `fake:<uid>:<phone>`, used by tests and `AUTH_MODE=fake`
  - `auth.Required(v Verifier) func(http.Handler) http.Handler`, `auth.Optional(v Verifier) func(http.Handler) http.Handler` (bad token on Optional → still 401)
  - `auth.FromContext(ctx) (auth.Identity, bool)`
  - `users.Handler{Q *store.Queries; Bucket string}` with `GetMe`, `PatchMe`
  - `users.UserJSON{ID, DisplayName, PhotoURL string; FollowerCount int64; IsFollowing *bool}` (`isFollowing` omitted when nil)
  - `testutil.Do(t, h http.Handler, method, path, uid string, body any) *httptest.ResponseRecorder` (uid "" = no token)

- [ ] **Step 1: Write failing tests:**
  - `TestRequired_NoHeader` → 401 `unauthorized`; `TestRequired_BadToken` → 401; `TestOptional_NoHeader` → handler runs, no identity.
  - `TestGetMe_CreatesOnFirstCall` — uid `u1` phone `+84900000001` → 200, `displayName == "user +84900000001"`, `photoUrl == DEFAULT_USER_PHOTO_URL`; second call returns same row (no duplicate, display name unchanged after a PATCH).
  - `TestPatchMe_DisplayName` — `{"displayName":"An"}` → 200; `{"displayName":"   "}` → 400; 51-char name → 400.
  - `TestPatchMe_PhotoURLMustBeOwnFolder` — URL in `uploads%2Fu2%2F` while caller is `u1` → 400; own folder → 200.
- [ ] **Step 2:** `go test ./internal/auth/... ./internal/users/...` → FAIL.
- [ ] **Step 3: Implement.** `users.sql`: `UpsertUser :one` (`INSERT … ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id RETURNING *` so existing names survive), `UpdateUser :one` (`COALESCE(sqlc.narg(...), col)`), `GetUserWithStats :one` (follower count subquery, `is_following` via `EXISTS` for a viewer arg). Add `DEFAULT_USER_PHOTO_URL` to config. Display name: trimmed, 1..50 runes. Shared `users.ValidImageURL(bucket, uid, url string) bool` (reused by Task 6).
- [ ] **Step 4:** tests → PASS.
- [ ] **Step 5: Commit** `feat(backend): verify firebase tokens and add /v1/me`

### Task 4: Locations

**Files:**
- Create: `backend/internal/db/queries/locations.sql`, `backend/internal/locations/handler.go`, `backend/internal/httpx/like.go`
- Modify: `backend/internal/server/router.go`
- Test: `backend/internal/locations/handler_test.go`, `backend/internal/testutil/fixtures.go`

**Interfaces:**
- Produces:
  - `httpx.LikePrefix(q string) string` — lowercases, escapes `\`, `%`, `_`, appends `%` (used with `ESCAPE '\'`)
  - `locations.LocationJSON{ID, VenueName, VenueLocation, Description, ImageURL string; Lat, Lng float64; StoryCount int64}`
  - `testutil.SeedUser(t, pool, uid, name string)`, `testutil.SeedLocation(t, pool, name string, lat, lng float64) uuid.UUID`, `testutil.SeedStory(t, pool, owner string, loc uuid.UUID, at time.Time) uuid.UUID`

- [ ] **Step 1: Write failing tests:**
  - `TestListLocations_SortedByName` — seed "Hồ Gươm", "Bà Nà", "Cầu Rồng" → order by `lower(venue_name)` ascending, each with `storyCount`.
  - `TestListLocations_PrefixSearchCaseInsensitive` — `q=hồ` matches "Hồ Gươm", `q=gươm` matches nothing (prefix, as today).
  - `TestListLocations_WildcardLiteral` — `q=%` and `q=_` return empty when no name starts with those chars.
  - `TestGetLocation_NotFound` — random uuid → 404; `not-a-uuid` → 404.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `ListLocations :many` (`ST_Y(geog::geometry)` as lat, `ST_X` as lng, story count subquery, `WHERE sqlc.narg(q) IS NULL OR lower(venue_name) LIKE sqlc.narg(q) ESCAPE '\'`, limit/offset), `GetLocation :one`. Routes: `GET /v1/locations`, `GET /v1/locations/{id}` (public).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(backend): list, search and get locations`

### Task 5: Users list, profiles, follow

**Files:**
- Create: `backend/internal/db/queries/follows.sql`, `backend/internal/follows/handler.go`, `backend/internal/users/users.go`
- Modify: `backend/internal/db/queries/users.sql`, `backend/internal/server/router.go`
- Test: `backend/internal/follows/handler_test.go`, `backend/internal/users/users_test.go`

**Interfaces:**
- Consumes: `users.UserJSON`, `httpx.LikePrefix`, `testutil.SeedUser`
- Produces: `follows.Handler{Q *store.Queries}` with `Follow`, `Unfollow`; `store.IsFollowing(ctx, follower, target) (bool, error)` (used by Task 6)

- [ ] **Step 1: Write failing tests:**
  - `TestFollow_Idempotent` — `PUT /v1/users/u2/follow` twice as `u1` → 204 both; `GET /v1/users/u2` → `followerCount == 1`, `isFollowing == true`.
  - `TestUnfollow_Idempotent` — `DELETE` twice → 204 both; count 0.
  - `TestFollow_Self` → 400; `TestFollow_UnknownUser` → 404.
  - `TestListUsers_SortedByFollowers` — u3 has 2 followers, u2 has 1, u1 has 0 → `[u3,u2,u1]`; ties by `display_name`; `q` prefix search on display name with wildcard escaping.
  - `TestGetUser_RequiresAuth` → 401 without token.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `Follow :exec` (`ON CONFLICT DO NOTHING`), `Unfollow :exec`, `IsFollowing :one`, `ListUsers :many` (LEFT JOIN count, `ORDER BY follower_count DESC, lower(display_name), id`). Caller must have called `/v1/me` first; if caller has no `users` row, `Follow` upserts it (FK safety).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(backend): users list, profiles and follow`

### Task 6: Stories

**Files:**
- Create: `backend/internal/db/queries/stories.sql`, `backend/internal/stories/handler.go`, `backend/internal/stories/cursor.go`
- Modify: `backend/internal/server/router.go`
- Test: `backend/internal/stories/handler_test.go`, `backend/internal/stories/cursor_test.go`

**Interfaces:**
- Consumes: `users.ValidImageURL`, `store.IsFollowing`, `notify.Notifier` (interface defined here first, impl in Task 7)
- Produces:
  - `notify.Notifier` interface `{ StoryCreated(ctx context.Context, storyID uuid.UUID) }` and `notify.Noop{}` (in `internal/notify/notify.go`)
  - `stories.StoryJSON{ID, Title, Type, Description, ImageURL string; CreatedAt time.Time; Location struct{ID, VenueName string}; Owner struct{ID, DisplayName, PhotoURL string}}`
  - list response `{"items":[...], "nextCursor": "<opaque>|null"}`
  - `stories.EncodeCursor(t time.Time, id uuid.UUID) string`, `stories.DecodeCursor(s string) (time.Time, uuid.UUID, error)` (base64url of `RFC3339Nano|uuid`)

- [ ] **Step 1: Write failing tests:**
  - `TestCreateStory_PicksNearestLocation` — locations A (21.03,105.85), B (16.05,108.20); post at (16.06,108.21) → 201, `location.id == B`.
  - `TestCreateStory_NoLocations` → 422, zero rows in `stories`.
  - `TestCreateStory_ForeignImageURL` → 400; missing title → 400; lat 91 → 400.
  - `TestCreateStory_NotifiesOnce` — fake notifier records exactly one `StoryCreated` with the new id.
  - `TestLocationStories_NewestFirstWithCursor` — 3 stories, `limit=2` → 2 items + cursor; next page → 1 item, `nextCursor == null`; two stories with identical `created_at` both appear exactly once.
  - `TestUserStories_FollowGate` — u1 not following u2 → 403 with no `items`; after follow → 200; u2 reading own → 200.
  - `TestDecodeCursor_Garbage` → error; handler maps to 400.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `NearestLocation :one` (`ORDER BY geog <-> ST_SetSRID(ST_MakePoint(lng, lat),4326)::geography LIMIT 1`), `CreateStory :one`, `ListStoriesByLocation :many` / `ListStoriesByOwner :many` (keyset `(created_at, id) < ($cursor_time, $cursor_id)`, join users + locations). Title 1..100 runes, description ≤ 2000, type ≤ 50. Call `Notifier.StoryCreated` after commit in a goroutine with `context.WithoutCancel` + 10 s timeout. Routes: `POST /v1/stories`, `GET /v1/locations/{id}/stories` (public), `GET /v1/users/{id}/stories` (required).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(backend): create and list stories`

### Task 7: Devices and FCM push

**Files:**
- Create: `backend/internal/db/queries/devices.sql`, `backend/internal/devices/handler.go`, `backend/internal/notify/fcm.go`
- Modify: `backend/internal/server/router.go`, `backend/cmd/api/main.go`
- Test: `backend/internal/devices/handler_test.go`, `backend/internal/notify/fcm_test.go`

**Interfaces:**
- Consumes: `notify.Notifier`
- Produces:
  - `notify.Sender` interface `{ SendEachForMulticast(ctx, *messaging.MulticastMessage) (*messaging.BatchResponse, error) }` (satisfied by `*messaging.Client`)
  - `notify.NewFCM(q *store.Queries, s notify.Sender, log *slog.Logger) *notify.FCM` implementing `Notifier`

- [ ] **Step 1: Write failing tests:**
  - `TestRegisterDevice_Upsert` — `POST /v1/me/devices {"token":"t1","platform":"android"}` as u1 → 204; same token as u2 → 204 and row now owned by u2 (shared device, new login). `platform:"pc"` → 400.
  - `TestDeleteDevice_OnlyOwn` — u2 deleting u1's token → 204 but row remains.
  - `TestFCM_SendsToFollowersOnly` — u2 posts; followers u1, u3 have tokens; non-follower u4 has token → fake sender receives tokens `{t1,t3}`, body `"<u2 name> has just posted a new story."`, data per Global Constraints.
  - `TestFCM_PrunesUnregisteredTokens` — fake response marks t1 `registration-token-not-registered` → t1 deleted, t3 kept.
  - `TestFCM_ChunksOver500` — 501 follower tokens → 2 sender calls.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `UpsertDevice`, `DeleteDevice` (`WHERE token = $1 AND user_id = $2`), `FollowerTokens :many`, `DeleteTokens :exec`. Use `messaging.IsUnregistered` on each failed response. In `main.go`: `AUTH_MODE=fake` → `notify.Noop{}`, else FCM.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(backend): register devices and push new stories via fcm`

### Task 8: Locations seed

No real users exist, so only places are carried over (spec: "Seed command").

**Files:**
- Create: `backend/seed/locations.json`, `backend/internal/seed/seed.go`, `backend/cmd/seed/main.go`, `backend/internal/db/queries/seed.sql`
- Test: `backend/internal/seed/seed_test.go`

**Interfaces:**
- Produces:
  - JSON format: array of `{"key","venueName","venueLocation","description","imageUrl","lat","lng"}` — same field names as the old Firestore docs where they exist (`key` = old doc id or a slug)
  - `seed.Load(r io.Reader) ([]seed.Location, error)` — validates every row before anything is written
  - `seed.Apply(ctx, pool *pgxpool.Pool, locs []seed.Location) (inserted, updated int, err error)` — one transaction, upsert on `seed_key`
  - CLI: `go run ./cmd/seed [-file seed/locations.json] [-dry-run]`

- [ ] **Step 1: Write failing tests:**
  - `TestApply_Idempotent` — apply twice → second run `inserted == 0`, `updated == n`, row count unchanged.
  - `TestApply_UpdatesChangedRow` — change `venueName` for one key → row updated, uuid unchanged (stories keep pointing at it).
  - `TestLoad_RejectsBadRows` — missing `key`, duplicate `key`, `lat` 91, empty `venueName` → error naming the row index; nothing applied.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Commit `seed/locations.json` with 3 sample Vietnamese places (Hồ Gươm, Cầu Rồng, Bà Nà Hills) until the user exports real data.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(backend): seed locations from json`

### Task 9: Container, docs, Cloud Run deploy

**Files:**
- Create: `backend/Dockerfile`, `backend/.dockerignore`, `backend/README.md`
- Modify: `README.md` (repo root: add `backend/`), `CLAUDE.md` (Repo layout, Commands, Architecture: backend section)

- [ ] **Step 1:** Multi-stage `Dockerfile` (`golang:1.24` build, `CGO_ENABLED=0`, `gcr.io/distroless/static-debian12` runtime, non-root, `EXPOSE 8080`). Add `api` service to `compose.yaml` with `AUTH_MODE=fake`, `APP_ENV=dev`.
- [ ] **Step 2:** Verify: `docker compose up --build -d && curl -s localhost:8080/healthz` → `{"status":"ok"}`; `curl -s -H 'Authorization: Bearer fake:u1:+84900000001' localhost:8080/v1/me` → 200 with `"displayName":"user +84900000001"`.
- [ ] **Step 3:** README: setup, env table, `make dev`, `make test`, `go run ./cmd/seed`, deploy command (link `docs/setup/firebase-gcp.md` §7), API table copied from spec.
- [ ] **Step 4:** `go vet ./... && go test ./...` → PASS.
- [ ] **Step 5 (needs Phase 0 + Neon project):** deploy with the command in `docs/setup/firebase-gcp.md` §7b; seed via `DATABASE_URL='<neon direct url>' go run ./cmd/seed`. Verify: `curl -s https://<run-url>/healthz` → `{"status":"ok"}`; `curl -s https://<run-url>/v1/locations` → seeded places; `curl -s https://<run-url>/v1/me` → 401. Skip and report if Phase 0 is not done.
- [ ] **Step 6: Commit** `docs(backend): add dockerfile, setup and deploy docs`
