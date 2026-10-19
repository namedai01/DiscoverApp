import 'api_client.dart';
import 'models.dart';

/// Typed wrapper over the Memopin REST API. Every method throws
/// [ApiException] on failure, including a response that does not match the
/// expected shape (`bad_response`).
class MemopinApi {
  MemopinApi(this._client);

  final ApiClient _client;

  static const _maxPageSize = 100;
  static const _maxPages = 50;

  // --- me ---

  /// Creates the user row on the first call after sign-in.
  Future<AppUser> getMe() async {
    final body = await _client.send('GET', '/v1/me', auth: true);
    return _parse(() => AppUser.fromJson(_object(body)));
  }

  Future<AppUser> updateMe({String? displayName, String? photoUrl}) async {
    final body = await _client.send(
      'PATCH',
      '/v1/me',
      body: {'displayName': ?displayName, 'photoUrl': ?photoUrl},
      auth: true,
    );
    return _parse(() => AppUser.fromJson(_object(body)));
  }

  /// [platform] is `android` or `ios`.
  Future<void> registerDevice(String token, String platform) async {
    await _client.send(
      'POST',
      '/v1/me/devices',
      body: {'token': token, 'platform': platform},
      auth: true,
    );
  }

  Future<void> unregisterDevice(String token) async {
    await _client.send(
      'DELETE',
      '/v1/me/devices/${Uri.encodeComponent(token)}',
      auth: true,
    );
  }

  // --- locations ---

  Future<List<Location>> listLocations({
    String? q,
    int limit = _maxPageSize,
    int offset = 0,
  }) async {
    final body = await _client.send(
      'GET',
      '/v1/locations',
      query: {'q': ?q, 'limit': '$limit', 'offset': '$offset'},
    );
    return _parse(() => _items(body, Location.fromJson));
  }

  /// Every location matching [q], fetched page by page (at most 50 pages).
  Future<List<Location>> allLocations({String? q}) async {
    final all = <Location>[];
    for (var page = 0; page < _maxPages; page++) {
      final items = await listLocations(q: q, offset: all.length);
      all.addAll(items);
      if (items.length < _maxPageSize) break;
    }
    return all;
  }

  Future<Location> getLocation(String id) async {
    final body = await _client.send(
      'GET',
      '/v1/locations/${Uri.encodeComponent(id)}',
    );
    return _parse(() => Location.fromJson(_object(body)));
  }

  Future<Paged<Story>> locationStories(
    String locationId, {
    String? cursor,
    int limit = 20,
  }) async {
    final body = await _client.send(
      'GET',
      '/v1/locations/${Uri.encodeComponent(locationId)}/stories',
      query: {'cursor': ?cursor, 'limit': '$limit'},
    );
    return _parse(() => _paged(body, Story.fromJson));
  }

  // --- users ---

  /// Most followed first.
  Future<List<AppUser>> listUsers({
    String? q,
    int limit = _maxPageSize,
    int offset = 0,
  }) async {
    final body = await _client.send(
      'GET',
      '/v1/users',
      query: {'q': ?q, 'limit': '$limit', 'offset': '$offset'},
    );
    return _parse(() => _items(body, AppUser.fromJson));
  }

  /// Includes [AppUser.isFollowing].
  Future<AppUser> getUser(String id) async {
    final body = await _client.send(
      'GET',
      '/v1/users/${Uri.encodeComponent(id)}',
      auth: true,
    );
    return _parse(() => AppUser.fromJson(_object(body)));
  }

  /// 403 `forbidden` unless the caller is [uid] or follows them.
  Future<Paged<Story>> userStories(
    String uid, {
    String? cursor,
    int limit = 20,
  }) async {
    final body = await _client.send(
      'GET',
      '/v1/users/${Uri.encodeComponent(uid)}/stories',
      query: {'cursor': ?cursor, 'limit': '$limit'},
      auth: true,
    );
    return _parse(() => _paged(body, Story.fromJson));
  }

  /// Idempotent. Following yourself is 400, an unknown user 404.
  Future<void> follow(String uid) async {
    await _client.send(
      'PUT',
      '/v1/users/${Uri.encodeComponent(uid)}/follow',
      auth: true,
    );
  }

  Future<void> unfollow(String uid) async {
    await _client.send(
      'DELETE',
      '/v1/users/${Uri.encodeComponent(uid)}/follow',
      auth: true,
    );
  }

  // --- stories ---

  /// 422 `unprocessable` when no places exist.
  Future<Story> createStory({
    required String title,
    required String type,
    required String description,
    required String imageUrl,
    required double lat,
    required double lng,
  }) async {
    final body = await _client.send(
      'POST',
      '/v1/stories',
      body: {
        'title': title,
        'type': type,
        'description': description,
        'imageUrl': imageUrl,
        'lat': lat,
        'lng': lng,
      },
      auth: true,
    );
    return _parse(() => Story.fromJson(_object(body)));
  }

  // --- parsing helpers ---

  static T _parse<T>(T Function() parse) {
    try {
      return parse();
    } on TypeError catch (e) {
      throw ApiException(200, 'bad_response', 'Unexpected response: $e');
    } on FormatException catch (e) {
      throw ApiException(200, 'bad_response', 'Unexpected response: $e');
    }
  }

  static Map<String, dynamic> _object(Object? body) =>
      body as Map<String, dynamic>;

  static List<T> _items<T>(
    Object? body,
    T Function(Map<String, dynamic>) fromJson,
  ) => [
    for (final item in _object(body)['items'] as List<dynamic>)
      fromJson(item as Map<String, dynamic>),
  ];

  static Paged<T> _paged<T>(
    Object? body,
    T Function(Map<String, dynamic>) fromJson,
  ) => Paged(
    items: _items(body, fromJson),
    nextCursor: _object(body)['nextCursor'] as String?,
  );
}
