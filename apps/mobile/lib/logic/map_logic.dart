import 'package:flutter/material.dart';
import 'package:logger/logger.dart';
import 'package:wemapgl/wemapgl.dart';

var logger = Logger();

/// Animates the Camera Position to desired Location.
void moveToLocation(
    {@required LatLng latLng,
    double zoom,
    @required WeMapController mapController}) {
  mapController.moveCamera(
    CameraUpdate.newCameraPosition(
      CameraPosition(
        target: latLng,
        zoom: 20.0,
      ),
    ),
  );
}

/// Add Items Name in DropDownMenu from FireStore.
addDDMenuItems(snaps, locationsList) {
  for (int i = 0; i < snaps.length; ++i) {
    locationsList.add(DropdownMenuItem(
      child: Text(snaps[i]['venueName']),
      // value: snaps[i]['venueName'],
      value: LatLng(snaps[i]["latN"], snaps[i]["longE"]),
    ));
  }
}

/// Add Markers on the Map retrieved from FireStore.
addMarkers(snaps, markersList, mapController) async {
  for (int i = 0; i < snaps.length; ++i) {
    await mapController.addCircle(CircleOptions(
        geometry: LatLng(snaps[i]["latN"], snaps[i]["longE"]),
        circleRadius: 8.0,
        circleColor: '#d3d3d3',
        circleStrokeWidth: 1.5,
        circleStrokeColor: '#0071bc'));
  }
}

/// Add Locations to be animated to from FireStore.
// addLocationCoordinates(snaps, locationsLatLng) {
//   for (int i = 0; i < snaps.length; ++i) {
//     locationsLatLng.add(LatLng(snaps[i]['latN'], snaps[i]['longE']));
//   }
// }
