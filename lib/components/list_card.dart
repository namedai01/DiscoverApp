import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:exploreapp/logic/map_logic.dart';
import 'package:exploreapp/utils.dart';
import 'package:flutter/material.dart';

import '../const.dart';

//Shows ListTile kind of Custom Widget to display Stories.
class ListCard extends StatefulWidget {
  final String storyImage;
  final String storyTitle;
  final Timestamp storyTime;
  final String storyType;
  final String locationID;

  ListCard({
    this.storyImage,
    this.storyTitle,
    this.storyTime,
    this.storyType,
    this.locationID,
  });

  @override
  _ListCardState createState() => _ListCardState();
}
class _ListCardState extends State<ListCard> {
  final FirebaseFirestore firestore = FirebaseFirestore.instance;
  var locationName;
  @override
  void initState() {
    super.initState();
    locationName = "";
    firestore
        .collection(locationCollectionPath)
        .doc(widget.locationID)
        .get()
        .then((value) {
          if (value != null) {
            // logger.d("user_stories_timeline.dart", value["venueName"]);
            setState(() {
              locationName = value["venueName"];
            });
          }
        });
  }
  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Hero(
          tag: 'HeroTag ' + widget.storyTitle,
          child: Container(
            height: 80,
            width: 80,
            decoration: BoxDecoration(
              image: DecorationImage(
                image: NetworkImage(widget.storyImage),
                fit: BoxFit.cover,
              ),
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
                    style: Theme.of(context).textTheme.body1,
                    children: [
                      WidgetSpan(child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2.0),
                        child: Icon(Icons.title),
                      )),
                      TextSpan(text: widget.storyTitle, style: TextStyle(fontSize: 15))
                    ]
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
                    style: Theme.of(context).textTheme.body1,
                    children: [
                      WidgetSpan(child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2.0),
                        child: Icon(Icons.location_on_outlined),
                      )),
                      TextSpan(text: locationName, style: TextStyle(fontSize: 15))
                    ]
                ),
              ),
            ),
            SizedBox(height: 5),
            Container(
              //This container prevents Parent Row from expandeing beyond width.
              width: MediaQuery.of(context).size.width - 160,
              child: RichText(
                text: TextSpan(
                    style: Theme.of(context).textTheme.body1,
                    children: [
                      WidgetSpan(child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2.0),
                        child: Icon(Icons.access_time),
                      )),
                      TextSpan(
                        text: getFormattedTimeDistanceToCurrent(widget.storyTime) + ' . ' + widget.storyType,
                        style: TextStyle(
                          fontFamily: 'OpenSans',
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: Color(0xffacacac),
                        )
                      )
                    ]
                ),
              ),
              // child: Text(
              //   getFormattedTimeDistanceToCurrent(widget.storyTime) +
              //       '  .  ' +
              //       widget.storyType,
              //   textAlign: TextAlign.left,
              //   style: TextStyle(
              //     fontFamily: 'OpenSans',
              //     fontWeight: FontWeight.w600,
              //     fontSize: 14,
              //     color: Color(0xffacacac),
              //   ),
              // ),
            ),
          ],
        ),
      ],
    );
  }

}
