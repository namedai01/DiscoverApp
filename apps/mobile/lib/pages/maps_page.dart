import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../components/page_heading.dart';
import '../config.dart';
import '../logic/map_logic.dart';
import '../services/services.dart';
import 'details_page.dart';

class MapsPage extends StatefulWidget {
  const MapsPage({super.key});

  @override
  State<MapsPage> createState() => _MapsPageState();
}

class _MapsPageState extends State<MapsPage> {
  final MapController mapController = MapController();
  late Future<List<Location>> _locations;
  Object? _reportedError;

  /// Id of the location chosen in the dropdown.
  String? displaySelectedLocation;

  @override
  void initState() {
    super.initState();
    _locations = api.allLocations();
  }

  @override
  void dispose() {
    mapController.dispose();
    super.dispose();
  }

  /// This is the main Map Widget.
  Widget theMap(List<Location> locations) {
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
              final location = locations.where((l) => l.id == id).firstOrNull;
              if (location == null) return;
              setState(() {
                displaySelectedLocation = id;
              });

              /// Animates the Camera Position to desired Location.
              moveToLocation(
                latLng: locationLatLng(location),
                mapController: mapController,
              );
              showDirectionOptions(locationLatLng(location));
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
  void _onLocationTapped(Location location) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (BuildContext context) => DetailsPage(location: location),
      ),
    );
  }

  void _showLoadError(Object error) {
    if (identical(error, _reportedError)) return;
    _reportedError = error;
    final message = error is ApiException
        ? error.userMessage
        : 'Something went wrong.';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    });
  }

  /// This the main Widget of the page which displays all the contents.
  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Location>>(
      future: _locations,
      builder: (BuildContext context, AsyncSnapshot<List<Location>> snapshot) {
        final error = snapshot.error;
        if (error != null) _showLoadError(error);
        return theMap(snapshot.data ?? const <Location>[]);
      },
    );
  }
}
