import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:latlong2/latlong.dart';

/// Runtime config read from the bundled `.env` (template: `.env.example`).
/// Only valid after `dotenv.load()` in `main()`.
abstract final class AppConfig {
  /// Avatar given to a user on first login.
  static String? get defaultUserPhotoUrl =>
      dotenv.maybeGet('DEFAULT_USER_PHOTO_URL');

  /// `{z}/{x}/{y}` tile template. OSM public tiles are not for production.
  static String get mapTileUrl => dotenv.get(
    'MAP_TILE_URL',
    fallback: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  );

  static String get mapAttribution =>
      dotenv.get('MAP_ATTRIBUTION', fallback: 'OpenStreetMap contributors');

  static LatLng get mapInitialCenter => LatLng(
    dotenv.getDouble('MAP_INITIAL_LAT', fallback: 21.03),
    dotenv.getDouble('MAP_INITIAL_LNG', fallback: 105.78),
  );

  static double get mapInitialZoom =>
      dotenv.getDouble('MAP_INITIAL_ZOOM', fallback: 5.0);
}
