import 'dart:async';

import 'package:exploreapp/pages/people_page.dart';
import 'package:flutter/material.dart';
import 'package:connectivity/connectivity.dart';

import '../pages/explore_page.dart';
import '../pages/maps_page.dart';
import '../pages/my_profile_page.dart';
import '../components/custom_app_bar.dart';
import '../components/dialog.dart';
import 'create_story_page.dart';

class HomePage extends StatefulWidget {
  @override
  _HomePageState createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  var connectivityStatus = 'Unknown';

  Connectivity connectivity = Connectivity();
  StreamSubscription<ConnectivityResult> connectivitySubs;

  @override
  void initState() {
    super.initState();
    connectivitySubs =
        connectivity.onConnectivityChanged.listen((ConnectivityResult result) {
      connectivityStatus = result.toString();
      if (result == ConnectivityResult.none) {
        noInternetDialog(context);
      }
    });
  }

  @override
  void dispose() {
    super.dispose();
    connectivitySubs.cancel();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        appBar: PreferredSize(
          preferredSize: Size.fromHeight(75),
          child: Theme(
            data: Theme.of(context).copyWith(canvasColor: Colors.transparent),
            child: CustomAppBar(),
          ),
        ),
        body: Container(
          height: MediaQuery.of(context).size.height - 165,
          child: TabBarView(
            physics: NeverScrollableScrollPhysics(),
            children: <Widget>[
              ExplorePage(),
              PeoplePage(),
              MapsPage(),
              CreateStoryPage(),
              MyProfilePage(),
            ],
          ),
        ),
        bottomNavigationBar: TabBar(
          labelColor: Theme.of(context).primaryColor,
          unselectedLabelColor: Theme.of(context).accentColor,
          indicatorColor: Colors.yellowAccent.withOpacity(0.0),
          labelPadding: EdgeInsets.all(20),
          tabs: <Widget>[
            Tab(
              icon: Icon(Icons.explore_outlined, size: 30,),
            ),
            Tab(
              icon: Icon(Icons.people, size: 30,),
            ),
            Tab(
              icon: Icon(Icons.map, size: 30),
            ),
            Tab(
              icon: Icon(Icons.post_add, size: 30),
            ),
            Tab(
              icon: Icon(Icons.person_outline, size: 30,),
            ),
          ],
        ),
      ),
    );
  }
}
