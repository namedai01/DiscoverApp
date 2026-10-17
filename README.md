# DISCOVERAPP

Monorepo for Explore App.

```
apps/
  mobile/        Flutter app (package `exploreapp`)
```

Planned: `apps/web/` (web client), `backend/` (server). Add each as its own top-level project with its own README.

## Features

Explore App lets users browse places, post photo stories tied to a place, follow other users, and see places on a map. Backend is Firebase (Auth, Firestore, Storage). The app has 5 tabs: Explore, People, Maps, Create Story, My Profile.

### Explore places

- Horizontal card list of all `locations`, sorted by name. Each card shows cover photo, name, area and a live story count.
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
- Photo is uploaded to Firebase Storage; the story is saved to `stories`.

### Map

- OpenStreetMap map (`flutter_map`) with one marker per place; tap a marker to open its details.
- Pick a place from the dropdown to move the camera there, then "Direction" opens an external maps app for routing. There is no in-app routing.

### Account and app

- Phone number sign-in with SMS code. A `users` profile is created on first sign-in.
- My Profile: change display name and avatar, see follower count and own stories, sign out.
- Local notification when someone you follow posts a new story (works while the app is running; no push notifications).
- Accent color theme (Yellow, Red, Blue, Green, Pink), saved on device.
- "No internet" dialog when the connection drops.

### Not yet supported

Likes, comments, editing or deleting stories, in-app routing, push notifications (FCM), automated tests.

## Mobile app

```bash
cd apps/mobile
cp .env.example .env
flutter pub get
flutter run
```

Requires Flutter 3.47+ (Dart 3.13+). See `apps/mobile/README.md`.
