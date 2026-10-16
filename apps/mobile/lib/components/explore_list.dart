import 'package:exploreapp/components/user_card.dart';
import 'package:flutter/material.dart';

import './main_card.dart';

//List of Main Cards to be displayed on Explore Page.
Widget exploreList(datas) {
  return ListView.builder(
    physics: BouncingScrollPhysics(),
    scrollDirection: Axis.horizontal,
    itemCount: datas.length,
    itemBuilder: (BuildContext context, int index) {
      return Row(
        children: <Widget>[
          SizedBox(
              width: (index == 0)
                  ? 30
                  : (index < datas.length - 1)
                      ? 10
                      : 10),
          MainCard(
            imagePath: datas[index]['imagePath'],
            venueName: datas[index]['venueName'],
            venueLocation: datas[index]['venueLocation'],
            description: datas[index]['description'],
            locationID: datas[index].id,
          ),
          SizedBox(
              width: (index == 0)
                  ? 0
                  : (index < datas.length - 1)
                      ? 0
                      : 30),
        ],
      );
    },
  );
}

Widget explorePeopleList(datas, followerDict) {
  return ListView.builder(
    physics: BouncingScrollPhysics(),
    itemCount: datas.length,
    itemBuilder: (BuildContext context, int index) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(30, 0, 30, 20),
        child: UserCard(
          uid: datas[index].id,
          displayName: datas[index]['displayName'],
          photoURL: datas[index]['photoURL'],
          follower: followerDict[datas[index].id] == null
              ? 0
              : followerDict[datas[index].id],
        ),
      );
    },
  );
}

//Info to be displayed on Explore Page when no Search result found.
Widget noSearch() {
  return Center(
    child: Text('No Data'),
  );
}
