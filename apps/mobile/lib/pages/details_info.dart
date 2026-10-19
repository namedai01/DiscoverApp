import 'package:flutter/material.dart';

import '../components/list_card.dart';
import '../logic/story_pager.dart';
import '../pages/story_page.dart';
import '../services/services.dart';

//This Page shows Stories of a specific Location from the API.
class DetailsInfo extends StatefulWidget {
  final String description;
  final String locationID;

  const DetailsInfo({
    super.key,
    required this.description,
    required this.locationID,
  });

  @override
  State<DetailsInfo> createState() => _DetailsInfoState();
}

class _DetailsInfoState extends State<DetailsInfo> {
  late final StoryPager _pager;

  @override
  void initState() {
    super.initState();
    _pager = StoryPager((cursor) {
      return api.locationStories(widget.locationID, cursor: cursor);
    });
    _pager.refresh();
  }

  @override
  void dispose() {
    _pager.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        SizedBox(height: 100),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 35),
          height: MediaQuery.of(context).size.height - 100,
          constraints: BoxConstraints(minHeight: 160),
          child: ListenableBuilder(
            listenable: _pager,
            builder: (BuildContext context, Widget? _) {
              final stories = _pager.items;
              return RefreshIndicator(
                onRefresh: _pager.refresh,
                child: ListView(
                  physics: AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics(),
                  ),
                  padding: EdgeInsets.all(0),
                  children: <Widget>[
                    Text(
                      //Description of the venue, fetched from json.
                      widget.description,
                      textAlign: TextAlign.left,
                      maxLines: 7,
                      style: TextStyle(
                        fontSize: 17,
                        height: 1.2,
                        fontStyle: FontStyle.normal,
                      ),
                    ),
                    SizedBox(height: 40),
                    Text(
                      //Title of Stories.
                      'LOCAL STORIES',
                      textAlign: TextAlign.left,
                      style: TextStyle(
                        color: Color(0xff7c7c7c),
                        fontFamily: 'OpenSans',
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 30),
                    for (final story in stories) ...[
                      InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (BuildContext context) =>
                                  StoryPage(story: story),
                            ),
                          );
                        },
                        child: ListCard(story: story),
                      ),
                      SizedBox(height: 20),
                      Container(color: Color(0xffeeeeee), height: 1),
                      SizedBox(height: 20),
                    ],
                    _footer(stories.isEmpty),
                    SizedBox(height: 20),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _footer(bool empty) {
    final error = _pager.error;
    if (_pager.loading && empty) {
      return Center(child: CircularProgressIndicator());
    }
    if (error != null) {
      return Column(
        children: <Widget>[
          Text(error.userMessage, textAlign: TextAlign.center),
          TextButton(
            onPressed: _pager.hasMore ? _pager.loadMore : _pager.refresh,
            child: Text('Retry'),
          ),
        ],
      );
    }
    if (empty) return Center(child: Text('No stories'));
    if (_pager.hasMore) {
      return Center(
        child: _pager.loading
            ? CircularProgressIndicator()
            : TextButton(onPressed: _pager.loadMore, child: Text('Load more')),
      );
    }
    return SizedBox.shrink();
  }
}
