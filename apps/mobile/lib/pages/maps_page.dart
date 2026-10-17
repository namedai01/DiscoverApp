import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../components/page_heading.dart';
import '../config.dart';
import '../const.dart';
import '../logic/map_logic.dart';
import 'details_page.dart';

class MapsPage extends StatefulWidget {
  const MapsPage({super.key});

  @override
  State<MapsPage> createState() => _MapsPageState();
}

class _MapsPageState extends State<MapsPage> {
  final FirebaseFirestore locationsFSI = FirebaseFirestore.instance;
  final MapController mapController = MapController();

  /// Doc id of the location chosen in the dropdown.
  String? displaySelectedLocation;

  @override
  void dispose() {
    mapController.dispose();
    super.dispose();
  }

  /// This is the main Map Widget.
  Widget theMap(List<DocumentSnapshot<Map<String, dynamic>>> locations) {
    return Column(
      children: <Widget>[
        pageHeader('Map', 30),
        const SizedBox(height: 20),
        Container(
          width: MediaQuery.of(context).size.width - 60,
          height: 50,
          padding: const EdgeInsets.fromLTRB(15, 0, 10, 0),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xffefefef),
            borderRadius: BorderRadius.circular(5),
          ),
          child: DropdownButtonFormField<String>(
            hint: const Text('Choose a Location'),
            items: locations.isEmpty
                ? const [
                    DropdownMenuItem(
                      value: 'No Data Found',
                      child: Text('No Data Found'),
                    ),
                  ]
                : buildDDMenuItems(locations),
            decoration: const InputDecoration(border: InputBorder.none),
            onChanged: (String? id) {
              final doc = locations.where((d) => d.id == id).firstOrNull;
              if (doc == null) return;
              setState(() {
                displaySelectedLocation = id;
              });

              /// Animates the Camera Position to desired Location.
              moveToLocation(
                latLng: locationLatLng(doc),
                mapController: mapController,
              );
              showDirectionOptions(locationLatLng(doc));
            },
            initialValue: displaySelectedLocation,
            isExpanded: true,
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: MediaQuery.of(context).size.height - 310,
          width: MediaQuery.of(context).size.width - 60,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: FlutterMap(
              mapController: mapController,
              options: MapOptions(
                initialCenter: AppConfig.mapInitialCenter,
                initialZoom: AppConfig.mapInitialZoom,
              ),
              children: [
                TileLayer(
                  urlTemplate: AppConfig.mapTileUrl,
                  userAgentPackageName: 'com.memopin.app',
                ),
                MarkerLayer(
                  markers: buildMarkers(locations, _onLocationTapped),
                ),
                SimpleAttributionWidget(
                  source: Text(AppConfig.mapAttribution),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void showDirectionOptions(LatLng destination) {
    showModalBottomSheet<void>(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.0)),
      context: context,
      builder: (BuildContext context) {
        return Padding(
          padding: const EdgeInsets.all(32.0),
          child: ListView(
            children: <Widget>[
              ListTile(
                title: const Text(
                  'Direction',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.black87, fontSize: 24.0),
                ),
                onTap: () {
                  Navigator.pop(context);
                  openDirections(destination);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  /// When location is tapped, it will navigate to the location detail page.
  Future<void> _onLocationTapped(
    DocumentSnapshot<Map<String, dynamic>> location,
  ) async {
    /// calc the number stories
    final count = await locationsFSI
        .collection(storiesCollectionPath)
        .where('locationId', isEqualTo: location.id)
        .count()
        .get();
    if (!mounted) return;

    /// Navigate to the details page
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (BuildContext context) => DetailsPage(
          imagePath: location['imagePath'],
          venueName: location['venueName'],
          venueLocation: location['venueLocation'],
          description: location['description'],
          numberStories: count.count ?? 0,
          locationID: location.id,
        ),
      ),
    );
  }

  /// This the main Widget of the page which displays all the contents.
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: locationsFSI
          .collection(locationCollectionPath)
          .orderBy('venueName')
          .snapshots(),
      builder:
          (
            BuildContext context,
            AsyncSnapshot<QuerySnapshot<Map<String, dynamic>>> snapshot,
          ) {
            return theMap(snapshot.data?.docs ?? []);
          },
    );
  }
}
