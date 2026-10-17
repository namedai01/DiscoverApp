import 'package:flutter/material.dart';
import 'package:memopin/components/list_card.dart';
import 'package:memopin/logic/story_pager.dart';
import 'package:memopin/pages/story_page.dart';
import 'package:memopin/services/services.dart';
import 'package:memopin/utils.dart';
import 'package:timelines_plus/timelines_plus.dart';

class UserStoriesTimeLine extends StatefulWidget {
  final String uid;

  const UserStoriesTimeLine({super.key, required this.uid});

  @override
  State<UserStoriesTimeLine> createState() => _UserStoriesTimeLineState();
}

class _UserStoriesTimeLineState extends State<UserStoriesTimeLine> {
  late StoryPager _pager;

  @override
  void initState() {
    super.initState();
    _pager = _newPager();
    _pager.refresh();
  }

  @override
  void didUpdateWidget(UserStoriesTimeLine oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.uid != widget.uid) {
      _pager.dispose();
      _pager = _newPager();
      _pager.refresh();
    }
  }

  @override
  void dispose() {
    _pager.dispose();
    super.dispose();
  }

  StoryPager _newPager() {
    final uid = widget.uid;
    return StoryPager((cursor) => api.userStories(uid, cursor: cursor));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _pager,
      builder: (BuildContext context, Widget? _) {
        final stories = _pager.items;

        if (stories.isEmpty) {
          return RefreshIndicator(
            onRefresh: _pager.refresh,
            child: ListView(
              physics: AlwaysScrollableScrollPhysics(),
              children: <Widget>[
                SizedBox(height: 40),
                Center(child: _emptyContent()),
              ],
            ),
          );
        }

        return Column(
          children: <Widget>[
            Expanded(
              child: RefreshIndicator(
                onRefresh: _pager.refresh,
                child: Timeline.tileBuilder(
                  physics: AlwaysScrollableScrollPhysics(),
                  theme: TimelineThemeData(
                    nodePosition: 0,
                    color: Color(0xff989898),
                    indicatorTheme: IndicatorThemeData(
                      position: 0,
                      size: 20.0,
                    ),
                    connectorTheme: ConnectorThemeData(thickness: 2.5),
                  ),
                  builder: TimelineTileBuilder.connected(
                    connectionDirection: ConnectionDirection.before,
                    indicatorBuilder: (context, index) {
                      return DotIndicator(color: Colors.black38);
                    },
                    lastConnectorBuilder: (context) {
                      return SolidLineConnector(color: Colors.black38);
                    },
                    connectorBuilder: (_, index, connectorType) {
                      return SolidLineConnector(
                        indent: connectorType == ConnectorType.start ? 0 : 2.0,
                        endIndent: connectorType == ConnectorType.end
                            ? 0
                            : 2.0,
                        color: Color(0xffc2c5c9),
                      );
                    },
                    contentsBuilder: (BuildContext context, int index) {
                      final story = stories[index];
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("  " + getFormattedTimeStamp(story.createdAt)),
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: InkWell(
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
                          ),
                        ],
                      );
                    },
                    itemCount: stories.length,
                  ),
                ),
              ),
            ),
            _footer(),
          ],
        );
      },
    );
  }

  Widget _emptyContent() {
    if (_pager.loading) return CircularProgressIndicator();
    final e = _pager.error;
    if (e != null) {
      if (e.code == 'forbidden') {
        return Text('Please follow me to sightsee !!!');
      }
      return Column(
        children: <Widget>[
          Text(e.userMessage, textAlign: TextAlign.center),
          TextButton(onPressed: _pager.refresh, child: Text('Retry')),
        ],
      );
    }
    return Text('No stories yet');
  }

  Widget _footer() {
    if (_pager.loading && _pager.hasMore) {
      return Padding(
        padding: const EdgeInsets.all(8.0),
        child: CircularProgressIndicator(),
      );
    }
    if (_pager.error != null) {
      return Column(
        children: <Widget>[
          Text(_pager.error!.userMessage, textAlign: TextAlign.center),
          TextButton(
            onPressed: _pager.hasMore ? _pager.loadMore : _pager.refresh,
            child: Text('Retry'),
          ),
        ],
      );
    }
    if (_pager.hasMore) {
      return TextButton(onPressed: _pager.loadMore, child: Text('Load more'));
    }
    return SizedBox.shrink();
  }
}
