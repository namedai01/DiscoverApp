import 'dart:math';
import 'package:exploreapp/components/main_card.dart';
import 'package:exploreapp/pages/route_app.dart';
import 'package:flutter/material.dart';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:logger/logger.dart';

import '../components/page_heading.dart';
import '../logic/map_logic.dart';

import 'package:wemapgl/wemapgl.dart';
import 'package:wemapgl_platform_interface/wemapgl_platform_interface.dart';

import 'details_page.dart';

import 'package:geolocator/geolocator.dart';

class MapsPage extends StatefulWidget {
  @override
  _MapsPageState createState() => _MapsPageState();
}

class _MapsPageState extends State<MapsPage> {
  final FirebaseFirestore locationsFSI = FirebaseFirestore.instance;
  var logger = Logger();
  WeMapController mapController;

  /// All these datas are coming from Firestore.
  List<DropdownMenuItem> locationsList = [];
  List<Symbol> markersList = [];
  // List<LatLng> locationsLatLng = [];

  LatLng myPositon;
  var currentLatLng;

  var displaySelectedLocation;
  var activeWidget;

  Circle _selectedLocation;

  /// This is the main Map Widget.
  Widget theMap() {
    return StreamBuilder(
      stream:
          locationsFSI.collection('locations').orderBy('venueName').snapshots(),
      builder: (BuildContext context, AsyncSnapshot snapshot) {
        if (!snapshot.hasData) {
          locationsList = [
            DropdownMenuItem(
              child: Text('No Data Found'),
              value: 'No Data Found',
            )
          ];
        } else {
          locationsList = [];

          /// List location put in DropdownMenuItem
          addDDMenuItems(snapshot.data.docs, locationsList);

          /// Add the point imply location
          addMarkers(snapshot.data.docs, markersList, mapController);
          // addLocationCoordinates(snapshot.data.docs, locationsLatLng);
          // logger.d("locationsLatLng", locationsLatLng);
        }
        return Column(
          children: <Widget>[
            pageHeader('Map', 30),
            SizedBox(height: 20),
            Container(
              width: MediaQuery.of(context).size.width - 60,
              height: 50,
              padding: EdgeInsets.fromLTRB(15, 0, 10, 0),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Color(0xffefefef),
                borderRadius: BorderRadius.circular(5),
              ),
              child: DropdownButtonFormField(
                hint: Text('Choose a Location'),
                items: locationsList,
                decoration: InputDecoration(
                  border: InputBorder.none,
                ),
                // onTap: () {
                //
                // },
                onChanged: (currentLocationSelected) {
                  setState(() {
                    displaySelectedLocation = currentLocationSelected;
                  });
                  showPhotoOptions(currentLocationSelected);

                  /// Animates the Camera Position to desired Location.
                  moveToLocation(
                    zoom: 15,
                    latLng: displaySelectedLocation,
                    mapController: mapController,
                  );
                },
                value: displaySelectedLocation,
                isExpanded: true,
              ),
            ),
            SizedBox(height: 20),
            Container(
              height: MediaQuery.of(context).size.height - 310,
              width: MediaQuery.of(context).size.width - 60,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(5),
                child: WeMap(
                  onMapCreated: assignMapController,
                  initialCameraPosition: const CameraPosition(
                      target: LatLng(21.03, 105.78), zoom: 5.0),
                  compassEnabled: true,
                  compassViewMargins: Point(24, 550),
                  reverse: true,
                  onMapClick: (point, latlng, place) async {},
                  destinationIcon: "assets/icons/destination.png",
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  /// This is placeholder for the main Map Widget, as the transition from
  /// One Tab to another causes blinking as Map Tab is in between.

  Widget mapPlaceHolder() {
    return ListView(
      physics: NeverScrollableScrollPhysics(),
      padding: EdgeInsets.only(left: 30, right: 30, top: 0),
      children: <Widget>[
        pageHeader('Map', 0),
        SizedBox(height: 20),
        Container(
          height: 50,
          padding: EdgeInsets.fromLTRB(15, 0, 10, 0),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Color(0xffefefef),
            borderRadius: BorderRadius.circular(5),
          ),
          child: DropdownButtonFormField(
            hint: Text('Choose a Location'),
            items: locationsList,
            decoration: InputDecoration(
              border: InputBorder.none,
            ),
            onChanged: (currentLocationSelected) {},
            value: displaySelectedLocation,
          ),
        ),
        SizedBox(height: 20),
        Container(
          height: 800,
          color: Color(0xffefefef),
        ),
      ],
    );
  }

  void showPhotoOptions(LatLng displaySelectedLocation) {
    showModalBottomSheet<void>(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(15.0),
        ),
        context: context,
        builder: (BuildContext context) {
          return Container(
              child: new Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: ListView(
                    children: <Widget>[
                      ListTile(
                          title: Text('Direction',
                              textAlign: TextAlign.center,
                              style: new TextStyle(
                                  color: Colors.black87, fontSize: 24.0)),
                          onTap: () async {
                            var my = await Geolocator()
                                  .getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
                            goToDirectionScreen(LatLng(my.latitude, my.longitude), displaySelectedLocation);
                          }),
                    ],
                  ))
            // )));
          );
        });
  }

  void goToDirectionScreen(LatLng origin, LatLng destination) {

    Navigator.push(context, MaterialPageRoute(builder: (_) {
      return RouteApp(
        origin: origin,
        destination: destination,
        // original: new LatLng(21.06442, 105.82272),
        // destination: new LatLng(21.039827, 105.671595),
      );
    }));
  }

  /// This Function delays loading of the Map for smooth transition between Tabs.
  delayMap() async {
    await Future.delayed(Duration(milliseconds: 500));
    if (this.mounted) {
      setState(() {
        activeWidget = theMap();
      });
    }
  }

  @override
  void initState() {
    super.initState();
    activeWidget = mapPlaceHolder();
  }

  /// This function assigns controller to the Map.
  void assignMapController(controller) {
    setState(() {
      mapController = controller;
      /// When location is tapped, it will navigate to the location detail page.
      mapController.onCircleTapped.add(_onLocationTapped);
    });
  }
  /// The function roud the double to the "places(th)"
  double roundDouble(double value, int places) {
    double mod = pow(10.0, places);
    return ((value * mod).round().toDouble() / mod);
  }

  /// When location is tapped, it will navigate to the location detail page.
  Future<void> _onLocationTapped(Circle location) async {
    setState(() {
      _selectedLocation = location;
    });

    /// Get the spec location from firestore
    logger.d("location", roundDouble(location.options.geometry.longitude, 7));
    await locationsFSI
        .collection('locations')
        .where("latN",
            isEqualTo: roundDouble(location.options.geometry.latitude, 7))
        .where("longE",
            isEqualTo: roundDouble(location.options.geometry.longitude, 7))
        .get()
        .then((snapshot) async {
          /// calc the number stories
      await locationsFSI
          .collection('stories')
          .orderBy('storyTime', descending: true)
          .where('locationId', isEqualTo: snapshot.docs[0].id)
          .get()
          .then((value) {
        logger.d("maps_pages_snapshot", value.docs.length);
        /// Navigate to the details page
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (BuildContext context) => DetailsPage(
              imagePath: snapshot.docs[0].get("imagePath"),
              venueName: snapshot.docs[0].get("venueName"),
              venueLocation: snapshot.docs[0].get("venueLocation"),
              description: snapshot.docs[0].get("description"),
              numberStories: value.docs.length,
              locationID: snapshot.docs[0].id,
            ),
          ),
        );
      });
    });
  }

  /// This the main Widget of the page which displays all the contents.
  @override
  Widget build(BuildContext context) {
    // delayMap();
    setState(() {
      activeWidget = theMap();
    });
    return activeWidget;
  }
}
