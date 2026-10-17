import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/models.dart';

typedef StoryFetcher = Future<Paged<Story>> Function(String? cursor);

/// Cursor-paged list of stories for a list screen.
///
/// Every request carries a generation number; [refresh] bumps it, so a page
/// that arrives for an older request is dropped instead of being appended to
/// the fresh list.
class StoryPager extends ChangeNotifier {
  StoryPager(this._fetch);

  final StoryFetcher _fetch;

  List<Story> _items = const [];
  String? _nextCursor;
  bool _loading = false;
  ApiException? _error;
  int _generation = 0;
  bool _disposed = false;

  List<Story> get items => _items;
  bool get loading => _loading;
  bool get hasMore => _nextCursor != null;
  ApiException? get error => _error;

  /// Reloads from the first page. Replaces the items only on success.
  Future<void> refresh() => _load(cursor: null, append: false);

  /// Appends the next page. Does nothing when there is none or a request is
  /// already running.
  Future<void> loadMore() async {
    if (_loading || _nextCursor == null) return;
    await _load(cursor: _nextCursor, append: true);
  }

  Future<void> _load({required String? cursor, required bool append}) async {
    final generation = ++_generation;
    _loading = true;
    _notify();
    try {
      final result = await _fetch(cursor);
      if (generation != _generation) return;
      _items = append ? [..._items, ...result.items] : result.items;
      _nextCursor = result.nextCursor;
      _error = null;
    } on ApiException catch (e) {
      if (generation != _generation) return;
      _error = e;
    } catch (_) {
      if (generation != _generation) return;
      _error = const ApiException(0, 'unknown', '');
    }
    _loading = false;
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
