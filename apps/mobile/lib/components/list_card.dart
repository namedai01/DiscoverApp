import 'package:flutter/material.dart';
import 'package:memopin/api/models.dart';
import 'package:memopin/components/net_image.dart';
import 'package:memopin/utils.dart';

//Shows ListTile kind of Custom Widget to display Stories.
class ListCard extends StatelessWidget {
  final Story story;

  const ListCard({super.key, required this.story});

  @override
  Widget build(BuildContext context) {
    final image = imageOrNull(story.imageUrl);
    return Row(
      children: <Widget>[
        Hero(
          tag: 'HeroTag ' + story.id,
          child: Container(
            height: 80,
            width: 80,
            decoration: BoxDecoration(
              image: image == null
                  ? null
                  : DecorationImage(image: image, fit: BoxFit.cover),
              borderRadius: BorderRadius.circular(9),
              color: Colors.grey[300],
            ),
          ),
        ),
        SizedBox(width: 10),
        Column(
          children: <Widget>[
            Container(
              //This container prevents Parent Row from expandeing beyond width.
              width: MediaQuery.of(context).size.width - 160,
              child: RichText(
                overflow: TextOverflow.ellipsis,
                text: TextSpan(
                  style: Theme.of(context).textTheme.bodyMedium,
                  children: [
                    WidgetSpan(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2.0),
                        child: Icon(Icons.title),
                      ),
                    ),
                    TextSpan(
                      text: story.title,
                      style: TextStyle(fontSize: 15),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 5),
            Container(
              //This container prevents Parent Row from expandeing beyond width.
              width: MediaQuery.of(context).size.width - 160,
              child: RichText(
                overflow: TextOverflow.ellipsis,
                text: TextSpan(
                  style: Theme.of(context).textTheme.bodyMedium,
                  children: [
                    WidgetSpan(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2.0),
                        child: Icon(Icons.location_on_outlined),
                      ),
                    ),
                    TextSpan(
                      text: story.venueName,
                      style: TextStyle(fontSize: 15),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 5),
            Container(
              //This container prevents Parent Row from expandeing beyond width.
              width: MediaQuery.of(context).size.width - 160,
              child: RichText(
                text: TextSpan(
                  style: Theme.of(context).textTheme.bodyMedium,
                  children: [
                    WidgetSpan(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2.0),
                        child: Icon(Icons.access_time),
                      ),
                    ),
                    TextSpan(
                      text:
                          getFormattedTimeDistanceToCurrent(story.createdAt) +
                          ' . ' +
                          story.type,
                      style: TextStyle(
                        fontFamily: 'OpenSans',
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: Color(0xffacacac),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
