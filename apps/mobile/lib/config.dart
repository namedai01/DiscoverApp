import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:latlong2/latlong.dart';

/// Runtime config read from the bundled `.env` (template: `.env.example`).
/// Only valid after `dotenv.load()` in `main()`.
abstract final class AppConfig {
  /// Base URL of the Memopin API, e.g. `http://10.0.2.2:8080`. Required.
  static String get apiBaseUrl {
    final url = dotenv.maybeGet('API_BASE_URL');
    if (url == null || url.trim().isEmpty) {
      throw StateError('API_BASE_URL is missing in .env');
    }
    return url.trim();
  }

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
