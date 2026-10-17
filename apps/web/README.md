# Memopin web

Next.js (App Router) web client for the Memopin API: browse places, post photo stories, follow people, and see places on a map. It talks to the Go backend in `../../backend` and uses Firebase Auth (phone) and Firebase Storage in production.

## Setup

```bash
cd apps/web
cp .env.example .env.local
pnpm install
```

Run the backend with fake auth (`AUTH_MODE=fake`) in another terminal:

```bash
cd backend
cp .env.example .env     # AUTH_MODE=fake, CORS_ORIGINS includes http://localhost:3000
make dev                 # Postgres in Docker + API on :8080
```

Then `pnpm dev` and open http://localhost:3000. Seed a few places with `go run ./cmd/seed` from `backend/` (or, with Docker only, `docker compose run --rm --entrypoint /app/bin/seed api`).

Requires Node 24+ and pnpm.

## Environment

Every variable is public (inlined into the browser bundle); never put secrets here. Only `src/lib/env.ts` reads them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | Backend base URL (trailing `/` stripped) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `metadataBase` and Open Graph URLs |
| `NEXT_PUBLIC_AUTH_MODE` | `firebase` | `fake` or `firebase` (see below) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | | Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | | Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | | Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | | Must equal the backend `STORAGE_BUCKET`; `.env.example` ships `memopin-app.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | | Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | | Firebase web app config |
| `NEXT_PUBLIC_MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Tile layer; use a hosted provider for real traffic |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors` | Tile attribution (HTML; keep the OSM link when using OSM tiles) |
| `NEXT_PUBLIC_MAP_INITIAL_LAT` | `21.03` | Initial map center |
| `NEXT_PUBLIC_MAP_INITIAL_LNG` | `105.78` | Initial map center |
| `NEXT_PUBLIC_MAP_INITIAL_ZOOM` | `5` | Initial map zoom |

## Fake vs firebase auth

- `firebase`: phone-number sign-in with SMS code, photos uploaded to Firebase Storage under `uploads/{uid}/`. This is the only mode a production build accepts.
- `fake`: development only, pairs with backend `AUTH_MODE=fake`. Sign in with any user id (`A-Z a-z 0-9 _ -`, up to 64 characters); the token is `fake:<uid>:`. Uploads are simulated: no file is stored, the app sends a Storage-shaped URL that the backend accepts, so images show placeholders. `next build` and `next start` throw if `NEXT_PUBLIC_AUTH_MODE=fake`, and production bundles contain no fake-auth code.

## Commands

```bash
pnpm dev         # dev server on :3000
pnpm lint
pnpm typecheck
pnpm test        # vitest
NEXT_PUBLIC_AUTH_MODE=firebase pnpm build
pnpm e2e         # Playwright smoke
```

`pnpm e2e` needs the backend running with `AUTH_MODE=fake` and seeded places. It starts `pnpm dev` itself (or reuses a server on :3000) with fake auth, and needs Chromium once: `pnpm exec playwright install chromium`.

## What a deploy needs

- Build with `NEXT_PUBLIC_AUTH_MODE=firebase` and every `NEXT_PUBLIC_*` value above set for the target environment (the Firebase values from the web app config, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`). They are inlined at build time.
- Add the web origin to the backend `CORS_ORIGINS`.
- Add the web domain to Firebase Auth authorized domains.
- Hosting is not chosen yet; `pnpm build` then `pnpm start` runs the production server.

## Out of scope

- Web push notifications (no FCM web SDK, service worker, or device registration).
- Story pages: the backend has no `GET /v1/stories/{id}`, so a story opens in a dialog from any story list instead of its own URL.
