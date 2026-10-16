import 'package:flutter/material.dart';
import 'package:wemapgl/wemapgl.dart';

class RouteApp extends StatefulWidget {
  final LatLng origin;
  final LatLng destination;
  const RouteApp({this.origin, this.destination});

  @override
  _State createState() =>
      _State(origin: this.origin, destination: this.destination);
}

class _State extends State<RouteApp> {
  final LatLng origin;
  final LatLng destination;
  _State({this.origin, this.destination});

  // LatLng originalPoint = new LatLng(21.06442, 105.82272);
  // LatLng destinationPoint = new LatLng(21.039827, 105.671595);

  @override
  Widget build(BuildContext context) {
    return Expanded(
        child: WeMapDirection(
      originPlace: WeMapPlace(location: this.origin),
      destinationPlace: WeMapPlace(location: this.destination),
    ));

    // return Container(
    //   height: 50,
    //   child: WeMapDirection(
    //     originPlace: WeMapPlace(location: this.origin),
    //     destinationPlace: WeMapPlace(location: this.destination),
    //   ),
    // );
  }
}
