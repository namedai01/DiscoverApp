# Web Client (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/web`, a Next.js client for Memopin that serves public, server-rendered place pages and gives signed-in users the mobile app's features (profile, people, follow, timelines, post a story, map) through the Phase 1 Go API.

**Prerequisite:** Phase 1 backend runs locally (`cd backend && make dev`, `AUTH_MODE=fake`). Tasks 1–9 need no Firebase project (fake mode). Real phone sign-in and real uploads need Phase 0 (`docs/setup/firebase-gcp.md` §3–§5, web app registered in §4). Task 10's Playwright smoke needs a seeded backend (backend plan Task 8 `go run ./cmd/seed`).

**Architecture:** Standalone pnpm project in `apps/web` (Next.js App Router, React Server Components). Public pages (`/`, `/places/[id]`) are server components that call the API without a token. Everything signed-in is client-rendered: an `AuthProvider` wraps a swappable `AuthClient` (Firebase phone auth, or a dev-only fake client), and an `ApiProvider` hands components one typed `Api` object that attaches the ID token. Images go straight from the browser to Firebase Storage; only the download URL reaches the API.

**Tech Stack:** Next.js 16 (App Router, TypeScript strict), React 19.2, Tailwind CSS 4, Firebase JS SDK 12 (Auth + Storage), Leaflet 1.9 + react-leaflet 5, Vitest 3 + Testing Library + jsdom, Playwright (smoke), pnpm, Node 24.

**Spec:** `docs/superpowers/specs/2026-10-17-platform-design.md` (Web section, API table). API as built: `backend/internal/server/router.go` and `backend/internal/{users,locations,follows,stories,devices}/`. Feature parity: `README.md` "Features", `apps/mobile/lib/pages/*`.

## Decided

- `/stories/[id]` is **dropped** this phase: the backend has no `GET /v1/stories/{id}`. A story opens in a dialog from any story list (photo, title, type, description, posted time, place link). Shareable story pages wait for that endpoint (spec feature 6).
- `/u/[id]` is client-rendered and requires sign-in (`GET /v1/users/{id}` requires a token). `/people` is client-rendered and public (`GET /v1/users` is public) but `noindex`.
- Push notifications on web are **out of scope** (no FCM web SDK, no service worker, `POST /v1/me/devices` unused).
- Web deployment target is not chosen by the spec; this plan ends at a passing production build. `apps/web/README.md` lists what a deploy needs.
- Fake auth mode has no Storage: uploads are simulated (see Global Constraints) and images render as placeholders.

## Global Constraints

- Project root `apps/web/`; run every command from there. No root workspace; `apps/web` has its own `package.json`, lockfile and `.gitignore`.
- Exact version pins (no `^`/`~`; add `save-exact=true` to `apps/web/.npmrc`): `next 16.0.10`, `react 19.2.3`, `react-dom 19.2.3`, `firebase 12.4.0`, `leaflet 1.9.4`, `react-leaflet 5.0.0`; dev: `typescript 5.9.3`, `@types/node 24.6.0`, `@types/react 19.2.2`, `@types/react-dom 19.2.2`, `@types/leaflet 1.9.20`, `tailwindcss 4.1.13`, `@tailwindcss/postcss 4.1.13`, `eslint 9.37.0`, `eslint-config-next 16.0.10`, `vitest 3.2.4`, `@vitejs/plugin-react 5.0.4`, `jsdom 26.1.0`, `@testing-library/react 16.3.0`, `@testing-library/dom 10.4.1`, `@testing-library/jest-dom 6.9.1`, `@testing-library/user-event 14.6.1`, `@playwright/test 1.55.1`. Check each with `pnpm view <pkg>@<ver> version` first; if one does not resolve, use the newest patch of the same minor published before 2026-10-03 and name the substitution in the commit message. If `pnpm audit --prod` reports a high/critical advisory for `next` or `react`, take the newest patched release of the same minor that is ≥ 2 weeks old.
- `"packageManager": "pnpm@12.11.2"`, `"engines": {"node": ">=24"}`. If pnpm reports ignored build scripts, approve only `esbuild` and `sharp` (`pnpm approve-builds`) and commit the resulting config.
- Next 16 rules: route `params`/`searchParams` are Promises (`const { id } = await params`); no `next lint` (use `eslint .` with flat config from `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`); `next/dynamic` with `ssr: false` only inside client components.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, path alias `@/*` → `src/*`.
- Scripts: `dev` `next dev`, `build` `next build`, `start` `next start`, `lint` `eslint .`, `typecheck` `tsc --noEmit`, `test` `vitest run`, `e2e` `playwright test`.
- Verification set (every task ends green on all four): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `NEXT_PUBLIC_AUTH_MODE=firebase pnpm build`.
- Env (all public, listed in committed `.env.example`; local copy `.env.local` is gitignored — template `.gitignore` has `.env*`, add `!.env.example`):
  `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080`, trailing `/` stripped), `NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`, used for `metadataBase` and OG URLs), `NEXT_PUBLIC_AUTH_MODE` (`fake` | `firebase`, default `firebase`), `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` (web app config from setup guide §4), `NEXT_PUBLIC_MAP_TILE_URL` (default `https://tile.openstreetmap.org/{z}/{x}/{y}.png`), `NEXT_PUBLIC_MAP_ATTRIBUTION` (default `OpenStreetMap contributors`), `NEXT_PUBLIC_MAP_INITIAL_LAT` (21.03), `NEXT_PUBLIC_MAP_INITIAL_LNG` (105.78), `NEXT_PUBLIC_MAP_INITIAL_ZOOM` (5). `.env.example` ships `NEXT_PUBLIC_AUTH_MODE=fake` and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=memopin-app.firebasestorage.app` (must equal backend `STORAGE_BUCKET`).
- Next inlines `NEXT_PUBLIC_*` only on literal access: read each as `process.env.NEXT_PUBLIC_X` in `src/lib/env.ts` only; no other file reads `process.env.NEXT_PUBLIC_*`.
- Never put `DATABASE_URL` or any secret in web env (setup guide §8).
- Fake mode is impossible in production: `next.config.ts` (phase `PHASE_PRODUCTION_BUILD` or `PHASE_PRODUCTION_SERVER`) throws `NEXT_PUBLIC_AUTH_MODE=fake is not allowed in a production build`; `parsePublicEnv` throws the same when `nodeEnv === "production"`; fake modules are only reached through `if (process.env.NODE_ENV !== "production" && publicEnv.authMode === "fake")` + dynamic `import()`, so production bundles contain no `fake:` token code.
- Fake token: `fake:<uid>:` (empty phone). Fake uid: `^[A-Za-z0-9_-]{1,64}$`, stored in `localStorage["memopin.fakeUid"]`.
- API contract (as built): JSON camelCase; error body `{"error":{"code","message"}}`, codes `bad_request|unauthorized|forbidden|not_found|conflict|unprocessable|internal` (503 auth-unavailable also uses `internal`); `GET /v1/locations` and `GET /v1/users` return `{"items":[...]}` with `limit` (default 20, max 100) + `offset` and no total; story lists return `{"items":[...],"nextCursor": string|null}`; follow/unfollow → 204 (idempotent; self → 400; unknown → 404); `GET /v1/users/{id}/stories` → 404 unknown user, 403 not self and not following; `POST /v1/stories` → 201 story, 422 when no locations exist, 400 on validation.
- Input limits mirror the backend, counted in Unicode code points (`[...s].length`), after trimming where the backend trims: `displayName` trimmed 1–50; story `title` trimmed 1–100, `type` ≤ 50, `description` ≤ 2000; search `q` trimmed, cut to 100.
- Storage object path: `uploads/{uid}/{crypto.randomUUID()}.jpg`, content type `image/jpeg`, ≤ 5 MiB (storage rule). Fake uploader returns `https://firebasestorage.googleapis.com/v0/b/<NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET>/o/uploads%2F<uid>%2F<uuid>.jpg?alt=media` without uploading.
- Directions URL (same as mobile `directionsUri`): `https://www.google.com/maps/dir/?api=1&destination=<lat>%2C<lng>`, opened with `target="_blank" rel="noopener noreferrer"`.
- Accent colors (from `apps/mobile/lib/logic/theme_chooser.dart`): Yellow `#EAC21E` (default), Red `#ff3f20`, Blue `#00aeff`, Green `#00d000`, Pink `#ff00a8`; stored in `localStorage["memopin.accent"]`; exposed as CSS var `--accent` and Tailwind color `accent`. Accent is a background with `text-neutral-900` on top (yellow fails contrast as text).
- Design: mobile-first, Tailwind utilities only, no component library. Nav: Explore `/`, People `/people`, Map `/map`, Post `/post`, Me `/me` — fixed bottom bar below `md`, top bar from `md`.
- Images: plain `<img>` only through `RemoteImage` (seed `imageUrl`s are arbitrary hosts); that file alone disables `@next/next/no-img-element`.
- Client pages are a server `page.tsx` that exports `metadata` (`robots: { index: false }` for `/people`, `/u/*`, `/me`, `/post`, `/signin`) and renders one client component.
- Backend CORS: `CORS_ORIGINS` must include `http://localhost:3000` (already in `backend/.env.example`); a deployed web origin must be added there and to Firebase Auth authorized domains.
- Copy: English, sentence case. Exact strings are given in the tasks where tests pin them.
- Do not modify anything under `backend/` or `apps/mobile/`.

