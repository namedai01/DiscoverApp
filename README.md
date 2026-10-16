# DISCOVERAPP

Monorepo for Explore App.

```
apps/
  mobile/        Flutter app (package `exploreapp`)
```

Planned: `apps/web/` (web client), `backend/` (server). Add each as its own top-level project with its own README.

## Mobile app

```bash
cd apps/mobile
cp .env.example .env
flutter pub get
flutter run
```

Requires Flutter 3.47+ (Dart 3.13+). See `apps/mobile/README.md`.
