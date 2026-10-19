import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:logger/logger.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/models.dart';

var logger = Logger();

/// Coordinates of a [Location].
LatLng locationLatLng(Location l) => LatLng(l.lat, l.lng);

/// Animates the Camera Position to desired Location.
void moveToLocation({
  required LatLng latLng,
  double zoom = 15,
  required MapController mapController,
}) {
  mapController.move(latLng, zoom);
}

/// Items for the location dropdown. The value is the location id.
List<DropdownMenuItem<String>> buildDDMenuItems(List<Location> locations) {
  return [
    for (final l in locations)
      DropdownMenuItem<String>(value: l.id, child: Text(l.venueName)),
  ];
}

/// One marker per location on the map.
List<Marker> buildMarkers(
  List<Location> locations,
  void Function(Location location) onTap,
) {
  return [
    for (final l in locations)
      Marker(
        point: locationLatLng(l),
        width: 20,
        height: 20,
        child: GestureDetector(
          onTap: () => onTap(l),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xffd3d3d3),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xff0071bc), width: 1.5),
            ),
          ),
        ),
      ),
  ];
}

/// URL that opens turn-by-turn directions to [destination] in an external
/// maps app, starting from the device's current location.
Uri directionsUri(LatLng destination) {
  // Google Maps URL on every platform: opens the Google Maps app when
  // installed, otherwise the browser.
  return Uri.https('www.google.com', '/maps/dir/', {
    'api': '1',
    'destination': '${destination.latitude},${destination.longitude}',
  });
}

/// Opens directions to [destination] outside the app.
Future<void> openDirections(LatLng destination) async {
  final uri = directionsUri(destination);
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
    logger.w('Could not launch $uri');
  }
}