## Review Focus

1. Firebase ID token expires mid-session → the API's 401 triggers one forced token refresh and a retry; a second 401 signs the user out with "Your session expired. Sign in again." — never a retry loop. (Task 2, Task 5)
2. Browser location denied, timed out, unavailable, or page served from an insecure origin → a specific message, nothing uploaded or posted, form values kept. (Task 8)
3. A phone photo larger than 5 MiB, a non-image, or a format the browser cannot decode (HEIC in Chrome) → downscaled to a JPEG ≤ 5 MiB or a clear message; never a raw Storage permission error. (Task 7, Task 8)
4. Backend down, or a non-JSON 502 from a proxy, during SSR or a client call → typed `internal`/`network` error and the "Try again" boundary; unknown or malformed place id → the 404 page, not a 500. (Task 2, Task 4)
5. Double click on Follow, Save, or Post → exactly one request in flight, button disabled until it settles. (Task 6, Task 7, Task 8)

---

## File Structure

```
apps/web/
  package.json, pnpm-lock.yaml, .npmrc, tsconfig.json, next.config.ts, postcss.config.mjs,
  eslint.config.mjs, vitest.config.mts, playwright.config.ts, .env.example, .gitignore, README.md
  src/app/
    layout.tsx, globals.css, error.tsx, not-found.tsx, robots.ts
    page.tsx                         / places list + search (SSR)
    places/[id]/page.tsx             place + local stories (SSR, Open Graph)
    map/page.tsx                     map (client MapScreen)
    people/page.tsx                  people list (client)
    u/[id]/page.tsx                  public profile + timeline (client, signed in)
    me/page.tsx                      own profile (client, signed in)
    post/page.tsx                    create story (client, signed in)
    signin/page.tsx                  phone or fake sign-in (client)
  src/lib/
    env.ts                           parsePublicEnv, publicEnv, missingFirebaseKeys
    accent.ts                        ACCENTS, loadAccent, applyAccent
    format.ts                        timeAgo, formatFollowers, directionsUrl, truncate, codePoints
    paging.ts                        PageResult, cursorPages, offsetPages, mergeById, usePagedList
    seo.ts                           buildPlaceMetadata
    safe-next.ts                     safeNext
    geo.ts                           getCurrentPosition, GeoError, geoErrorMessage
    upload.ts                        validateImageFile, prepareUpload, fakeUploader, getUploader
    upload-firebase.ts               firebaseUploader
    firebase.ts                      getFirebaseApp/Auth/Storage
    api/types.ts, api/errors.ts, api/client.ts, api/server.ts, api/context.tsx
    auth/types.ts, auth/fake-client.ts, auth/firebase-client.ts, auth/index.ts, auth/context.tsx, auth/phone.ts
  src/components/
    NavBar.tsx, OfflineBanner.tsx, AccentInit.tsx, AccentPicker.tsx, RemoteImage.tsx, Avatar.tsx,
    SearchForm.tsx, PlaceCard.tsx, PlaceGrid.tsx, StoryCard.tsx, StoryList.tsx, StoryDialog.tsx,
    RequireAuth.tsx, FakeSignIn.tsx, PhoneSignIn.tsx, PeopleList.tsx, UserRow.tsx, UserProfile.tsx,
    FollowButton.tsx, UserTimeline.tsx, MyProfile.tsx, CreateStoryForm.tsx,
    map/MapScreen.tsx, map/MapView.tsx, map/LocationPicker.tsx, map/fetch-all.ts
  src/test/setup.ts, src/test/render.tsx, src/test/fixtures.ts
  e2e/smoke.spec.ts
```

Tests live next to their unit as `*.test.ts(x)`.

---

### Task 1: Scaffold, env, app shell

**Files:**
- Create: `apps/web/` via `pnpm create next-app@16.0.10 apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm` (run from repo root), then: `.npmrc`, `.env.example`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `src/lib/env.ts`, `src/lib/accent.ts`, `src/components/NavBar.tsx`, `src/components/OfflineBanner.tsx`, `src/components/AccentInit.tsx`, `src/test/setup.ts`, `src/test/render.tsx`
- Modify: `package.json` (pins, scripts, `packageManager`, `engines`), `tsconfig.json`, `.gitignore`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder heading "Memopin"); delete template SVGs in `public/`
- Test: `src/lib/env.test.ts`, `src/lib/accent.test.ts`, `src/components/NavBar.test.tsx`, `src/components/OfflineBanner.test.tsx`

