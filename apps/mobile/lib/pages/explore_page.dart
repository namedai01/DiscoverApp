import 'package:flutter/material.dart';
import 'package:rxdart/rxdart.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../components/explore_list.dart';
import '../components/page_heading.dart';
import '../components/search_bar.dart';
import '../logic/bloc.dart';
import '../services/services.dart';

class ExplorePage extends StatefulWidget {
  const ExplorePage({super.key});

  @override
  State<StatefulWidget> createState() {
    return _ExplorePageState();
  }
}

class _ExplorePageState extends State<ExplorePage> {
  late final Stream<String> _search;

  // The request for the current search value; replaced only when the value
  // changes or the user taps Retry, so rebuilds do not refetch.
  String _query = '';
  late Future<List<Location>> _locations;

  @override
  void initState() {
    bloc.cleanSearchVal();
    _search = bloc.recieveSearchVal
        .debounceTime(const Duration(milliseconds: 300))
        .distinct();
    _locations = _fetch(_query);
    super.initState();
  }

  Future<List<Location>> _fetch(String query) =>
      api.allLocations(q: query.isEmpty ? null : query);

  Future<List<Location>> _locationsFor(String query) {
    if (query != _query) {
      _query = query;
      _locations = _fetch(query);
    }
    return _locations;
  }

  Widget _results(AsyncSnapshot<List<Location>> snapshot) {
    final error = snapshot.error;
    if (error != null) {
      final message = error is ApiException
          ? error.userMessage
          : 'Something went wrong.';
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(message, textAlign: TextAlign.center),
            TextButton(
              onPressed: () => setState(() => _locations = _fetch(_query)),
              child: Text('Retry'),
            ),
          ],
        ),
      );
    }
    if (snapshot.connectionState != ConnectionState.done) {
      return Center(child: CircularProgressIndicator());
    }
    final locations = snapshot.data ?? const <Location>[];
    return locations.isEmpty ? noSearch() : exploreList(locations);
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<String>(
      //This StreamBuilder is to fetch Search Querries.
      initialData: '',
      stream: _search,
      builder: (BuildContext context, AsyncSnapshot<String> searchSnapshot) {
        final searchVal = searchSnapshot.data ?? '';
        return ListView(
          //Contains the whole Page. Its a ListView but given height to
          //fix it on the Screen.
          physics: NeverScrollableScrollPhysics(),
          padding: EdgeInsets.only(
            top: 0,
          ), //Remove default padding provided by ListView.
          children: <Widget>[
            pageHeader('Discover', 30),
            SizedBox(height: 20),
            Container(
              child: const AppSearchBar(),
              padding: EdgeInsets.symmetric(horizontal: 30),
            ),
            SizedBox(height: 20),
            Container(
              constraints: BoxConstraints(minHeight: 200),
              height: MediaQuery.of(context).size.height - 310,
              child: FutureBuilder<List<Location>>(
                future: _locationsFor(searchVal),
                builder: (BuildContext context, snapshot) => _results(snapshot),
              ),
            ),
          ],
        );
      },
    );
  }
}
