# Memopin (mobile)

Flutter 3.47+ / Dart 3.13+, null-safe. The app talks to the Memopin Go API (`backend/`) for all data and uses Firebase only for phone sign-in, photo uploads (Storage) and push (FCM). There is no Firestore.

## Setup

1. **Firebase project.** Run `flutterfire configure` against the Memopin project (see `docs/setup/firebase-gcp.md` section 4). Until then the Android build fails, because the committed `google-services.json` belongs to the old project. iOS also needs `ios/Runner/GoogleService-Info.plist` (not committed).
2. **Backend.** Start the API with Firebase auth, so it accepts the ID tokens the app sends:

   ```bash
   gcloud auth application-default login
   cd backend
   cp .env.example .env     # set AUTH_MODE=firebase, FIREBASE_PROJECT_ID and STORAGE_BUCKET of the new project
   make dev                 # Postgres in Docker + API on :8080
   ```

   The mobile app always signs in with Firebase; there is no fake-auth mode on the device.
3. **App config.** `cp .env.example .env` and set `API_BASE_URL` for your target (values are listed in `.env.example`: `http://10.0.2.2:8080` for the Android emulator, `http://localhost:8080` for the iOS simulator, `http://<LAN IP>:8080` for a physical device, the Cloud Run URL for a deployed API). `.env` is bundled into the app, so never put secrets in it.
4. Run:

   ```bash
   flutter pub get
   flutter run
   flutter analyze
   flutter test      # unit tests; need no Firebase project, device or network
   ```

## Notes

- Lists load on open and on search change; story lists (a place's and a user's) also support pull-to-refresh, while Explore and People have no pull-to-refresh and show a Retry button on failure. There are no live listeners. New stories from people you follow arrive as FCM push sent by the backend.
- Map tab uses `flutter_map` with public OpenStreetMap tiles. OSM's tile policy does not allow heavy production traffic: set `MAP_TILE_URL` in `.env` to a hosted tile provider before release.
