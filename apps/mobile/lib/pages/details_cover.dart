import 'package:flutter/material.dart';

import '../api/models.dart';
import '../components/net_image.dart';

class DetailsCover extends StatelessWidget {
  final Location location;

  const DetailsCover({super.key, required this.location});

  @override
  Widget build(BuildContext context) {
    final image = imageOrNull(location.imageUrl);
    return Hero(
      tag: location.venueName + 'MainCard',
      child: Container(
        height: MediaQuery.of(context).size.height,
        padding: EdgeInsets.symmetric(horizontal: 35),
        decoration: BoxDecoration(
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
          mainAxisAlignment: MainAxisAlignment.end,
          children: <Widget>[
            Material(
              //Venue Name
              color: Colors.transparent,
              child: Text(
                location.venueName,
                textAlign: TextAlign.left,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 28,
                ),
              ),
            ),
            SizedBox(height: 5),
            Material(
              //Venue Location + some other details.
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
            SizedBox(height: (MediaQuery.of(context).size.height / 3)),
          ],
        ),
      ),
    );
  }
}
