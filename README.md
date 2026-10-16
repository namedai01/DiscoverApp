# DISCOVERAPP

Monorepo for Explore App.

```
apps/
  mobile/        Flutter app (package `exploreapp`)
packages/
  wemapgl/       WeMap Flutter SDK (vendored, used by apps/mobile via path dependency)
```

Planned: `apps/web/` (web client), `backend/` (server). Add each as its own top-level project with its own README.

## Mobile app

```bash
cd apps/mobile
cp .env.example .env
flutter pub get
flutter run
```

**Don't upgrade dependencies.** Requires a Flutter 2.x SDK (pre-null-safety). See `apps/mobile/README.md`.
