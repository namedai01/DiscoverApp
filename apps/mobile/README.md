# Explore App (mobile)

Flutter 3.47+ / Dart 3.13+, null-safe.

```bash
cp .env.example .env
flutter pub get
flutter run
```

- Map tab uses `flutter_map` with public OpenStreetMap tiles. OSM's tile policy does not allow heavy production traffic: before release, point `TileLayer.urlTemplate` in `lib/pages/maps_page.dart` at a hosted tile provider.
- iOS: add `ios/Runner/GoogleService-Info.plist` (not committed) before running on iOS.
