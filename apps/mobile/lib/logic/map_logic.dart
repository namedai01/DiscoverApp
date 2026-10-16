import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:logger/logger.dart';
import 'package:url_launcher/url_launcher.dart';

var logger = Logger();

/// Coordinates of a `locations` document.
LatLng locationLatLng(DocumentSnapshot<Map<String, dynamic>> doc) =>
    LatLng((doc['latN'] as num).toDouble(), (doc['longE'] as num).toDouble());

/// Animates the Camera Position to desired Location.
void moveToLocation({
  required LatLng latLng,
  double zoom = 15,
  required MapController mapController,
}) {
  mapController.move(latLng, zoom);
}

/// Add Items Name in DropDownMenu from FireStore. Value is the location doc id.
List<DropdownMenuItem<String>> buildDDMenuItems(
  List<DocumentSnapshot<Map<String, dynamic>>> snaps,
) {
  return [
    for (final doc in snaps)
      DropdownMenuItem<String>(value: doc.id, child: Text(doc['venueName'])),
  ];
}

/// Build Markers on the Map retrieved from FireStore.
List<Marker> buildMarkers(
  List<DocumentSnapshot<Map<String, dynamic>>> snaps,
  void Function(DocumentSnapshot<Map<String, dynamic>> doc) onTap,
) {
  return [
    for (final doc in snaps)
      Marker(
        point: locationLatLng(doc),
        width: 20,
        height: 20,
        child: GestureDetector(
          onTap: () => onTap(doc),
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
  // TODO(dainguyen): pick the directions provider / travel mode (see chat).
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
