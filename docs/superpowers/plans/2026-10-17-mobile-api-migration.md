# Mobile App on the Go API (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Flutter app `apps/mobile` reads and writes all data through the Memopin Go API instead of Firestore, receives new-story push via FCM, and no longer depends on `cloud_firestore`.

**Prerequisite / blocking:** Tasks 1–8 need nothing from the user: they compile, analyze and unit-test with the current repo. **Task 9 is blocked** until the user has done `docs/setup/firebase-gcp.md` §2–§5 (in particular §4 `flutterfire configure`, which writes `lib/firebase_options.dart` and a new `android/app/google-services.json`) and a backend is reachable. Until then the app cannot be built for or run on a device (the committed `google-services.json` belongs to the old project, so Gradle fails with `No matching client found for package name 'com.memopin.app'`). iOS push additionally needs §6 (APNs key, paid Apple account).

**Architecture:** One `ApiClient` (package `http`) handles base URL, the Firebase ID token, timeouts, UTF-8 JSON and maps `{"error":{"code","message"}}` to `ApiException`. `MemopinApi` on top of it has one typed method per endpoint and returns plain model classes. Pages swap `StreamBuilder`-on-Firestore for `FutureBuilder` plus explicit refresh. Paginated story lists use a small `ChangeNotifier` (`StoryPager`). Firebase stays for phone OTP (`firebase_auth`), image upload (`firebase_storage`, `uploads/{uid}/…`) and push (`firebase_messaging`). Logic that tests cover lives in files that import no Firebase package, and the Firebase calls are passed in as functions.

**Tech Stack:** Flutter 3.47 / Dart 3.13, `http` ^1.6.0 (+ `package:http/testing.dart` `MockClient`), `firebase_core` ^5, `firebase_auth` ^7, `firebase_storage` ^14, `firebase_messaging` (latest compatible), `flutter_local_notifications` ^22, `flutter_dotenv`, `flutter_test`.

**Spec:** `docs/superpowers/specs/2026-10-17-platform-design.md` (binding). Setup: `docs/setup/firebase-gcp.md`. API as built: `backend/internal/server/router.go` and `backend/internal/{users,locations,follows,stories,devices}/`.

## Global Constraints

