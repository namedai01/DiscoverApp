import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:exploreapp/components/explore_list.dart';
import 'package:exploreapp/components/page_heading.dart';
import 'package:exploreapp/components/search_bar.dart';
import 'package:exploreapp/logic/bloc.dart';
import 'package:exploreapp/logic/search_results.dart';
import 'package:flutter/material.dart';

import '../const.dart';

class PeoplePage extends StatefulWidget {
  const PeoplePage({Key key}) : super(key: key);

  @override
  _PeoplePageState createState() => _PeoplePageState();
}

class _PeoplePageState extends State<PeoplePage> {
  final FirebaseFirestore firestore = FirebaseFirestore.instance;

  @override
  void initState() {
    bloc.cleanSearchVal();
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
        stream: bloc.recieveSearchVal,
        builder: (BuildContext context, AsyncSnapshot snapshot) {
          String searchVal = snapshot.data;
          return ListView(
            physics: NeverScrollableScrollPhysics(),
            padding: EdgeInsets.only(top: 0),
            children: [
              pageHeader('People', 30),
              SizedBox(height: 20),
              Container(
                //SearchBar
                child: SearchBar(),
                padding: EdgeInsets.symmetric(horizontal: 30),
              ),
              SizedBox(height: 20),
              Container(
                constraints: BoxConstraints(minHeight: 200),
                height: MediaQuery.of(context).size.height - 310,
                child: StreamBuilder<QuerySnapshot>(
                  stream: firestore.collection(userCollectionPath).snapshots(),
                  builder: (BuildContext context, AsyncSnapshot snapshot) {
                    if (!snapshot.hasData) {
                      return Center(
                        child: Text('No data'),
                      );
                    }
                    List<dynamic> userData = snapshot.data.docs;
                    return StreamBuilder(
                        stream: firestore
                            .collection(followCollectionPath)
                            .snapshots(),
                        builder:
                            (BuildContext context, AsyncSnapshot snapshot) {
                          if (!snapshot.hasData) {
                            return Center(child: CircularProgressIndicator());
                          }
                          List<dynamic> likeData = snapshot.data.docs;
                          Map followerDict = {};
                          for (dynamic like in likeData) {
                            if (followerDict[like['target']] == null) {
                              followerDict[like['target']] = 1;
                            } else {
                              followerDict[like['target']]++;
                            }
                          }
                          userData.sort((a, b) {
                            int followerOfA = followerDict[a.id] == null
                                ? 0
                                : followerDict[a.id];
                            int followerOfB = followerDict[b.id] == null
                                ? 0
                                : followerDict[b.id];
                            return followerOfB - followerOfA;
                          });
                          if (searchVal != null && searchVal != '') {
                            return searchedPeopleExploreList(
                                userData, searchVal, followerDict);
                          } else {
                            return explorePeopleList(userData, followerDict);
                          }
                        });
                  },
                ),
              )
            ],
          );
        });
  }
}
