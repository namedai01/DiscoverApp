import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:exploreapp/components/list_card.dart';
import 'package:exploreapp/const.dart';
import 'package:exploreapp/logic/map_logic.dart';
import 'package:exploreapp/pages/story_page.dart';
import 'package:exploreapp/utils.dart';
import 'package:flutter/material.dart';
import 'package:timelines/timelines.dart';

class UserStoriesTimeLine extends StatefulWidget {
  final String uid;

  const UserStoriesTimeLine({Key key, this.uid}) : super(key: key);

  @override
  _UserStoriesTimeLineState createState() => _UserStoriesTimeLineState();
}

class _UserStoriesTimeLineState extends State<UserStoriesTimeLine> {
  final FirebaseFirestore firestore = FirebaseFirestore.instance;
  bool loading = true;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
        stream: firestore
            .collection(storiesCollectionPath)
            .where('owner', isEqualTo: widget.uid)
            .orderBy('storyTime', descending: true)
            .snapshots(),
        builder: (BuildContext context, AsyncSnapshot snapshot) {
          if (!snapshot.hasData) {
            return Center(
              child: Text('No stories yet'),
            );
          }
          List stories = snapshot.data.docs;

          return Timeline.tileBuilder(
            theme: TimelineThemeData(
              nodePosition: 0,
              color: Color(0xff989898),
              indicatorTheme: IndicatorThemeData(
                position: 0,
                size: 20.0,
              ),
              connectorTheme: ConnectorThemeData(
                thickness: 2.5,
              ),
            ),
            builder: TimelineTileBuilder.connected(
              connectionDirection: ConnectionDirection.before,
              indicatorBuilder: (context, index) {
                return DotIndicator(
                  color: Colors.black38,
                );
              },
              lastConnectorBuilder: (context) {
                return SolidLineConnector(
                  color: Colors.black38,
                );
              },
              connectorBuilder: (_, index, connectorType) {
                return SolidLineConnector(
                  indent: connectorType == ConnectorType.start ? 0 : 2.0,
                  endIndent: connectorType == ConnectorType.end ? 0 : 2.0,
                  color: Color(0xffc2c5c9),
                );
              },
              contentsBuilder: (BuildContext context, int index) {
                // var locationName = "";
                // firestore
                //     .collection(locationCollectionPath)
                //     .where('id', isEqualTo: stories[index]["locationId"])
                //     .get()
                //     .then((value) {
                //
                //       locationName = value.docs[0]["venueName"];
                //       logger.d("ưdwd", value.docs[0]["venueName"]);
                //     });
                // logger.d("user_stories_timeline.dart", locationName);

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("  " + getFormattedTimeStamp(stories[index]['storyTime'])),
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (BuildContext context) => StoryPage(
                                storyImage: snapshot.data.docs[index]
                                    ['storyImage'],
                                storyTitle: snapshot.data.docs[index]
                                    ['storyTitle'],
                                storyTime: snapshot.data.docs[index]
                                    ['storyTime'],
                                storyType: snapshot.data.docs[index]
                                    ['storyType'],
                                storyDescription: snapshot.data.docs[index]
                                    ['storyDescription'],
                              ),
                            ),
                          );
                        },
                        child: ListCard(
                            storyImage: snapshot.data.docs[index]['storyImage'],
                            storyTitle: snapshot.data.docs[index]['storyTitle'],
                            storyTime: snapshot.data.docs[index]['storyTime'],
                            storyType: snapshot.data.docs[index]['storyType'],
                            locationID: snapshot.data.docs[index]
                                ['locationId']),
                      ),
                    ),
                  ],
                );
              },
              itemCount: stories.length,
            ),
          );
        });
  }
}
