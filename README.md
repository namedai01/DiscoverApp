# MEMOPIN

Monorepo for Memopin.

```
apps/
  mobile/        Flutter app (package `memopin`, Android id `com.memopin.app`)
  web/           Next.js 16 web client (TypeScript, Tailwind, pnpm)
backend/         Go API (Postgres + PostGIS, Firebase Auth, FCM)
packages/
  wemapgl/       Vendored legacy WeMap SDK, reference only (the app does not use it)
docs/
  setup/         Firebase / GCP setup and Cloud Run deploy
  superpowers/   Platform design spec and implementation plans
```

Each project is self-contained: run its commands from inside its own directory.

## Requirements

| Project | Needs |
| --- | --- |
| `backend/` | Go 1.24 (`GOTOOLCHAIN=local`), Docker |
| `apps/mobile/` | Flutter 3.47+ (Dart 3.13+), Android SDK (minSdk 23) or Xcode |
| `apps/web/` | Node 24+, pnpm |

Local development needs no Firebase project: the backend and the web client both have a dev-only fake auth mode. The mobile app always uses real Firebase.

## Features

Memopin lets users browse places, post photo stories tied to a place, follow other users, and see places on a map. Data lives behind the Go API in `backend/` (Postgres); Firebase provides phone sign-in, photo storage and push (Auth, Storage, Cloud Messaging). There is no Firestore. The mobile app has 5 tabs: Explore, People, Maps, Create Story, My Profile; the web client covers the same features except push.

### Explore places

- Horizontal card list of all places, sorted by name. Each card shows cover photo, name, area and story count (refreshed on reload, not live).
- Search by name prefix (case-insensitive).
- Place details: full-screen cover, then description and "Local stories" (newest first).
- Story view: photo, title, type, description, posted time.

### People and following

- User list sorted by follower count, with search by display name.
- Public profile with Follow / Unfollow and follower count.
- A user's story timeline is visible only after you follow them.
- Viewing profiles requires sign-in.

### Create story

- Pick a photo from the gallery, enter title, type and description.
- The story is attached automatically to the nearest place, based on current GPS location (location permission required).
- Photo is uploaded to Firebase Storage; the story is then posted to the API.

### Map

- OpenStreetMap map (`flutter_map`) with one marker per place; tap a marker to open its details.
- Pick a place from the dropdown to move the camera there, then "Direction" opens an external maps app for routing. There is no in-app routing.

### Account and app

- Phone number sign-in with SMS code. The API creates the profile on first sign-in (default display name `user <first 6 chars of uid>`).
- My Profile: change display name and avatar, see follower count and own stories, sign out.
- Push notification (FCM, sent by the backend) when someone you follow posts a new story; the app registers its device token after sign-in and removes it on sign-out. The Android app shows pushes that arrive in the foreground as a local notification.
- Accent color theme (Yellow, Red, Blue, Green, Pink), saved on device.
- "No internet" dialog when the connection drops.

### Not yet supported

Likes, comments, editing or deleting stories, in-app routing, live (realtime) updates, widget and integration tests.

### Tests

`cd apps/mobile && flutter test` runs unit tests for the API client, API calls and models, the cursor pager, input validators, the story submitter, Storage upload paths, push registration, map helpers, time/follower formatting and the network image widget. They need no Firebase project, device or network.

## Backend

Go HTTP API in `backend/`: places, stories, follows and FCM device tokens, backed by Postgres (PostGIS) and Firebase Auth.

```bash
cd backend
cp .env.example .env
make dev      # Postgres in Docker + API on :8080
make test     # needs Docker
```

See `backend/README.md` for configuration, seed data, the API table and the Cloud Run deploy.

## Mobile app

```bash
cd apps/mobile
cp .env.example .env
flutter pub get
flutter run
```

Requires Flutter 3.47+ (Dart 3.13+). See `apps/mobile/README.md`.

## Web app

```bash
cd apps/web
cp .env.example .env.local
pnpm install
pnpm dev      # http://localhost:3000, expects the backend on :8080
```

Next.js client for browsing places, posting stories, following people and the map. Routes: `/` (places), `/places/[id]` (server-rendered, with Open Graph metadata), `/people`, `/u/[id]`, `/map`, `/post`, `/me`, `/signin`. For development, run the backend with `AUTH_MODE=fake` and use the fake sign-in. See `apps/web/README.md` for the environment variables, commands, `pnpm e2e` and what a deploy needs.

## Docs

- `docs/setup/firebase-gcp.md`: create the Firebase project, phone auth, Storage, FCM, Postgres and the Cloud Run deploy.
- `docs/superpowers/specs/2026-10-17-platform-design.md`: platform design (Go backend, Postgres, web client).
- `docs/superpowers/plans/`: implementation plans for the backend, the mobile API migration and the web client.
- `CLAUDE.md`: architecture notes and gotchas for each project.

## Status

- Backend, mobile and web are implemented and tested locally; nothing is deployed yet and there is no CI.
- The Android build fails until `flutterfire configure` is run against the Memopin Firebase project: the committed `android/app/google-services.json` is from the old project. iOS has no `GoogleService-Info.plist` in the repo.
- Public OpenStreetMap tiles are for development only; set `MAP_TILE_URL` (mobile) and `NEXT_PUBLIC_MAP_TILE_URL` (web) to a hosted provider before release.
- Web hosting is not chosen yet.
