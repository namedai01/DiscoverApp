import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import '../logic/bloc.dart';
import '../components/search_bar.dart';
import '../components/explore_list.dart';
import '../logic/search_results.dart';
import '../components/page_heading.dart';

class ExplorePage extends StatefulWidget {
  @override
  State<StatefulWidget> createState() {
    return _ExplorePageState();
  }
}

class _ExplorePageState extends State<ExplorePage> {
  final FirebaseFirestore locationsFSI = FirebaseFirestore.instance;

  @override
  void initState() {
    bloc.cleanSearchVal();
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      //This StreamBuilder is to fetch Search Querries.
      initialData: '',
      stream: bloc.recieveSearchVal,
      builder: (BuildContext context, AsyncSnapshot searchSnapshot) {
        String searchVal = searchSnapshot.data;
        return ListView(
          //Contains the whole Page. Its a ListView but given height to
          //fix it on the Screen.
          physics: NeverScrollableScrollPhysics(),
          padding: EdgeInsets.only(
              top: 0), //Remove default padding provided by ListView.
          children: <Widget>[
            pageHeader('Discover', 30),
            SizedBox(height: 20),
            Container(
              child: SearchBar(),
              padding: EdgeInsets.symmetric(horizontal: 30),
            ),
            SizedBox(height: 20),
            Container(
              constraints: BoxConstraints(minHeight: 200),
              height: MediaQuery.of(context).size.height - 310,
              child: StreamBuilder<QuerySnapshot>(
                stream: locationsFSI
                    .collection('locations')
                    .orderBy('venueName')
                    .snapshots(),
                builder: (BuildContext context, AsyncSnapshot snapshot) {
                  if (!snapshot.hasData) {
                    return Center(child: CircularProgressIndicator());
                  } else if (searchVal != null && searchVal != '') {
                    return searchedExploreList(snapshot.data.docs, searchVal);
                  } else {
                    return exploreList(snapshot.data.docs);
                  }
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