**Interfaces:**
- Produces:
  - `type AuthMode = "fake" | "firebase"`; `type FirebaseWebConfig = { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId: string }`
  - `type PublicEnv = { apiBaseUrl: string; siteUrl: string; authMode: AuthMode; firebase: FirebaseWebConfig; map: { tileUrl: string; attribution: string; initialLat: number; initialLng: number; initialZoom: number } }`
  - `parsePublicEnv(raw: Record<string, string | undefined>, nodeEnv: string | undefined): PublicEnv` (keys are the full `NEXT_PUBLIC_*` names); `publicEnv: PublicEnv` (module constant built from literal accesses); `missingFirebaseKeys(cfg: FirebaseWebConfig): string[]` (env names of empty fields)
  - `ACCENTS: Record<AccentName, string>`, `type AccentName = "Yellow" | "Red" | "Blue" | "Green" | "Pink"`, `loadAccent(): AccentName`, `applyAccent(name: AccentName): void`
  - `NavBar()`, `OfflineBanner()`, `AccentInit()` (calls `applyAccent(loadAccent())` in an effect, renders nothing)
  - `renderWithProviders(ui, opts?)` in `src/test/render.tsx` — grows in Tasks 2 and 5; here it is `render` re-exported.
  - Tailwind color `accent` (`@theme inline { --color-accent: var(--accent); }`, `:root { --accent: #EAC21E; }`)

- [ ] **Step 1: Scaffold and pin.** Run create-next-app, replace all versions with the Global Constraints pins, set scripts/`packageManager`/`engines`, `pnpm install`. `vitest.config.mts`: `@vitejs/plugin-react`, `environment: "jsdom"`, `setupFiles: ["src/test/setup.ts"]` (imports `@testing-library/jest-dom/vitest`, runs `cleanup` and `localStorage.clear()` after each), alias `@` → `src`, `exclude: ["e2e/**", "node_modules/**"]`. `eslint.config.mjs` ignores `.next/**`, `next-env.d.ts`, `playwright-report/**`, `test-results/**`.
- [ ] **Step 2: Write failing tests:**
  - `parsePublicEnv defaults` — `parsePublicEnv({}, "development")` → `apiBaseUrl "http://localhost:8080"`, `authMode "firebase"`, `map` `{ tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "OpenStreetMap contributors", initialLat: 21.03, initialLng: 105.78, initialZoom: 5 }`.
  - `parsePublicEnv strips trailing slash` — `NEXT_PUBLIC_API_BASE_URL: "https://api.x/"` → `"https://api.x"`.
  - `parsePublicEnv rejects fake in production` — `{ NEXT_PUBLIC_AUTH_MODE: "fake" }, "production"` → throws `/not allowed in a production build/`; same with `"development"` → `authMode "fake"`.
  - `parsePublicEnv rejects unknown mode` — `"magic"` → throws `/NEXT_PUBLIC_AUTH_MODE must be fake or firebase/`.
  - `parsePublicEnv bad map numbers fall back` — `NEXT_PUBLIC_MAP_INITIAL_LAT: "abc"` → `21.03`.
  - `missingFirebaseKeys` — config with empty `apiKey` and `appId` → `["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_APP_ID"]`.
  - `loadAccent` — nothing stored → `"Yellow"`; stored `"Purple"` → `"Yellow"`; `applyAccent("Blue")` → `document.documentElement.style.getPropertyValue("--accent") === "#00aeff"` and storage `"Blue"`; a throwing `localStorage` (spy) → no throw, `"Yellow"`.
  - `NavBar marks the active route` — mock `next/navigation` `usePathname` → `"/people"`; link "People" has `aria-current="page"`, "Explore" does not; five links with hrefs `/`, `/people`, `/map`, `/post`, `/me`.
  - `OfflineBanner` — hidden initially; `window.dispatchEvent(new Event("offline"))` → text "You're offline. Some content may be out of date."; `online` event → hidden.
- [ ] **Step 3:** `pnpm test` → FAIL (modules missing).
- [ ] **Step 4: Implement.** `next.config.ts` exports `(phase) => config` with the fake-mode guard, `reactStrictMode: true`, `poweredByHeader: false`. `layout.tsx`: `metadataBase: new URL(publicEnv.siteUrl)`, title template `%s · Memopin`, default "Memopin — places and stories"; body renders `AccentInit`, `OfflineBanner`, `NavBar`, `<main>` padded so the bottom bar never covers content.
- [ ] **Step 5:** `pnpm test` → PASS; `pnpm lint && pnpm typecheck` → clean.
- [ ] **Step 6: Verify the build guard.** `NEXT_PUBLIC_AUTH_MODE=firebase pnpm build` → succeeds. `NEXT_PUBLIC_AUTH_MODE=fake pnpm build` → fails with `NEXT_PUBLIC_AUTH_MODE=fake is not allowed in a production build`.
- [ ] **Step 7: Commit** `feat(web): scaffold next.js app with env guard and app shell`

### Task 2: Typed API module

**Files:**
- Create: `src/lib/api/types.ts`, `src/lib/api/errors.ts`, `src/lib/api/client.ts`, `src/lib/api/server.ts`, `src/lib/api/context.tsx`, `src/test/fixtures.ts`
- Modify: `src/test/render.tsx` (accept `api?: Partial<Api>`)
- Test: `src/lib/api/client.test.ts`

**Interfaces:**
- Consumes: `publicEnv.apiBaseUrl`
- Produces:
  - Types: `Location { id, venueName, venueLocation, description, imageUrl: string; lat, lng, storyCount: number }`; `User { id, displayName, photoUrl: string; followerCount: number; isFollowing?: boolean }`; `UserWithFollow = User & { isFollowing: boolean }`; `Story { id, title, type, description, imageUrl, createdAt: string; location: { id, venueName: string }; owner: { id, displayName, photoUrl: string } }`; `ListPage<T> = { items: T[] }`; `CursorPage<T> = { items: T[]; nextCursor: string | null }`; `NewStory = { title, type, description, imageUrl: string; lat, lng: number }`; `MePatch = { displayName?: string; photoUrl?: string }`
  - `type ApiErrorCode = "bad_request" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "unprocessable" | "internal" | "network" | "unknown"`; `class ApiError extends Error { readonly status: number; readonly code: ApiErrorCode }`; `isApiError(e: unknown, code?: ApiErrorCode): e is ApiError`
  - `type ApiOptions = { baseUrl: string; getToken?: (forceRefresh: boolean) => Promise<string | null>; onUnauthorized?: () => void; fetchImpl?: typeof fetch; init?: RequestInit }`
  - `createApi(opts: ApiOptions): Api` where `Api` = `{ listLocations(p?: { q?: string; limit?: number; offset?: number }): Promise<ListPage<Location>>; getLocation(id: string): Promise<Location>; listLocationStories(id: string, p?: { cursor?: string | null; limit?: number }): Promise<CursorPage<Story>>; listUsers(p?: { q?: string; limit?: number; offset?: number }): Promise<ListPage<User>>; getMe(): Promise<User>; updateMe(patch: MePatch): Promise<User>; getUser(id: string): Promise<UserWithFollow>; listUserStories(id: string, p?: { cursor?: string | null; limit?: number }): Promise<CursorPage<Story>>; follow(id: string): Promise<void>; unfollow(id: string): Promise<void>; createStory(input: NewStory): Promise<Story> }`
  - `serverApi: Api` (`src/lib/api/server.ts`: no `getToken`, `init: { cache: "no-store" }`)
  - `ApiProvider({ api, children })`, `useApi(): Api` (`src/lib/api/context.tsx`, client)
  - Fixtures: `aLocation(overrides?)`, `aUser(overrides?)`, `aStory(overrides?)`, `cursorPage(items, nextCursor?)`

