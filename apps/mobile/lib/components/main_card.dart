import 'package:flutter/material.dart';

import '../api/models.dart';
import '../pages/details_page.dart';
import 'net_image.dart';

//This are the stars of the App, the main Widgets displaying covers of Locations.
class MainCard extends StatelessWidget {
  final Location location;

  const MainCard({super.key, required this.location});

  @override
  Widget build(BuildContext context) {
    final image = imageOrNull(location.imageUrl);
    return GestureDetector(
      onTap: () {
        // Creates Details Page for respective Data.
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (BuildContext context) =>
                DetailsPage(location: location),
          ),
        );
      },
      child: Hero(
        tag: 'MainCard ${location.id}',
        child: Container(
          width: MediaQuery.of(context).size.width - 60,
          padding: EdgeInsets.symmetric(horizontal: 35),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(5),
            color: Colors.grey[300],
            image: image == null
                ? null
                : DecorationImage(
                    image: image,
                    fit: BoxFit.cover,
                    colorFilter: ColorFilter.mode(
                      Colors.black.withValues(alpha: 0.2),
                      BlendMode.multiply,
                    ),
                  ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end, //Arranges from bottom.
            children: <Widget>[
              Material(
                //Venue Name
                color: Colors.transparent,
                child: Text(
                  location.venueName,
                  textAlign: TextAlign.left,
                  maxLines: 1,
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 28,
                  ),
                ),
              ),
              SizedBox(height: 5),
              Material(
                //Venue Location + story count.
                color: Colors.transparent,
                child: Text(
                  '${location.venueLocation}  .  ${location.storyCount} Stories',
                  textAlign: TextAlign.left,
                  style: TextStyle(
                    fontFamily: 'OpenSans',
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Colors.white,
                  ),
                ),
              ),
              SizedBox(height: 30),
              Material(
                //Explore Button
                color: Colors.transparent,
                child: Text(
                  'EXPLORE',
                  style: TextStyle(
                    fontFamily: 'OpenSans',
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
              ),
              SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}
