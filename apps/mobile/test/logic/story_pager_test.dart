import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:memopin/api/api_client.dart';
import 'package:memopin/api/models.dart';
import 'package:memopin/logic/story_pager.dart';

Story story(String id) => Story(
  id: id,
  title: 't$id',
  type: 'Food',
  description: '',
  imageUrl: '',
  createdAt: DateTime.utc(2026, 1, 1),
  locationId: 'l1',
  venueName: 'Hồ Gươm',
  ownerId: 'u1',
  ownerDisplayName: 'An',
  ownerPhotoUrl: '',
);

Paged<Story> page(List<String> ids, String? next) =>
    Paged(items: ids.map(story).toList(), nextCursor: next);

List<String> ids(StoryPager p) => p.items.map((s) => s.id).toList();

void main() {
  test('refresh loads first page with null cursor', () async {
    final cursors = <String?>[];
    final pager = StoryPager((c) async {
      cursors.add(c);
      return page(['a', 'b'], 'c1');
    });
    await pager.refresh();
    expect(cursors, [null]);
    expect(ids(pager), ['a', 'b']);
    expect(pager.hasMore, isTrue);
    expect(pager.loading, isFalse);
    expect(pager.error, isNull);
  });

  test('loadMore appends using nextCursor', () async {
    final cursors = <String?>[];
    final pager = StoryPager((c) async {
      cursors.add(c);
      return c == null ? page(['a'], 'c1') : page(['b'], null);
    });
    await pager.refresh();
    await pager.loadMore();
    expect(cursors, [null, 'c1']);
    expect(ids(pager), ['a', 'b']);
    expect(pager.hasMore, isFalse);
  });

  test('loadMore does nothing when hasMore is false', () async {
    var calls = 0;
    final pager = StoryPager((c) async {
      calls++;
      return page(['a'], null);
    });
    await pager.refresh();
    await pager.loadMore();
    expect(calls, 1);
    expect(ids(pager), ['a']);
  });

  test('concurrent loadMore fetches once', () async {
    var calls = 0;
    final gate = Completer<Paged<Story>>();
    final pager = StoryPager((c) {
      calls++;
      return c == null ? Future.value(page(['a'], 'c1')) : gate.future;
    });
    await pager.refresh();
    final first = pager.loadMore();
    final second = pager.loadMore();
    expect(pager.loading, isTrue);
    gate.complete(page(['b'], null));
    await Future.wait([first, second]);
    expect(calls, 2);
    expect(ids(pager), ['a', 'b']);
  });

  test('error is stored and items kept', () async {
    var fail = false;
    final pager = StoryPager((c) async {
      if (fail) throw const ApiException(0, 'network', 'x');
      return page(['a'], 'c1');
    });
    await pager.refresh();
    fail = true;
    await pager.loadMore();
    expect(pager.error?.code, 'network');
    expect(ids(pager), ['a']);
    expect(pager.loading, isFalse);
    await pager.refresh();
    expect(pager.error?.code, 'network');
    expect(ids(pager), ['a']);
    fail = false;
    await pager.refresh();
    expect(pager.error, isNull);
  });

  test('refresh during an in-flight loadMore discards the stale page', () async {
    final gate = Completer<Paged<Story>>();
    final pager = StoryPager((c) {
      if (c == null) return Future.value(page(['a', 'b'], 'c1'));
      return gate.future;
    });
    await pager.refresh();
    final more = pager.loadMore();
    await pager.refresh();
    gate.complete(page(['c', 'd'], null));
    await more;
    expect(ids(pager), ['a', 'b']);
    expect(pager.hasMore, isTrue);
    expect(pager.loading, isFalse);
  });

  test('disposing while a request is in flight does not throw', () async {
    final gate = Completer<Paged<Story>>();
    final pager = StoryPager((c) => gate.future);
    final f = pager.refresh();
    pager.dispose();
    gate.complete(page(['a'], null));
    await f;
  });
}
