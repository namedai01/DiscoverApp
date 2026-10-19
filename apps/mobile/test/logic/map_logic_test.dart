import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:memopin/api/models.dart';
import 'package:memopin/logic/map_logic.dart';

Location loc(String id, String name, double lat, double lng) => Location(
  id: id,
  venueName: name,
  venueLocation: 'Da Nang',
  description: 'd',
  imageUrl: '',
  lat: lat,
  lng: lng,
  storyCount: 0,
);

void main() {
  final locations = [
    loc('a', 'Han River', 16.05, 108.2),
    loc('b', 'Marble Mountains', 16.0, 108.26),
  ];

  test('buildMarkers makes one marker per location at lat/lng', () {
    final tapped = <Location>[];
    final markers = buildMarkers(locations, tapped.add);
    expect(markers, hasLength(2));
    expect(markers.first.point, LatLng(16.05, 108.2));
    expect(markers.last.point, LatLng(16.0, 108.26));
  });

  test('buildDDMenuItems uses location ids as values', () {
    final items = buildDDMenuItems(locations);
    expect(items.map((i) => i.value), ['a', 'b']);
  });
}