- [ ] **Step 1: Write failing tests** (fake `fetchImpl` returning `Response` objects):
  - `builds query and encodes path` — `listLocations({ q: "Hồ %_", limit: 24, offset: 0 })` requests `http://api/v1/locations?q=H%E1%BB%93+%25_&limit=24&offset=0` (via `URLSearchParams`); `q: "   "` and `undefined` params are omitted; `getUser("a/b")` requests `/v1/users/a%2Fb`.
  - `public calls send no Authorization` — `getLocation("l1")` with a `getToken` present still sends no header (public endpoints never ask for a token).
  - `authed calls send bearer` — `getMe()` with `getToken → "fake:u1:"` sends `Authorization: Bearer fake:u1:`; `createStory(x)` sends `POST`, `Content-Type: application/json`, body `JSON.stringify(x)`.
  - `authed call without token` — `getToken → null` → rejects `ApiError{ status: 401, code: "unauthorized", message: "Sign in to continue." }`, fetch not called.
  - `maps error body` — 403 `{"error":{"code":"forbidden","message":"follow this user to see their stories"}}` → `ApiError{403, "forbidden", "follow this user to see their stories"}`; unknown code `"teapot"` → `code "unknown"`.
  - `non-JSON 502` — body `<html>` status 502 → `ApiError{502, "internal", "Server error (502). Try again."}`.
  - `network failure` — fetch rejects `TypeError` → `ApiError{0, "network", "Can't reach the server. Check your connection."}`; an `AbortError` is rethrown unchanged.
  - `204 resolves undefined` — `follow("u2")` → `PUT /v1/users/u2/follow`, resolves `undefined`; `unfollow` uses `DELETE`.
  - `retries once with a refreshed token then calls onUnauthorized` — first 401 → `getToken(true)` called, request retried once; second 401 → `onUnauthorized` called once, rejects `unauthorized`; total fetch calls 2.
- [ ] **Step 2:** `pnpm test src/lib/api` → FAIL.
- [ ] **Step 3: Implement** `createApi` with one private `request<T>(method, path, { query?, body?, auth: boolean })`; public endpoints: `listLocations`, `getLocation`, `listLocationStories`, `listUsers`; all others `auth: true`. `serverApi` and `ApiProvider` are thin.
- [ ] **Step 4:** `pnpm test src/lib/api` → PASS; verification set green.
- [ ] **Step 5: Commit** `feat(web): add typed api client`

### Task 3: Paging and formatting helpers

