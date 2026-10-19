import 'dart:async';

import 'package:memopin/pages/people_page.dart';
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../pages/explore_page.dart';
import '../pages/maps_page.dart';
import '../pages/my_profile_page.dart';
import '../components/custom_app_bar.dart';
import '../components/dialog.dart';
import 'create_story_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  var connectivityStatus = 'Unknown';

  Connectivity connectivity = Connectivity();
  late StreamSubscription<List<ConnectivityResult>> connectivitySubs;

  @override
  void initState() {
    super.initState();
    connectivitySubs = connectivity.onConnectivityChanged.listen((
      List<ConnectivityResult> result,
    ) {
      connectivityStatus = result.toString();
      if (result.contains(ConnectivityResult.none) && mounted) {
        noInternetDialog(context);
      }
    });
  }

  @override
  void dispose() {
    connectivitySubs.cancel();
    super.dispose();
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
          unselectedLabelColor: Theme.of(context).colorScheme.secondary,
          indicatorColor: Colors.transparent,
          labelPadding: EdgeInsets.all(20),
          tabs: <Widget>[
            Tab(icon: Icon(Icons.explore_outlined, size: 30)),
            Tab(icon: Icon(Icons.people, size: 30)),
            Tab(icon: Icon(Icons.map, size: 30)),
            Tab(icon: Icon(Icons.post_add, size: 30)),
            Tab(icon: Icon(Icons.person_outline, size: 30)),
          ],
        ),
      ),
    );
  }
}
