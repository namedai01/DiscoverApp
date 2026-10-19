import 'package:flutter/material.dart';
import 'package:rxdart/rxdart.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../components/explore_list.dart';
import '../components/page_heading.dart';
import '../components/search_bar.dart';
import '../logic/bloc.dart';
import '../services/services.dart';

class PeoplePage extends StatefulWidget {
  const PeoplePage({super.key});

  @override
  State<PeoplePage> createState() => _PeoplePageState();
}

class _PeoplePageState extends State<PeoplePage> {
  late final Stream<String> _search;

  // The request for the current search value; replaced only when the value
  // changes or the user taps Retry, so rebuilds do not refetch.
  String _query = '';
  late Future<List<AppUser>> _users;

  @override
  void initState() {
    bloc.cleanSearchVal();
    _search = bloc.recieveSearchVal
        .debounceTime(const Duration(milliseconds: 300))
        .distinct();
    _users = _fetch(_query);
    super.initState();
  }

  // The server does the prefix search and sorts by follower count.
  Future<List<AppUser>> _fetch(String query) =>
      api.listUsers(q: query.isEmpty ? null : query);

  Future<List<AppUser>> _usersFor(String query) {
    if (query != _query) {
      _query = query;
      _users = _fetch(query);
    }
    return _users;
  }

  Widget _results(AsyncSnapshot<List<AppUser>> snapshot) {
    if (snapshot.connectionState != ConnectionState.done) {
      return Center(child: CircularProgressIndicator());
    }
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
              onPressed: () => setState(() => _users = _fetch(_query)),
              child: Text('Retry'),
            ),
          ],
        ),
      );
    }
    final users = snapshot.data ?? const <AppUser>[];
    return users.isEmpty ? noSearch() : explorePeopleList(users);
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<String>(
      initialData: '',
      stream: _search,
      builder: (BuildContext context, AsyncSnapshot<String> searchSnapshot) {
        final searchVal = searchSnapshot.data ?? '';
        return ListView(
          physics: NeverScrollableScrollPhysics(),
          padding: EdgeInsets.only(top: 0),
          children: <Widget>[
            pageHeader('People', 30),
            SizedBox(height: 20),
            Container(
              //SearchBar
              child: const AppSearchBar(),
              padding: EdgeInsets.symmetric(horizontal: 30),
            ),
            SizedBox(height: 20),
            Container(
              constraints: BoxConstraints(minHeight: 200),
              height: MediaQuery.of(context).size.height - 310,
              child: FutureBuilder<List<AppUser>>(
                future: _usersFor(searchVal),
                builder: (BuildContext context, snapshot) => _results(snapshot),
              ),
            ),
          ],
        );
      },
    );
  }
}