**Files:**
- Create: `src/lib/paging.ts`, `src/lib/format.ts`
- Test: `src/lib/paging.test.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Consumes: `ListPage`, `CursorPage` (Task 2)
- Produces:
  - `type PageResult<T> = { items: T[]; next: string | null }`; `type PageFetcher<T> = (next: string | null) => Promise<PageResult<T>>`
  - `cursorPages<T>(fn: (cursor: string | null) => Promise<CursorPage<T>>): PageFetcher<T>`
  - `offsetPages<T>(fn: (offset: number, limit: number) => Promise<ListPage<T>>, limit: number): PageFetcher<T>` — `next` is `String(offset + limit)` when a full page came back, else `null`
  - `mergeById<T extends { id: string }>(a: T[], b: T[]): T[]`
  - `usePagedList<T extends { id: string }>(fetcher: PageFetcher<T>, opts: { key: string; initial?: PageResult<T> }): { items: T[]; hasMore: boolean; loading: boolean; error: unknown; loadMore(): void; reload(): void }` — without `initial` it fetches the first page on mount and on `key` change
  - `timeAgo(iso: string, now?: Date): string`, `formatFollowers(n: number): string`, `directionsUrl(lat: number, lng: number): string`, `truncate(s: string, max: number): string`, `codePoints(s: string): number`

- [ ] **Step 1: Write failing tests:**
  - `mergeById keeps first occurrence` — `[a,b] + [b',c]` → `[a,b,c]`.
  - `offsetPages` — limit 2: call with `null` → `fn(0, 2)`; 2 items → `next "2"`; call with `"2"` → `fn(2, 2)`; 1 item → `next null`.
  - `cursorPages` — `{ items, nextCursor: null }` → `{ items, next: null }`; passes cursor through.
  - `usePagedList seeds from initial` (renderHook) — `initial { items:[a], next:"c1" }` → no fetch on mount, `hasMore true`; `loadMore()` twice synchronously → fetcher called once with `"c1"`; result appended, deduped.
  - `usePagedList discards stale pages` — first fetch for key `"q=a"` pending; rerender with key `"q=b"`; resolve the first → items stay those of `"q=b"` only.
  - `usePagedList error keeps items` — loadMore rejects → `error` set, previous items kept, `loading false`; `reload()` clears error and refetches from `null`.
  - `timeAgo` with `now = 2026-10-17T12:00:00Z` — 30 s ago → `"Just now"`, 5 min → `"5m"`, 3 h → `"3h"`, 2 d → `"2d"`, 8 d → `"1w"`, 400 d → `"1y"` (mobile thresholds: ≥365 d years, ≥7 d weeks, ≥1 d days, ≥1 h, ≥1 min).
  - `formatFollowers` — `0 → "0 followers"`, `1 → "1 follower"`, `99999 → "99999 followers"`, `150000 → "150k followers"`, `2500000 → "2m followers"`, `3000000000 → "3b followers"`.
  - `directionsUrl(21.03, 105.85)` → `"https://www.google.com/maps/dir/?api=1&destination=21.03%2C105.85"`.
  - `truncate("abcdef", 4)` → `"abc…"`; shorter strings unchanged. `codePoints("Hồ😀")` → `3`.
- [ ] **Step 2:** `pnpm test src/lib/paging src/lib/format` → FAIL.
- [ ] **Step 3: Implement.** `usePagedList` tracks a request generation number in a ref; responses from an older generation are dropped; an in-flight ref blocks concurrent `loadMore`.
- [ ] **Step 4:** tests → PASS; verification set green.
- [ ] **Step 5: Commit** `feat(web): add paging and formatting helpers`

### Task 4: Public pages — places list, place page, story dialog

**Files:**
- Create: `src/app/places/[id]/page.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/robots.ts`, `src/lib/seo.ts`, `src/components/{RemoteImage,Avatar,SearchForm,PlaceCard,PlaceGrid,StoryCard,StoryList,StoryDialog}.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/lib/seo.test.ts`, `src/components/PlaceCard.test.tsx`, `src/components/RemoteImage.test.tsx`, `src/components/StoryList.test.tsx`, `src/components/PlaceGrid.test.tsx`, `src/app/places/[id]/page.test.ts`

**Interfaces:**
- Consumes: `serverApi`, `useApi`, `Location`, `Story`, `usePagedList`, `cursorPages`, `offsetPages`, `timeAgo`, `directionsUrl`, `truncate`, `publicEnv.siteUrl`
- Produces:
  - `RemoteImage({ src, alt, className? })` — placeholder when `src` is empty or the image errors
  - `Avatar({ src, name, size? })` — `RemoteImage` with initial-letter fallback
  - `SearchForm({ action, defaultValue, placeholder })` — GET form, input `name="q"`, works without JS
  - `PlaceCard({ location })`, `PlaceGrid({ initial: PageResult<Location>, query: string, pageSize: number })`
  - `StoryCard({ story, onOpen })`, `StoryDialog({ story, onClose })` (`role="dialog"`, `aria-modal`, Escape and backdrop close), `StoryList({ fetcher: PageFetcher<Story>, listKey: string, initial?: PageResult<Story>, empty: ReactNode })` — reused by Tasks 6 and 7
  - `buildPlaceMetadata(location: Location, siteUrl: string): Metadata`
  - `loadPlace(id: string, api?: Api): Promise<Location>` (in `places/[id]/page.tsx`, wrapped in React `cache`; `not_found` → `notFound()`, other errors rethrown)

- [ ] **Step 1: Write failing tests:**
  - `buildPlaceMetadata` — location `{ id:"l1", venueName:"Hồ Gươm", description: 200×"a", imageUrl:"https://img/x.jpg" }`, site `https://memopin.app` → `title "Hồ Gươm"`, `description` length 160 ending `…`, `openGraph.url "https://memopin.app/places/l1"`, `openGraph.images[0].url "https://img/x.jpg"`, `twitter.card "summary_large_image"`, `alternates.canonical "/places/l1"`; empty description → falls back to `venueLocation`; empty `imageUrl` → no `images`, `twitter.card "summary"`.
  - `loadPlace maps 404 to notFound` — api rejecting `ApiError(404,"not_found")` → `notFound` (mocked from `next/navigation` to throw `NEXT_NOT_FOUND`) is called; `ApiError(0,"network")` → rethrown.
  - `PlaceCard` — `storyCount 3` → "3 stories", `1` → "1 story", `0` → "No stories yet"; link href `/places/l1`; shows `venueLocation`.
  - `RemoteImage` — `src=""` renders placeholder `data-testid="image-placeholder"`; `fireEvent.error(img)` swaps to the placeholder.
  - `StoryList` — `initial { items:[s1], next:"c1" }` → one card and a "Load more" button; click → fetcher called with `"c1"`, second card shown, button gone when `next` is null; clicking a card opens a dialog showing the story description and an owner link `/u/<ownerId>`; Escape closes it.
  - `PlaceGrid` — `initial` of 24 items with `next "24"`, `query "hồ"` → "Load more" calls `api.listLocations({ q: "hồ", limit: 24, offset: 24 })`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.**
  - `/` — `searchParams: Promise<{ q?: string }>`; `q` trimmed, cut to 100; `serverApi.listLocations({ q, limit: 24 })`; `SearchForm` (placeholder "Search places"); empty states: `No places match "<q>".` / "No places yet."; grid of `PlaceCard`, 1 column → 2 (`sm`) → 3 (`lg`).
  - `/places/[id]` — `generateMetadata` and the page both call `loadPlace`; cover image, name, area, description, "Show on map" (`/map?place=<id>`), "Directions" (`directionsUrl`), "Local stories" `StoryList` seeded with `serverApi.listLocationStories(id, { limit: 12 })`; `?posted=1` shows "Your story was posted here.".
  - Story times: `<time dateTime={iso} suppressHydrationWarning>{timeAgo(iso)}</time>`.
  - `error.tsx` (client): "Something went wrong loading this page." + "Try again" (`reset`). `not-found.tsx`: "We couldn't find that page." + link "Back to places".
  - `robots.ts`: allow `/`, disallow `/me`, `/post`, `/signin`, `/u/`, `/people`.
- [ ] **Step 4:** tests → PASS; verification set green.
- [ ] **Step 5: Manual check (backend running and seeded):** `pnpm dev`; `curl -s localhost:3000/ | grep -c 'href="/places/'` → ≥ 1; `curl -s localhost:3000/places/<id> | grep 'og:title'` → venue name; `curl -s -o /dev/null -w '%{http_code}' localhost:3000/places/not-a-uuid` → `404`. Skip and note it if no backend is running.
- [ ] **Step 6: Commit** `feat(web): server-rendered places list and place pages`

### Task 5: Auth — clients, provider, sign-in

**Files:**
- Create: `src/lib/firebase.ts`, `src/lib/safe-next.ts`, `src/lib/auth/{types,fake-client,firebase-client,index,phone}.ts`, `src/lib/auth/context.tsx`, `src/components/{RequireAuth,FakeSignIn,PhoneSignIn}.tsx`, `src/app/signin/page.tsx`
- Modify: `src/app/layout.tsx` (wrap in `AuthProvider` → `ApiProvider`), `src/components/NavBar.tsx` (last item "Sign in" → `/signin` when signed out), `src/test/render.tsx` (accept `auth?: Partial<AuthState>`)
- Test: `src/lib/safe-next.test.ts`, `src/lib/auth/fake-client.test.ts`, `src/lib/auth/phone.test.ts`, `src/components/RequireAuth.test.tsx`, `src/components/FakeSignIn.test.tsx`, `src/components/PhoneSignIn.test.tsx`

**Interfaces:**
- Consumes: `publicEnv`, `missingFirebaseKeys`, `createApi`, `ApiProvider`
- Produces:
  - `type AuthUser = { uid: string; phone: string | null }`
  - `interface AuthClient { subscribe(cb: (u: AuthUser | null) => void): () => void; getToken(forceRefresh: boolean): Promise<string | null>; signOut(): Promise<void> }`
  - `interface PhoneAuth { sendCode(phoneE164: string, recaptchaContainer: HTMLElement): Promise<void>; confirmCode(code: string): Promise<void>; reset(): void }`
  - `type FakeAuthClient = AuthClient & { signIn(uid: string): void }`; `type FirebaseAuthClient = AuthClient & { phone: PhoneAuth }`
  - `createFakeAuthClient(storage?: Storage): FakeAuthClient`; `validateFakeUid(uid: string): string | null` (error text or null)
  - `createFirebaseAuthClient(): FirebaseAuthClient` (uses `onAuthStateChanged`, `getIdToken(force)`, `RecaptchaVerifier(auth, container, { size: "invisible" })` created on send — not on mount — and `clear()`ed on error/reset, `signInWithPhoneNumber`)
  - `loadAuthClient(): Promise<FakeAuthClient | FirebaseAuthClient>` (`src/lib/auth/index.ts`; mode guard + dynamic import)
  - `type AuthState = { status: "loading" | "signedOut" | "signedIn"; user: AuthUser | null; client: FakeAuthClient | FirebaseAuthClient | null; getToken(force: boolean): Promise<string | null>; signOut(): Promise<void>; notice: string | null }`; `AuthProvider`, `useAuth(): AuthState`. Provider builds `createApi({ baseUrl, getToken, onUnauthorized })`; `onUnauthorized` signs out and sets `notice = "Your session expired. Sign in again."`
  - `normalizePhone(input: string): { phone: string } | { error: string }`; `firebaseAuthMessage(code: string): string` (`src/lib/auth/phone.ts`)
  - `safeNext(raw: string | null | undefined): string`
  - `RequireAuth({ reason, children })`; `FakeSignIn({ client: FakeAuthClient, next: string })`; `PhoneSignIn({ phoneAuth: PhoneAuth, next: string })`

- [ ] **Step 1: Write failing tests:**
  - `safeNext` — `"/u/abc?x=1"` → same; `"//evil.com"`, `"/\\evil.com"`, `"https://evil.com"`, `""`, `undefined` → `"/"`.
  - `fake client` — `validateFakeUid("u 1")` → `"Use 1–64 letters, digits, - or _."`, `"u1"` → `null`; `signIn("u1")` → subscriber gets `{ uid:"u1", phone:null }`, `getToken(false)` → `"fake:u1:"`; a new client on the same storage starts signed in; `signOut()` → subscriber gets `null`, storage key removed.
  - `normalizePhone` — `"+84 900-000-001"` → `{ phone:"+84900000001" }`; `"0900000001"` → `{ error:"Include the country code, e.g. +84 900 000 001." }`; `"+12"` → `{ error:"That phone number isn't valid." }` (E.164 `^\+[1-9]\d{7,14}$`).
  - `firebaseAuthMessage` — `auth/invalid-verification-code` → "That code is incorrect."; `auth/code-expired` → "That code has expired. Request a new one."; `auth/too-many-requests` → "Too many attempts. Wait a few minutes and try again."; `auth/invalid-phone-number` → "That phone number isn't valid."; `auth/network-request-failed` → "Network error. Check your connection."; anything else → "Sign-in failed. Try again.".
  - `RequireAuth` — `status "signedOut"`, pathname `/u/u2` → text "Sign in to see profiles" (reason `"see profiles"`) and link `/signin?next=%2Fu%2Fu2`; `"loading"` → `role="status"`; `"signedIn"` → children.
  - `FakeSignIn` — invalid uid → error text, `signIn` not called; `"u1"` → `client.signIn("u1")`, then `api.getMe` called (creates the profile, like mobile's first login), then `router.replace` with `safeNext(next)`.
  - `PhoneSignIn` (injected fake `PhoneAuth`) — enter `"+84 900 000 001"` → `sendCode("+84900000001", <container>)`; code step shows; `confirmCode` rejecting `{ code: "auth/invalid-verification-code" }` → "That code is incorrect." and the input stays; success → `api.getMe` then redirect. "Send code" disabled while sending.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** `/signin` page: if already signed in, `router.replace(safeNext(next))`; it takes the provider's `client` (already chosen by `loadAuthClient` under the mode guard): `"signIn" in client` → `FakeSignIn` with a "Development sign-in — no Firebase" label; `"phone" in client` → `PhoneSignIn` with `client.phone`. Missing Firebase keys → `getFirebaseApp()` throws `Firebase web config is missing <KEYS>. See apps/web/.env.example.`, shown on the sign-in page instead of the form. `AuthProvider` status stays `"loading"` until the first `subscribe` callback (same on server and first client render: no hydration mismatch).
- [ ] **Step 4:** tests → PASS; verification set green; `NEXT_PUBLIC_AUTH_MODE=firebase pnpm build && grep -rl 'fake:' .next/static` → no output.
- [ ] **Step 5: Manual check (fake mode, backend `AUTH_MODE=fake`):** sign in as `u1` → redirected; `curl -s localhost:8080/v1/users | grep u1` → profile exists.
- [ ] **Step 6: Commit** `feat(web): phone and dev fake sign-in with auth provider`

### Task 6: People, profiles, follow

**Files:**
- Create: `src/app/people/page.tsx`, `src/app/u/[id]/page.tsx`, `src/components/{PeopleList,UserRow,UserProfile,FollowButton,UserTimeline}.tsx`
- Test: `src/components/PeopleList.test.tsx`, `src/components/FollowButton.test.tsx`, `src/components/UserProfile.test.tsx`, `src/components/UserTimeline.test.tsx`

**Interfaces:**
- Consumes: `useApi`, `useAuth`, `RequireAuth`, `StoryList`, `usePagedList`, `offsetPages`, `cursorPages`, `formatFollowers`, `Avatar`
- Produces:
  - `PeopleList()` (search input `name="q"` synced to `?q=` with `router.replace`, page size 20)
  - `UserRow({ user })` → link `/u/<id>`
  - `UserProfile({ id })`, `FollowButton({ userId, isFollowing, onChange: (next: boolean) => void })`
  - `UserTimeline({ userId, ownerName, refreshKey })` — `StoryList` over `listUserStories`, page size 12; reused by Task 7

- [ ] **Step 1: Write failing tests:**
  - `PeopleList` — api returns `[{ displayName:"An", followerCount:1 }, { displayName:"Bình", followerCount:5 }]` → rows "An · 1 follower", "Bình · 5 followers" linking to `/u/<id>`; submitting "an" → `listUsers({ q:"an", limit:20, offset:0 })`.
  - `FollowButton` — not following → button "Follow"; double click → `api.follow("u2")` called once, button disabled until it resolves, then `onChange(true)`; following → "Unfollow" → `api.unfollow`; rejection → "Couldn't update follow. Try again." and button enabled, `onChange` not called.
  - `UserProfile` — signed in as `u1`, `id "u1"` → "This is you" + link `/me`, no Follow button; `getUser` rejecting `not_found` → "This user doesn't exist."; after a successful follow, `getUser` is called a second time and the follower count updates from the response.
  - `UserTimeline` — `listUserStories` rejects `ApiError(403,"forbidden")` → "Follow An to see their stories." and no story cards; empty page → "No stories yet".
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** `/people` and `/u/[id]` pages export `noindex` metadata; `/u/[id]` renders `<RequireAuth reason="see profiles"><UserProfile id={id} /></RequireAuth>`. `UserProfile` bumps `refreshKey` after follow changes so the timeline refetches.
- [ ] **Step 4:** tests → PASS; verification set green.
- [ ] **Step 5: Commit** `feat(web): people list, profiles and follow`

### Task 7: My profile, avatar upload, accent picker

**Files:**
- Create: `src/lib/upload.ts`, `src/lib/upload-firebase.ts`, `src/app/me/page.tsx`, `src/components/MyProfile.tsx`, `src/components/AccentPicker.tsx`
- Test: `src/lib/upload.test.ts`, `src/components/MyProfile.test.tsx`, `src/components/AccentPicker.test.tsx`

**Interfaces:**
- Consumes: `useApi`, `useAuth`, `RequireAuth`, `UserTimeline`, `Avatar`, `ACCENTS`, `applyAccent`, `loadAccent`, `codePoints`, `publicEnv.firebase.storageBucket`, `getFirebaseStorage`
- Produces:
  - `MAX_UPLOAD_BYTES = 5 * 1024 * 1024`; `class UploadError extends Error`
  - `validateImageFile(file: File): string | null` — non-`image/*` → "Choose an image file."; > 25 MiB → "That photo is too large (max 25 MB)."
  - `toJpeg(file: Blob, maxEdge = 1600, quality = 0.85): Promise<Blob>` (`createImageBitmap` + canvas; decode failure → `UploadError("This photo format isn't supported. Choose a JPEG or PNG.")`)
  - `prepareUpload(file: File): Promise<Blob>` — validate → `toJpeg` → result > `MAX_UPLOAD_BYTES` → `UploadError("That photo is too large to upload.")`
  - `type ImageUploader = (uid: string, image: Blob) => Promise<string>`; `fakeUploader(bucket: string): ImageUploader`; `firebaseUploader: ImageUploader` (`uploadBytes` + `getDownloadURL`); `getUploader(): Promise<ImageUploader>` (mode guard + dynamic import)
  - `MyProfile()`, `AccentPicker()`

- [ ] **Step 1: Write failing tests** (`vi.mock("@/lib/upload")` in component tests):
  - `validateImageFile` — `text/plain` → "Choose an image file."; `image/png` 30 MiB → too-large message; `image/jpeg` 1 MiB → `null`.
  - `prepareUpload` — `toJpeg` stubbed to return a 6 MiB blob → rejects "That photo is too large to upload."
  - `fakeUploader("b")("u1", blob)` matches `/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/b\/o\/uploads%2Fu1%2F[0-9a-f-]{36}\.jpg\?alt=media$/`.
  - `MyProfile rename` — "Edit name", type `"  An  "`, Save → `updateMe({ displayName: "An" })` once (double click), name shown from response; 51 code points → "Display name must be 1 to 50 characters.", no call; whitespace only → same message.
  - `MyProfile avatar` — choose a file → `prepareUpload` → uploader(`"u1"`, blob) → `updateMe({ photoUrl })`; uploader rejects → "Couldn't upload the photo. Try again." and `updateMe` not called; `prepareUpload` rejects `UploadError(msg)` → `msg` shown.
  - `MyProfile` shows `formatFollowers(followerCount)`, "My stories" section (UserTimeline with `userId "u1"`), and "Sign out" → `auth.signOut()` then `router.push("/")`.
  - `AccentPicker` — five radio buttons named after `ACCENTS`; current from `loadAccent()` is checked; choosing "Blue" calls `applyAccent("Blue")`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** `/me` page: `noindex`, `<RequireAuth reason="see your profile"><MyProfile /></RequireAuth>`. `MyProfile` loads via `getMe()` (creates the profile on first call).
- [ ] **Step 4:** tests → PASS; verification set green.
- [ ] **Step 5: Commit** `feat(web): my profile with avatar upload and accent color`

### Task 8: Create story

**Files:**
- Create: `src/lib/geo.ts`, `src/app/post/page.tsx`, `src/components/CreateStoryForm.tsx`
- Test: `src/lib/geo.test.ts`, `src/components/CreateStoryForm.test.tsx`

**Interfaces:**
- Consumes: `useApi`, `useAuth`, `RequireAuth`, `prepareUpload`, `getUploader`, `UploadError`, `isApiError`, `codePoints`
- Produces:
  - `type GeoErrorKind = "unsupported" | "denied" | "unavailable" | "timeout"`; `class GeoError extends Error { readonly kind: GeoErrorKind }`
  - `getCurrentPosition(geo?: Geolocation, secure?: boolean): Promise<{ lat: number; lng: number }>` (defaults `navigator.geolocation`, `window.isSecureContext`; options `{ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }`)
  - `geoErrorMessage(kind: GeoErrorKind): string`
  - `CreateStoryForm()`

Exact messages:
- `denied`: "Location access is blocked. Your story is attached to the nearest place, so allow location for this site in your browser settings and try again."
- `unavailable`: "Couldn't find your location. Check that location services are on, then try again."
- `timeout`: "Finding your location took too long. Try again."
- `unsupported`: "This browser can't share your location, so stories can't be posted from here."
- 422: "There are no places yet to attach your story to."

- [ ] **Step 1: Write failing tests:**
  - `geo` — fake `Geolocation` calling error with `code 1/2/3` → `GeoError` kinds `denied/unavailable/timeout`; `geo undefined` or `secure false` → `unsupported` without calling the API; success `{ coords: { latitude: 21.03, longitude: 105.85 } }` → `{ lat: 21.03, lng: 105.85 }`.
  - `CreateStoryForm happy path` (mock `@/lib/geo`, `@/lib/upload`, `next/navigation`) — photo + title "Hồ Gươm sunset" → status texts "Finding your location…", "Uploading photo…", "Posting…"; `createStory({ title:"Hồ Gươm sunset", type:"", description:"", imageUrl:<uploaded>, lat:21.03, lng:105.85 })`; `router.push("/places/l1?posted=1")` from `story.location.id`.
  - `location denied` — `getCurrentPosition` rejects `GeoError("denied")` → denied message; uploader and `createStory` not called; title input still holds the text.
  - `no places (422)` — `createStory` rejects `ApiError(422,"unprocessable")` → 422 message; submitting again → uploader called once in total (the uploaded URL is reused for the same file), `createStory` twice.
  - `validation` — no photo → "Choose a photo."; blank title → "Add a title."; 101-code-point title → "Title must be 1 to 100 characters."; 51-code-point type → "Type must be at most 50 characters."; 2001-code-point description → "Description must be at most 2000 characters."; none call geo.
  - `double submit` — two quick clicks on "Post story" → `createStory` called once; button disabled while busy.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Order: validate → locate → upload (skip if the cached `{ file, url }` matches) → post; location before upload so a denial leaves no orphan upload. Photo preview via `URL.createObjectURL`, revoked on change/unmount; `<input type="file" accept="image/*">`. `ApiError` `bad_request` shows its message; `network` shows its message. `/post`: `noindex`, `<RequireAuth reason="post a story"><CreateStoryForm /></RequireAuth>`.
- [ ] **Step 4:** tests → PASS; verification set green.
- [ ] **Step 5: Manual check (fake mode):** post a story at a browser-overridden location (DevTools → Sensors) → lands on the nearest place page with "Your story was posted here." and the new card (image shows the placeholder in fake mode). Skip and note it if no backend is running.
- [ ] **Step 6: Commit** `feat(web): create story with photo upload and geolocation`

### Task 9: Map

**Files:**
- Create: `src/app/map/page.tsx`, `src/components/map/{MapScreen,MapView,LocationPicker}.tsx`, `src/components/map/fetch-all.ts`
- Modify: `src/app/globals.css` (`.memopin-marker`: 18 px circle, fill `#d3d3d3`, border 1.5 px `#0071bc`, as mobile `map_logic.dart`)
- Test: `src/components/map/fetch-all.test.ts`, `src/components/map/MapScreen.test.tsx`

**Interfaces:**
- Consumes: `useApi`, `Location`, `directionsUrl`, `publicEnv.map`
- Produces:
  - `fetchAllLocations(api: Pick<Api, "listLocations">, opts?: { pageSize?: number; maxPages?: number }): Promise<Location[]>` (defaults 100 and 10)
  - `MapScreen({ initialPlaceId?: string })`; `LocationPicker({ locations, selectedId, onSelect })` (`<select>` sorted by name, first option "Choose a place"); `MapView({ locations, selected, onMarkerClick, tileUrl, attribution, center, zoom })` (default export, loaded with `next/dynamic` `ssr: false`, loading text "Loading map…")

- [ ] **Step 1: Write failing tests:**
  - `fetchAllLocations` — pages of 100, 100, 40 → 240 items, calls with offsets 0, 100, 200 and `limit 100`; with `maxPages 2` and full pages → stops after 2 calls; first call rejects → rejects.
  - `MapScreen` (mock `next/dynamic` to render a stub `MapView` that records props) — selecting "Cầu Rồng" (16.06, 108.22) passes it as `selected` and shows "Directions" with `href` `directionsUrl(16.06, 108.22)`, `target="_blank"`, and "Details" → `/places/<id>`; `initialPlaceId` preselects that place; load failure → "Couldn't load places. Try again." with a retry button.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** `MapView`: `MapContainer` (center/zoom from `publicEnv.map`), `TileLayer` with tile URL + attribution, one `Marker` per location with `L.divIcon({ className: "memopin-marker", iconSize: [18, 18] })` (avoids Leaflet's broken default icon paths), `Tooltip` with the venue name, click → `onMarkerClick(id)` → `router.push("/places/<id>")`; child `FlyTo` uses `useMap().flyTo([lat, lng], 15)` when `selected` changes; imports `leaflet/dist/leaflet.css`. Map height `calc(100dvh - nav)`. `/map` page reads `searchParams.place`.
- [ ] **Step 4:** tests → PASS; verification set green.
- [ ] **Step 5: Manual check:** `/map` shows tiles and markers; choosing a place flies there; "Directions" opens Google Maps in a new tab.
- [ ] **Step 6: Commit** `feat(web): map with place markers and directions`

### Task 10: Playwright smoke and docs

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `apps/web/README.md`
- Modify: `README.md` (repo root: add `apps/web/` to the layout block and drop it from "Planned"), `CLAUDE.md` (Repo layout: `apps/web/` exists; it is gitignored, so this edit is local only)

**Interfaces:**
- Consumes: the whole app; backend in `AUTH_MODE=fake` with seeded places.

- [ ] **Step 1: Configure.** `playwright.config.ts`: `testDir: "e2e"`, chromium only, `baseURL http://localhost:3000`, `use: { geolocation: { latitude: 21.03, longitude: 105.85 }, permissions: ["geolocation"] }`, `webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, env: { NEXT_PUBLIC_AUTH_MODE: "fake", NEXT_PUBLIC_API_BASE_URL: "http://localhost:8080" } }`. Add `playwright-report/`, `test-results/` to `.gitignore`. `pnpm exec playwright install chromium`.
- [ ] **Step 2: Write `e2e/smoke.spec.ts`** (uids suffixed with `Date.now()` so reruns don't collide):
  - `public place page` — `/` has ≥ 1 place card; open the first → `meta[property="og:title"]` content equals the heading text.
  - `sign in and rename` — fake sign-in as `a<ts>` → `/me` shows "user"; rename to "E2E A" → reload → "E2E A".
  - `follow gate` — sign out, sign in as `b<ts>`, open `/u/a<ts>` → "Follow E2E A to see their stories."; click Follow → that text gone, "1 follower".
  - `post story` — as `a<ts>`, `/post`, `setInputFiles` with a 1×1 JPEG from a base64 constant, title "E2E story" → redirected to `/places/<id>?posted=1` with a card "E2E story".
- [ ] **Step 3: Run against the backend.** `cd ../../backend && docker compose up -d --build` (backend plan Task 9 `api` service, `AUTH_MODE=fake`; before that exists: `make dev`) and `go run ./cmd/seed` (backend plan Task 8); then from `apps/web`: `pnpm e2e` → 4 passed. If the backend or seed is not available yet, record that in the commit message and keep the spec.
- [ ] **Step 4: Docs.** `apps/web/README.md`: setup (`cp .env.example .env.local`, `pnpm install`, backend `make dev` with `AUTH_MODE=fake`), env table (Global Constraints), fake vs firebase mode (fake: dev only, uploads simulated, never in a production build), commands (verification set + `pnpm e2e`), what a deploy needs (all `NEXT_PUBLIC_*` with `NEXT_PUBLIC_AUTH_MODE=firebase`, origin in backend `CORS_ORIGINS`, domain in Firebase Auth authorized domains), out of scope (web push, story pages).
- [ ] **Step 5:** verification set green.
- [ ] **Step 6: Commit** `test(web): playwright smoke and web docs`

---

## Backend gaps found (not fixed here; `backend/` is off limits for this plan)

1. No `GET /v1/stories/{id}` → no shareable story page (dialog instead).
2. Default display name `user <phone>` is returned by public `GET /v1/users` and as `owner.displayName` in public story lists, so phone numbers appear on server-rendered, indexable place pages. Web marks people pages `noindex` but cannot fix place pages; the backend should stop deriving public names from the phone.
3. Offset lists (`/v1/locations`, `/v1/users`) carry no `nextCursor`/total; the web infers "more" from a full page (one extra empty request at the end), and the map pages through all places at 100 per request (no bounding-box query).
4. `AUTH_MODE=fake` has no image story: web fake uploads produce bucket-shaped URLs that pass `ValidImageURL` but do not resolve.
5. `GET /v1/users` has no `isFollowing`, so follow/unfollow lives on the profile page only (same as mobile).