- Run all Flutter commands from `apps/mobile/`. Touch only `apps/mobile/**`, root `README.md` and `CLAUDE.md`. **Never touch `backend/`**: another agent commits there concurrently. Stage explicit paths (`git add <paths>`), never `git add -A` / `git add .`; no rebase/reset/stash.
- Names: app Memopin, Dart package `memopin`, app id `com.memopin.app` (already set; do not rename).
- Dependencies: remove `cloud_firestore` (Task 8); keep `firebase_core`, `firebase_auth`, `firebase_storage`; add `http: ^1.6.0` (Task 1) and `firebase_messaging` via `flutter pub add firebase_messaging` (Task 6; must resolve against `firebase_core ^5.0.0`); keep `flutter_local_notifications` only to show foreground pushes on Android. No `dependency_overrides`, no state-management package (no provider/riverpod/bloc). Keep `geolocator` at 14.0.x (see CLAUDE.md).
- Config: new `.env` key `API_BASE_URL` (no trailing slash needed), read only through `AppConfig.apiBaseUrl` in `lib/config.dart`. `.env` is bundled into the APK: never put `DATABASE_URL`, service-account data or any secret in it.
- HTTP: every call goes through `ApiClient`. `Authorization: Bearer <Firebase ID token>` only on routes the backend guards (`auth: true`). Never send a uid in a body or query string. Responses are decoded as UTF-8 from `bodyBytes` (the backend sends `application/json` without a charset).
- Backend error body: `{"error":{"code":"<code>","message":"<text>"}}`; codes `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `unprocessable`, `internal`. Auth verifier outage answers 503 with code `internal`; chi's 15 s timeout answers 504 with an empty body; Cloud Run errors may be HTML.
- Client-side limits mirror the backend (count Unicode code points with `.runes.length`, after `trim()` where noted): display name 1..50 (trimmed), story title 1..100 (trimmed), type ≤ 50, description ≤ 2000. List `limit` max 100.
- Uploads: Storage object path `uploads/{uid}/{20 random alphanumerics}.jpg`, metadata `contentType: 'image/jpeg'`. Storage rules reject ≥ 5 MiB and non-image types, so pick images with `maxWidth`/`maxHeight` and `imageQuality: 85` (stories 1600 px, avatar 512 px). The backend rejects any image URL outside `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/uploads%2F<caller uid>%2F`.
- No realtime (spec non-goal): no Firestore listeners, no polling. Lists load on open, on search change and on explicit refresh (pull-to-refresh or after the user's own write). New stories from followed users arrive as FCM push sent by the backend.
- Push copy comes from the backend (title `Memopin`, body `<displayName> has just posted a new story.`, data `{"type":"new_story","storyId","locationId"}`); the app does not build its own text.
- `main.dart` keeps `Firebase.initializeApp()` with no arguments until Task 9 (the `firebase_options.dart` file does not exist before the user runs `flutterfire configure`). Do not create a stub `firebase_options.dart`.
- Tests: `flutter test` must pass with no Firebase project, device or network. Tests never call `Firebase.initializeApp`. Files under `lib/api/`, `lib/logic/story_pager.dart`, `lib/logic/validators.dart`, `lib/logic/story_submitter.dart`, `lib/services/push_registration.dart` import no `firebase_*`, `cloud_firestore` or `flutter_dotenv` package. Shared test helper: `test/support/fake_api.dart` (Task 2).
- Verification for every task: `flutter analyze --no-fatal-infos` reports 0 errors and 0 warnings (the baseline has 84 infos and 0 warnings; files a task creates add no new infos), and `flutter test` passes.
- Commit messages: Conventional Commits, scope `mobile`, e.g. `feat(mobile): …`; end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Vietnamese text in any response ("Hồ Gươm", "user +84…") → shown correctly, not mojibake; `http`'s `response.body` would decode as Latin-1 because the backend sends no charset. (Task 1: `decodes UTF-8 JSON without a charset`)
2. Expired ID token mid-session → one forced token refresh and one retry, then a typed 401; a signed-out user hitting an auth route → typed 401 without a network call; never a retry loop. (Task 1: `retries once with a forced token refresh on 401`, `auth call while signed out throws without sending`)
3. No network, a 20 s timeout, a 504 with an empty body or a 502 HTML page → `ApiException` with a readable `userMessage`, never an uncaught `FormatException`/`SocketException` or a red screen. (Task 1: `network failure…`, `timeout…`, `non-JSON error body…`)
4. Push unavailable (iOS without APNs, `getToken` throws, permission denied) or logout while offline / backend hanging → sign-in still loads the profile, and logout still signs out within 5 s. (Task 6: `onSignedIn when fcmToken throws…`, `beforeSignOut completes when DELETE hangs`)
5. Double tap on "post story", or an empty title → exactly one upload and one `POST /v1/stories`, and invalid input is rejected before anything is uploaded (no orphan files). (Task 7: `concurrent submits upload and post once`, `blank title rejected before upload`)

---

## File Structure

```
apps/mobile/
  .env.example                       + API_BASE_URL, - DEFAULT_USER_PHOTO_URL
  pubspec.yaml                       + http, + firebase_messaging, - cloud_firestore
  android/app/src/debug/AndroidManifest.xml   usesCleartextTraffic (debug only, local API)
  android/app/src/main/AndroidManifest.xml    FCM default channel meta-data
  ios/Runner/Info.plist              NSAllowsLocalNetworking; UIBackgroundModes remote-notification
  lib/config.dart                    + apiBaseUrl, - defaultUserPhotoUrl
  lib/api/api_client.dart            ApiClient (transport) + ApiException
  lib/api/models.dart                AppUser, Location, Story, Paged<T>
  lib/api/memopin_api.dart           one method per endpoint
  lib/services/services.dart         app-wide singletons: api, pushRegistration, navigatorKey, initServices()
  lib/services/push_registration.dart  GET /v1/me + device register/unregister (pure, tested)
  lib/services/push.dart             firebase_messaging + local-notification glue (untested)
  lib/services/session.dart          auth-state listener, signOut()
  lib/services/uploads.dart          Storage upload to uploads/{uid}/…
  lib/logic/story_pager.dart         cursor pagination ChangeNotifier
  lib/logic/validators.dart          display name / story field validation
  lib/logic/story_submitter.dart     create-story orchestration (validate → locate → upload → POST)
  lib/components/net_image.dart      imageOrNull() for possibly-empty URLs
  lib/utils.dart                     DateTime instead of Firestore Timestamp
  lib/main.dart                      no Firestore listeners; services + push + session
  lib/pages/*, lib/components/*      switched to MemopinApi
  lib/const.dart, lib/logic/search_results.dart, test/widget_test.dart   deleted
  test/api/, test/logic/, test/services/, test/components/, test/utils_test.dart, test/support/fake_api.dart
```

---

### Task 1: `ApiClient`, `API_BASE_URL`, local-HTTP config

**Files:**
- Create: `apps/mobile/lib/api/api_client.dart`
- Modify: `apps/mobile/pubspec.yaml`, `apps/mobile/lib/config.dart`, `apps/mobile/.env.example`, `apps/mobile/android/app/src/debug/AndroidManifest.xml`, `apps/mobile/ios/Runner/Info.plist`
- Delete: `apps/mobile/test/widget_test.dart` (counter template; cannot work with Firebase)
- Test: `apps/mobile/test/api/api_client_test.dart`

**Interfaces:**
- Produces:
  - `typedef IdTokenProvider = Future<String?> Function({bool forceRefresh});`
  - `class ApiException implements Exception { const ApiException(this.status, this.code, this.message); final int status; final String code; final String message; bool get isNetwork; String get userMessage; }`. `status == 0` means no response; codes added by the client: `network` (socket/`ClientException`/timeout), `bad_response` (2xx with an unparseable body), `http_error` (non-2xx without a JSON error body).
  - `userMessage`: `network` → `No connection. Check your internet and try again.`; 401 → `Please sign in again.`; 5xx → `Something went wrong. Please try again.`; other 4xx → the server `message`.
  - `class ApiClient { ApiClient({required String baseUrl, required IdTokenProvider idToken, http.Client? client, Duration timeout = const Duration(seconds: 20)}); Future<Object?> send(String method, String path, {Map<String, String>? query, Object? body, bool auth = false}); }`. Returns decoded JSON, or `null` for 204 or an empty body.
  - `AppConfig.apiBaseUrl` → `String` (throws `StateError('API_BASE_URL is missing in .env')` when absent; no fallback).

- [ ] **Step 1: Write failing tests** in `test/api/api_client_test.dart` (use `MockClient`, a fake `IdTokenProvider` that records `forceRefresh`):
  - `joins base URL with and without trailing slash` — base `http://h:8080` and `http://h:8080/` + path `/v1/locations` → `request.url.toString() == 'http://h:8080/v1/locations'`; with `query: {'q': 'hồ %'}` → `request.url.queryParameters['q'] == 'hồ %'`; no `?` when query is null or empty.
  - `sends bearer token only when auth is true` — `auth: true` → `headers['authorization'] == 'Bearer t1'`; `auth: false` → no header and the token provider is not called.
  - `encodes JSON body` — `body: {'a': 1}` → `content-type` starts with `application/json`, `jsonDecode(request.body) == {'a': 1}`.
  - `decodes UTF-8 JSON without a charset` — response `http.Response.bytes(utf8.encode('{"venueName":"Hồ Gươm"}'), 200, headers: {'content-type': 'application/json'})` → `(result as Map)['venueName'] == 'Hồ Gươm'`.
  - `204 returns null`.
  - `maps backend error body` — 403 `{"error":{"code":"forbidden","message":"follow this user to see their stories"}}` → throws `ApiException` with `status == 403`, `code == 'forbidden'`, `userMessage == 'follow this user to see their stories'`.
  - `non-JSON error body becomes http_error` — 502 `<html>…` and 504 with empty body → `ApiException(status: 502|504, code: 'http_error')`, `userMessage == 'Something went wrong. Please try again.'`.
  - `bad 2xx body becomes bad_response` — 200 `not json` → `code == 'bad_response'`.
  - `network failure becomes network` — `MockClient` throws `http.ClientException('x')` → `status == 0`, `code == 'network'`, `isNetwork == true`.
  - `timeout becomes network` — handler awaits 200 ms, client `timeout: Duration(milliseconds: 20)` → `code == 'network'`.
  - `retries once with a forced token refresh on 401` — first response 401, second 200 → two requests; second has `Bearer t2`; provider called with `forceRefresh: false` then `true`. Two 401s in a row → throws `ApiException(status: 401)` after exactly 2 requests.
  - `auth call while signed out throws without sending` — provider returns `null`, `auth: true` → `ApiException(401, 'unauthorized', …)`, zero requests sent.
- [ ] **Step 2:** `flutter test test/api/api_client_test.dart` → FAIL (`api_client.dart` missing).
- [ ] **Step 3: Implement** `lib/api/api_client.dart`. Build the URL as `Uri.parse('${base without trailing "/"}$path')`, then `.replace(queryParameters: query)` only when `query` is non-empty. Headers: `accept: application/json`; `content-type: application/json` when `body != null`. Decode with `utf8.decode(response.bodyBytes)`. Wrap `send` in `.timeout(timeout)`. Catch `SocketException`, `http.ClientException`, `TimeoutException` → `network`. Add `http: ^1.6.0` to `dependencies`.
- [ ] **Step 4: Config.** `AppConfig.apiBaseUrl` uses `dotenv.maybeGet('API_BASE_URL')`. `.env.example`: add a block with `API_BASE_URL=http://10.0.2.2:8080` and comments: Android emulator → `http://10.0.2.2:8080`, iOS simulator → `http://localhost:8080`, physical device → the laptop's LAN IP, deployed → the Cloud Run `https://…run.app` URL; repeat the warning that this file ships in the app and must never hold `DATABASE_URL` or secrets. Debug manifest: add `<application android:usesCleartextTraffic="true"/>` (debug builds only; release stays HTTPS-only). `Info.plist`: `NSAppTransportSecurity` → `NSAllowsLocalNetworking` = true. Delete `test/widget_test.dart`.
- [ ] **Step 5:** `flutter test` → PASS; `flutter analyze --no-fatal-infos` → 0 errors, 0 warnings.
- [ ] **Step 6: Commit** `feat(mobile): add api client with typed errors and API_BASE_URL`

### Task 2: Models, `MemopinApi`, service wiring

**Files:**
- Create: `apps/mobile/lib/api/models.dart`, `apps/mobile/lib/api/memopin_api.dart`, `apps/mobile/lib/services/services.dart`
- Modify: `apps/mobile/lib/main.dart` (call `initServices()` after `Firebase.initializeApp()`)
- Test: `apps/mobile/test/api/models_test.dart`, `apps/mobile/test/api/memopin_api_test.dart`, `apps/mobile/test/support/fake_api.dart`

**Interfaces:**
- Consumes: `ApiClient`, `ApiException`, `IdTokenProvider` (Task 1)
- Produces (JSON keys are the backend's, verbatim):
  - `class AppUser { id, displayName, photoUrl: String; followerCount: int; isFollowing: bool? }`, from `{"id","displayName","photoUrl","followerCount","isFollowing"?}`. `isFollowing` is absent on `/v1/me` and in lists.
  - `class Location { id, venueName, venueLocation, description, imageUrl: String; lat, lng: double; storyCount: int }`, from `{"id","venueName","venueLocation","description","imageUrl","lat","lng","storyCount"}`.
  - `class Story { id, title, type, description, imageUrl: String; createdAt: DateTime (UTC); locationId, venueName: String; ownerId, ownerDisplayName, ownerPhotoUrl: String }`, from `{"id","title","type","description","imageUrl","createdAt","location":{"id","venueName"},"owner":{"id","displayName","photoUrl"}}`.
  - `class Paged<T> { final List<T> items; final String? nextCursor; bool get hasMore => nextCursor != null; }`
  - Each model has `factory X.fromJson(Map<String, dynamic> json)`. Numbers are read as `num` then converted (`lat` may arrive as `21`).
  - `class MemopinApi { MemopinApi(ApiClient client); … }` with:

    | Method | HTTP | auth | Result |
    |---|---|---|---|
    | `Future<AppUser> getMe()` | `GET /v1/me` | yes | 200 user (creates the row on first call) |
    | `Future<AppUser> updateMe({String? displayName, String? photoUrl})` | `PATCH /v1/me` (only non-null keys) | yes | 200 user |
    | `Future<List<Location>> listLocations({String? q, int limit = 100, int offset = 0})` | `GET /v1/locations?q&limit&offset` | no | `{"items":[…]}` (no cursor) |
    | `Future<List<Location>> allLocations({String? q})` | repeated `listLocations` | no | all pages |
    | `Future<Location> getLocation(String id)` | `GET /v1/locations/{id}` | no | 200 / 404 |
    | `Future<Paged<Story>> locationStories(String locationId, {String? cursor, int limit = 20})` | `GET /v1/locations/{id}/stories?cursor&limit` | no | `{"items","nextCursor"}` |
    | `Future<List<AppUser>> listUsers({String? q, int limit = 100, int offset = 0})` | `GET /v1/users?q&limit&offset` | no | `{"items":[…]}`, most followed first |
    | `Future<AppUser> getUser(String id)` | `GET /v1/users/{id}` | yes | user with `isFollowing` |
    | `Future<Paged<Story>> userStories(String uid, {String? cursor, int limit = 20})` | `GET /v1/users/{id}/stories` | yes | 403 `forbidden` unless self or follower |
    | `Future<void> follow(String uid)` / `unfollow(String uid)` | `PUT` / `DELETE /v1/users/{id}/follow` | yes | 204 (idempotent); self → 400, unknown → 404 |
    | `Future<Story> createStory({required String title, required String type, required String description, required String imageUrl, required double lat, required double lng})` | `POST /v1/stories` | yes | 201 story; 422 `unprocessable` when no places exist |
    | `Future<void> registerDevice(String token, String platform)` | `POST /v1/me/devices {"token","platform"}` | yes | 204; platform `android`/`ios` |
    | `Future<void> unregisterDevice(String token)` | `DELETE /v1/me/devices/{Uri.encodeComponent(token)}` | yes | 204 |
  - Path ids are inserted with `Uri.encodeComponent`. A response that fails model parsing (`TypeError`/`FormatException`) is rethrown as `ApiException(200, 'bad_response', …)`.
  - `lib/services/services.dart`: `late final MemopinApi api;` and `void initServices()`, which builds `ApiClient(baseUrl: AppConfig.apiBaseUrl, idToken: ({bool forceRefresh = false}) async => FirebaseAuth.instance.currentUser?.getIdToken(forceRefresh))`. Tasks 6 and 7 add fields here.
  - `test/support/fake_api.dart`: `MemopinApi fakeApi(Future<http.Response> Function(http.Request req) handler, {String? token = 't1'})` and `http.Response jsonResponse(Object body, [int status = 200])` (UTF-8 bytes).

- [ ] **Step 1: Write failing tests:**
  - `models_test.dart`: `Location.fromJson parses all fields and integer lat/lng` (`"lat": 21` → `21.0`); `Story.fromJson parses nested owner and location` and `createdAt "2026-10-17T03:04:05.123456789Z"` → `isUtc`, `microsecond == 456`, `millisecond == 123`; `AppUser.fromJson isFollowing absent → null, true → true`; `Paged nextCursor null → hasMore false`.
  - `memopin_api_test.dart`: `listLocations sends q, limit, offset` (`q=hồ` → query param `hồ`, `limit=100`, `offset=0`, no auth header); `allLocations pages until a short page` (fake returns 100, 100, 3 items → 203 results, offsets 0/100/200, 3 requests); `getUser uses auth and parses isFollowing`; `updateMe sends only provided fields` (`updateMe(displayName: 'An')` → body exactly `{"displayName":"An"}`); `follow sends PUT and accepts 204`; `createStory posts body and parses 201`, body keys exactly `title,type,description,imageUrl,lat,lng`; `createStory 422 throws ApiException unprocessable`; `unregisterDevice percent-encodes the token` (`'abc:APA91b/x'` → `request.url.path == '/v1/me/devices/abc%3AAPA91b%2Fx'`); `userStories passes cursor and returns nextCursor`; `malformed item throws bad_response` (location without `venueName`).
- [ ] **Step 2:** `flutter test test/api` → FAIL.
- [ ] **Step 3: Implement** models, `MemopinApi`, the test helper and `services.dart`. `allLocations` stops after a page shorter than 100, or after 50 pages. In `main.dart` call `initServices()` right after `Firebase.initializeApp()`.
- [ ] **Step 4:** `flutter test` → PASS; analyze clean.
- [ ] **Step 5: Commit** `feat(mobile): add typed memopin api and models`

### Task 3: Story lists and story view on the API

**Files:**
- Create: `apps/mobile/lib/logic/story_pager.dart`, `apps/mobile/lib/components/net_image.dart`
- Modify: `apps/mobile/lib/utils.dart`, `apps/mobile/lib/pages/story_page.dart`, `apps/mobile/lib/components/list_card.dart`, `apps/mobile/lib/pages/details_info.dart`, `apps/mobile/lib/pages/user_stories_timeline.dart`
- Test: `apps/mobile/test/logic/story_pager_test.dart`, `apps/mobile/test/utils_test.dart`, `apps/mobile/test/components/net_image_test.dart`

**Interfaces:**
- Consumes: `api.locationStories`, `api.userStories`, `Story`, `Paged<T>`, `ApiException` (Tasks 1–2)
- Produces:
  - `typedef StoryFetcher = Future<Paged<Story>> Function(String? cursor);`
  - `class StoryPager extends ChangeNotifier { StoryPager(StoryFetcher fetch); List<Story> get items; bool get loading; bool get hasMore; ApiException? get error; Future<void> refresh(); Future<void> loadMore(); }`
  - `ImageProvider? imageOrNull(String url)` → `null` for `''`, else `NetworkImage(url)`. Every widget that shows an API image uses it (`DecorationImage` only when non-null, grey background otherwise).
  - `String getFormattedTimeDistanceToCurrent(DateTime time, {DateTime? now})`, `String getFormattedTimeStamp(DateTime time)` (formats `time.toLocal()`, same `MM/dd/yyyy hh:mma` pattern)
  - `StoryPage({required Story story})`, `ListCard({required Story story})` (place name from `story.venueName`, no lookup). `DetailsInfo({required String description, required String locationID})` and `UserStoriesTimeLine({required String uid})` keep their constructors.

- [ ] **Step 1: Write failing tests:**
  - `story_pager_test.dart`: `refresh loads first page with null cursor`; `loadMore appends using nextCursor`; `loadMore does nothing when hasMore is false`; `concurrent loadMore fetches once`; `error is stored and items kept` (fetch throws `ApiException(0,'network','x')` → `error.code == 'network'`, previous items unchanged, `loading == false`); `refresh during an in-flight loadMore discards the stale page` (no duplicate ids after both complete).
  - `utils_test.dart`: distance with fixed `now`: 30 s → `Just now`, 5 min → `5m`, 3 h → `3h`, 2 days → `2d`, 14 days → `2w`, 400 days → `1y`; `future timestamp (clock skew) → Just now`.
  - `net_image_test.dart`: `imageOrNull('') == null`; `imageOrNull('https://x/y.jpg') is NetworkImage`.
- [ ] **Step 2:** `flutter test test/logic test/utils_test.dart test/components` → FAIL.
- [ ] **Step 3: Implement.** Use a generation counter in `StoryPager` so a result from an older request is dropped. `utils.dart`: drop the `cloud_firestore` import and delete the unused `unionName` and `extractBasename`. `DetailsInfo`: owns a `StoryPager(api.locationStories(locationID, cursor: c))` created in `initState`, `refresh()` on open, `RefreshIndicator` → `refresh`, a trailing "Load more" `TextButton` while `hasMore`, `No stories` when empty, `error.userMessage` + retry button on error. Keep the existing description / `LOCAL STORIES` header layout. `UserStoriesTimeLine`: same pager over `api.userStories(uid, …)`; on `error.code == 'forbidden'` show `Please follow me to sightsee !!!`. `StatefulWidget`s dispose their pager.
- [ ] **Step 4:** `flutter test` → PASS; analyze clean.
- [ ] **Step 5: Commit** `feat(mobile): load story lists from the api with cursor paging`

### Task 4: Places (Explore, details, map) on the API

**Files:**
- Modify: `apps/mobile/lib/pages/explore_page.dart`, `apps/mobile/lib/components/explore_list.dart` (`exploreList` only), `apps/mobile/lib/logic/search_results.dart` (delete `searchedExploreList`), `apps/mobile/lib/components/main_card.dart`, `apps/mobile/lib/pages/details_page.dart`, `apps/mobile/lib/pages/details_cover.dart`, `apps/mobile/lib/pages/maps_page.dart`, `apps/mobile/lib/logic/map_logic.dart`
- Test: `apps/mobile/test/logic/map_logic_test.dart`

**Interfaces:**
- Consumes: `api.allLocations`, `Location`, `imageOrNull`, `DetailsInfo(description:, locationID:)`
- Produces: `DetailsPage({required Location location})` (used by Task 6 for push taps), `DetailsCover({required Location location})`, `MainCard({required Location location})`, `Widget exploreList(List<Location> locations)`, `LatLng locationLatLng(Location l)`, `List<DropdownMenuItem<String>> buildDDMenuItems(List<Location>)` (value = `id`), `List<Marker> buildMarkers(List<Location>, void Function(Location) onTap)`.

- [ ] **Step 1: Write failing test** `map_logic_test.dart`: `buildMarkers makes one marker per location at lat/lng` (2 locations → 2 markers, `point == LatLng(16.05, 108.2)`); `buildDDMenuItems uses location ids as values`.
- [ ] **Step 2:** `flutter test test/logic/map_logic_test.dart` → FAIL.
- [ ] **Step 3: Implement.** Explore: create the search stream once in `initState` as `bloc.recieveSearchVal.debounceTime(const Duration(milliseconds: 300)).distinct()` (rxdart). For each value, use a `FutureBuilder` over `api.allLocations(q: value.isEmpty ? null : value)`, where search is the server's case-insensitive name prefix. Show a spinner while loading, `noSearch()` when empty, and `userMessage` + retry on error. The tab's State is rebuilt when the user comes back to the tab, which refetches story counts. `MainCard` shows `'${venueLocation}  .  ${storyCount} Stories'` from the model (the per-card story stream is gone) and pushes `DetailsPage(location:)`. Map: one `FutureBuilder` over `api.allLocations()`. The map still renders with no markers on error, and a SnackBar shows `userMessage`. Marker tap pushes `DetailsPage(location:)` directly (no count query). The dropdown and "Direction" behave as before. `map_logic.dart` drops `cloud_firestore`.
- [ ] **Step 4:** `flutter test` → PASS; analyze clean.
- [ ] **Step 5: Commit** `feat(mobile): load places for explore, details and map from the api`

### Task 5: People, public profiles, follow

**Files:**
- Modify: `apps/mobile/lib/pages/people_page.dart`, `apps/mobile/lib/components/explore_list.dart` (`explorePeopleList`), `apps/mobile/lib/components/user_card.dart`, `apps/mobile/lib/pages/user_public_profile_page.dart`
- Delete: `apps/mobile/lib/logic/search_results.dart`
- Test: covered by `memopin_api_test.dart` (`follow…`, `getUser…`); no new test file (widget-only changes)

**Interfaces:**
- Consumes: `api.listUsers`, `api.getUser`, `api.follow`, `api.unfollow`, `AppUser`, `UserStoriesTimeLine(uid:)`, `imageOrNull`
- Produces: `Widget explorePeopleList(List<AppUser> users)`, `UserCard({required AppUser user})`, `UserPublicProfilePage({required AppUser user})`

- [ ] **Step 1: Implement** People: same debounced search stream as Explore → `FutureBuilder` over `api.listUsers(q: …)`. The server already sorts by follower count and does the prefix search, so client-side sorting and filtering go away. `UserCard` keeps the "Please Login :((((" guard. Public profile: shows the passed `user` immediately, then loads `api.getUser(user.id)` for the current `followerCount` and `isFollowing`. The Follow/Unfollow button is disabled while a request is in flight. On success, re-fetch `getUser` and rebuild the timeline (new `Key`). On `ApiException`, show a SnackBar with `userMessage` and leave the state unchanged. Show the timeline when `user.id == currentUid` or `isFollowing == true`; otherwise show `Please follow me to sightsee !!!`. Hide the follow button on your own profile. Remove the `map_logic.dart` import from `user_public_profile_page.dart` (it was only there for `logger`).
- [ ] **Step 2: Verify** `grep -n "cloud_firestore\|FirebaseFirestore" lib/pages/people_page.dart lib/pages/user_public_profile_page.dart lib/components/explore_list.dart lib/components/user_card.dart` → no output.
- [ ] **Step 3:** `flutter test` → PASS; analyze clean.
- [ ] **Step 4: Commit** `feat(mobile): people list, profiles and follow via the api`

### Task 6: FCM push, device registry, session

**Files:**
- Create: `apps/mobile/lib/services/push_registration.dart`, `apps/mobile/lib/services/push.dart`, `apps/mobile/lib/services/session.dart`
- Modify: `apps/mobile/pubspec.yaml` (`flutter pub add firebase_messaging`), `apps/mobile/lib/services/services.dart`, `apps/mobile/lib/main.dart`, `apps/mobile/android/app/src/main/AndroidManifest.xml`, `apps/mobile/ios/Runner/Info.plist`
- Test: `apps/mobile/test/services/push_registration_test.dart`

**Interfaces:**
- Consumes: `MemopinApi.getMe`, `registerDevice`, `unregisterDevice`, `getLocation`; `DetailsPage(location:)`; `fakeApi`
- Produces:
  - `class PushRegistration { PushRegistration({required MemopinApi api, required Future<String?> Function() fcmToken, required String platform, Duration signOutTimeout = const Duration(seconds: 5)}); Future<AppUser> onSignedIn(); Future<void> onTokenRefresh(String token); Future<void> beforeSignOut(); }`
    - `onSignedIn`: `getMe()` (errors propagate), then fetch the token and `registerDevice(token, platform)`. A failing or null token, or a failing register, is logged and swallowed. Remembers the registered token.
    - `onTokenRefresh`: registers the new token only between `onSignedIn` and `beforeSignOut`.
    - `beforeSignOut`: `unregisterDevice(lastToken)` bounded by `signOutTimeout`, all errors swallowed, then forgets the token.
  - `services.dart` adds `late final PushRegistration pushRegistration;` (platform `Platform.isIOS ? 'ios' : 'android'`, `fcmToken` = `FirebaseMessaging.instance.getToken()`) and `final navigatorKey = GlobalKey<NavigatorState>();`
  - `push.dart`: `Future<void> initPush(PushRegistration reg)`; `session.dart`: `void startSession(PushRegistration reg)`, `Future<void> signOut()`

- [ ] **Step 1: Write failing tests** (`fakeApi` records requests in order):
  - `onSignedIn calls GET /v1/me then POST /v1/me/devices` with body `{"token":"t:1","platform":"android"}`; returns the parsed `AppUser`.
  - `onSignedIn when fcmToken throws still returns the profile` → only `GET /v1/me` sent, no exception.
  - `onSignedIn when fcmToken is null skips registration`.
  - `onSignedIn when device POST fails still returns the profile` (POST → 500).
  - `onTokenRefresh before sign-in does nothing; after sign-in posts the new token`.
  - `beforeSignOut deletes the registered token` → `DELETE /v1/me/devices/t%3A1`; a second `beforeSignOut` sends nothing.
  - `beforeSignOut completes when DELETE fails` (`ClientException`) and `beforeSignOut completes when DELETE hangs` (handler never completes, `signOutTimeout: 50ms` → future completes within 1 s).
- [ ] **Step 2:** `flutter test test/services` → FAIL.
- [ ] **Step 3: Implement `push_registration.dart`**; tests → PASS.
- [ ] **Step 4: Implement glue.** `push.dart`: create Android channel `new_story` (name `New stories`, importance high) with `flutter_local_notifications`; `FirebaseMessaging.instance.requestPermission()` (also covers Android 13 `POST_NOTIFICATIONS`; remove the old `requestNotificationsPermission` call); `setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true)` for iOS. `FirebaseMessaging.onMessage` on Android shows `message.notification` title and body as a local notification on channel `new_story`, with payload `data['locationId']`. `onTokenRefresh` → `reg.onTokenRefresh`. Taps from `onMessageOpenedApp`, `getInitialMessage()` (handled in a post-frame callback so the navigator exists) and local `onDidReceiveNotificationResponse` all call `_openLocation(id)`, which does `api.getLocation(id)` then `navigatorKey.currentState?.push(DetailsPage(location:))`; errors are logged. No `onBackgroundMessage` handler (the OS shows notification messages in the background). `session.dart`: `FirebaseAuth.instance.authStateChanges()` → on a non-null user run `reg.onSignedIn()` (on first login and on every app start; both backend calls are idempotent), catching and logging errors. `signOut()` → `await pushRegistration.beforeSignOut()` then `FirebaseAuth.instance.signOut()`. `main.dart`: delete every Firestore listener (`registerNotification*`, `_followSubscription`, `_storySubscriptions`, `showNewStoryNotification`) and the `cloud_firestore`/`const.dart` imports. Order: `dotenv.load` → `Firebase.initializeApp()` → `initServices()` → `await initPush(pushRegistration)` → `startSession(pushRegistration)` → `runApp`. `MaterialApp(navigatorKey: navigatorKey, …)`. Android manifest: `<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="new_story"/>` inside `<application>`. `Info.plist`: `UIBackgroundModes` → `remote-notification`. The Xcode Push Notifications capability is a user step (Task 9).
- [ ] **Step 5:** `flutter test` → PASS; analyze clean; `grep -n "cloud_firestore\|FirebaseFirestore" lib/main.dart` → no output.
- [ ] **Step 6: Commit** `feat(mobile): fcm push and device registration replace firestore listeners`

### Task 7: My profile and create story (uploads + writes)

**Files:**
- Create: `apps/mobile/lib/services/uploads.dart`, `apps/mobile/lib/logic/validators.dart`, `apps/mobile/lib/logic/story_submitter.dart`
- Modify: `apps/mobile/lib/pages/my_profile_page.dart`, `apps/mobile/lib/pages/create_story_page.dart`, `apps/mobile/lib/services/services.dart` (if a submitter factory helps), `apps/mobile/lib/config.dart` (remove `defaultUserPhotoUrl`), `apps/mobile/.env.example` (remove `DEFAULT_USER_PHOTO_URL`; the backend assigns the default avatar)
- Test: `apps/mobile/test/logic/validators_test.dart`, `apps/mobile/test/logic/story_submitter_test.dart`, `apps/mobile/test/services/uploads_test.dart`

**Interfaces:**
- Consumes: `api.getMe`, `api.updateMe`, `api.createStory`, `signOut()` (Task 6), `UserStoriesTimeLine(uid:)`, `imageOrNull`
- Produces:
  - `String newUploadPath(String uid, {Random? random})` → `uploads/<uid>/<20 alphanumerics>.jpg`; `Future<String> uploadImage(File file)` (current user's uid, `SettableMetadata(contentType: 'image/jpeg')`, returns `getDownloadURL()`; throws `StateError` when signed out)
  - `String? validateDisplayName(String v)`, `String? validateStoryTitle(String v)`, `String? validateStoryType(String v)`, `String? validateStoryDescription(String v)`. Each returns `null` when valid, else a message (`Display name must be 1 to 50 characters`, `Title must be 1 to 100 characters`, `Type must be at most 50 characters`, `Description must be at most 2000 characters`).
  - `class StoryDraft { const StoryDraft({this.image, this.title = '', this.type = '', this.description = ''}); final File? image; final String title, type, description; }`
  - `class StoryValidationException implements Exception { final String message; }`
  - `class StorySubmitter { StorySubmitter({required MemopinApi api, required Future<String> Function(File image) upload, required Future<({double lat, double lng})?> Function() position}); bool get busy; Future<Story> submit(StoryDraft draft); }`. Order: validate (image required: `Please choose a photo`) → position (`null` → `Location permission is required to post a story`) → upload → `createStory` with the trimmed title. A call while busy returns the in-flight future.

- [ ] **Step 1: Write failing tests:**
  - `validators_test.dart`: `'  An  '` valid; `''`, `'   '`, `'a' * 51`, `'é' * 51` invalid; `'é' * 50` valid; title 100 runes valid / 101 invalid; type 51 invalid; description 2001 invalid.
  - `uploads_test.dart`: `newUploadPath('u1')` matches `RegExp(r'^uploads/u1/[A-Za-z0-9]{20}\.jpg$')`; two calls differ.
  - `story_submitter_test.dart` (fake `upload` and `position` record their calls; `fakeApi` returns 201): `blank title rejected before upload` (throws `StoryValidationException`, 0 uploads, 0 requests); `missing image rejected`; `no position rejected before upload`; `happy path posts trimmed title, uploaded URL and coordinates`; `concurrent submits upload and post once` (two `submit` calls before the first completes → 1 upload, 1 POST, both return the same story id); `api 422 propagates as ApiException unprocessable and busy resets to false`.
- [ ] **Step 2:** `flutter test test/logic test/services` → FAIL.
- [ ] **Step 3: Implement** the three files; tests → PASS.
- [ ] **Step 4: Wire pages.** `create_story_page.dart`: one `StorySubmitter` with `upload: uploadImage` and `position` = the existing geolocator permission flow mapped to a record. `pickImage(maxWidth: 1600, maxHeight: 1600, imageQuality: 85)`. The spinner is driven by `busy`. On success, show the SnackBar `Posted at <venueName>` and clear the form and image. `StoryValidationException` → its message; `ApiException` → `userMessage`. Remove `cloud_firestore`, `random_string`, the client-side nearest-place loop and `logger.d` noise. `my_profile_page.dart`: the sign-in UI and `verifyPhoneNumber` flow are unchanged, minus `userExisted`/`createUserPublicProfile` (Session runs `GET /v1/me`). The signed-in view uses `FutureBuilder` over `api.getMe()` (keep the `Future` in state; replace it after each write) and shows `followerCount` from the model (the separate follow query is gone). Edit name: `validator: validateDisplayName` → `api.updateMe(displayName: v.trim())`. Change photo: `pickImage(maxWidth: 512, maxHeight: 512, imageQuality: 85)` → `uploadImage` → `api.updateMe(photoUrl: url)`. Logout button → `signOut()`. Errors show a SnackBar with `userMessage`.
- [ ] **Step 5:** `flutter test` → PASS; analyze clean; `grep -rn "cloud_firestore\|FirebaseFirestore" lib` → only `lib/const.dart` is allowed to remain.
- [ ] **Step 6: Commit** `feat(mobile): profile edits and story posting via storage uploads and the api`

### Task 8: Remove Firestore, update docs

**Files:**
- Modify: `apps/mobile/pubspec.yaml` (remove `cloud_firestore`), `apps/mobile/pubspec.lock`, `apps/mobile/android/app/build.gradle.kts` (minSdk comment: "Firebase Auth / Messaging require API 23+"), `apps/mobile/README.md`, `README.md`, `CLAUDE.md`
- Delete: `apps/mobile/lib/const.dart`

- [ ] **Step 1:** `flutter pub remove cloud_firestore`, delete `lib/const.dart`, then `grep -rn "cloud_firestore\|FirebaseFirestore\|Timestamp\|const.dart" lib test pubspec.yaml` → no output.
- [ ] **Step 2: Docs.** `apps/mobile/README.md`: setup now needs `API_BASE_URL` (per-target values from `.env.example`), a running backend (`cd backend && make dev` with `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID` and `STORAGE_BUCKET` of the new project, after `gcloud auth application-default login`), and `flutterfire configure` (link `docs/setup/firebase-gcp.md` §4). Root `README.md` Features: backend is the Go API + Postgres; story counts refresh on reload (not live); real FCM push replaces "local notification while running"; drop "push notifications" from "Not yet supported"; list the unit tests. `CLAUDE.md` (gitignored, edit only, not committed): Project line (Go API + Firebase Auth/Storage/FCM, no Firestore), Commands (`flutter test` now runs real unit tests; delete the broken-template note), Architecture (`lib/api/`, `lib/services/`, `StoryPager`, push flow, schema section → API endpoints), `.env` keys (`API_BASE_URL`, no `DEFAULT_USER_PHOTO_URL`).
- [ ] **Step 3:** `flutter pub get && flutter analyze --no-fatal-infos && flutter test` → 0 errors/warnings, all PASS.
- [ ] **Step 4: Commit** (explicit paths; `CLAUDE.md` is not staged) `chore(mobile): drop cloud_firestore and document the api setup`

### Task 9: Firebase options, build, device smoke test — **BLOCKED on user setup**

Precondition (check first; if it fails, stop and report `BLOCKED: run docs/setup/firebase-gcp.md §4`): `test -f lib/firebase_options.dart`, and `android/app/google-services.json` has `"package_name": "com.memopin.app"` and a `project_id` other than `exploreapp-eda90`. The smoke test (Step 4) also needs §3 (phone auth plus test number `+84 900000001` / `123456`), §5 (bucket and rules deployed) and a reachable backend whose `STORAGE_BUCKET` equals the app's bucket.

**Files:**
- Modify: `apps/mobile/lib/main.dart`
- Add (generated by the user): `apps/mobile/lib/firebase_options.dart`, `apps/mobile/android/app/google-services.json`, `apps/mobile/ios/Runner/GoogleService-Info.plist`, plus `apps/mobile/firebase.json` if flutterfire wrote one

- [ ] **Step 1:** `main.dart`: `import 'firebase_options.dart';` and `await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);`.
- [ ] **Step 2:** `flutter analyze --no-fatal-infos && flutter test` → clean, PASS.
- [ ] **Step 3:** `flutter build apk --debug` → `✓ Built build/app/outputs/flutter-apk/app-debug.apk`.
- [ ] **Step 4: Manual smoke test** (Android emulator, `API_BASE_URL=http://10.0.2.2:8080` or the Cloud Run URL; report each item pass/fail):
  1. Sign in with `+84 900000001` / `123456` → My Profile shows `user +84900000001`; backend `devices` has a row for that user.
  2. Explore lists the seeded places with story counts; search `hồ` filters; the Map shows one marker per place.
  3. Post a story with a photo → `Posted at <place>`; it shows under that place's Local stories and in My Profile; the Storage object is under `uploads/<uid>/`.
  4. A second test account follows the first → the first posts again → the second device gets a push (app in background) and a heads-up notification (app in foreground); tapping it opens the place.
  5. Logout → that device's row is gone from `devices`; Create Story shows `Please Login :((((`.
- [ ] **Step 5 (iOS, optional; needs §6 APNs plus a paid Apple account):** in Xcode, enable the Push Notifications capability on Runner (adds `aps-environment` to `Runner.entitlements`). Run on a real device and repeat smoke item 4. Skip and report if it is not available.
- [ ] **Step 6: Commit** `git add lib/main.dart lib/firebase_options.dart android/app/google-services.json ios/Runner/GoogleService-Info.plist` (plus `firebase.json`, `ios/Runner/Runner.entitlements`, `ios/Runner.xcodeproj/project.pbxproj` if changed) → `feat(mobile): initialize firebase from flutterfire options`. These files hold client identifiers, not secrets (setup guide §4).
