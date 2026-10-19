import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:memopin/api/api_client.dart';

import '../support/fake_api.dart';

Map<String, Object?> loc(int i) => {
  'id': 'l$i',
  'venueName': 'V$i',
  'venueLocation': 'P',
  'description': 'D',
  'imageUrl': 'https://x/$i.jpg',
  'lat': 21.0,
  'lng': 105.0,
  'storyCount': 0,
};

Map<String, Object?> user({bool? following}) => {
  'id': 'u1',
  'displayName': 'An',
  'photoUrl': 'https://x/a.jpg',
  'followerCount': 4,
  'isFollowing': ?following,
};

Map<String, Object?> story() => {
  'id': 's1',
  'title': 'T',
  'type': 'food',
  'description': 'D',
  'imageUrl': 'https://x/s.jpg',
  'createdAt': '2026-10-17T03:04:05Z',
  'location': {'id': 'l1', 'venueName': 'V'},
  'owner': {'id': 'u1', 'displayName': 'An', 'photoUrl': 'https://x/a.jpg'},
};

void main() {
  test('listLocations sends q, limit, offset', () async {
    late http.Request seen;
    final api = fakeApi((req) async {
      seen = req;
      return jsonResponse({
        'items': [loc(1)],
      });
    });
    final items = await api.listLocations(q: 'hồ');
    expect(items.single.venueName, 'V1');
    expect(seen.method, 'GET');
    expect(seen.url.path, '/v1/locations');
    expect(seen.url.queryParameters, {
      'q': 'hồ',
      'limit': '100',
      'offset': '0',
    });
    expect(seen.headers.containsKey('authorization'), isFalse);
  });

  test('allLocations pages until a short page', () async {
    final offsets = <String>[];
    final api = fakeApi((req) async {
      final offset = req.url.queryParameters['offset']!;
      offsets.add(offset);
      final n = offset == '200' ? 3 : 100;
      return jsonResponse({
        'items': [for (var i = 0; i < n; i++) loc(i)],
      });
    });
    final all = await api.allLocations();
    expect(all, hasLength(203));
    expect(offsets, ['0', '100', '200']);
  });

  test('allLocations stops after 50 pages', () async {
    var calls = 0;
    final api = fakeApi((req) async {
      calls++;
      return jsonResponse({
        'items': [for (var i = 0; i < 100; i++) loc(i)],
      });
    });
    expect(await api.allLocations(), hasLength(5000));
    expect(calls, 50);
  });

  test('getUser uses auth and parses isFollowing', () async {
    late http.Request seen;
    final api = fakeApi((req) async {
      seen = req;
      return jsonResponse(user(following: true));
    });
    final u = await api.getUser('u 1');
    expect(u.isFollowing, isTrue);
    expect(seen.headers['authorization'], 'Bearer t1');
    expect(seen.url.path, '/v1/users/u%201');
  });

  test('updateMe sends only provided fields', () async {
    late http.Request seen;
    final api = fakeApi((req) async {
      seen = req;
      return jsonResponse(user());
    });
    await api.updateMe(displayName: 'An');
    expect(seen.method, 'PATCH');
    expect(seen.url.path, '/v1/me');
    expect(seen.body, '{"displayName":"An"}');
  });

  test('follow sends PUT and accepts 204', () async {
    late http.Request seen;
    final api = fakeApi((req) async {
      seen = req;
      return http.Response('', 204);
    });
    await api.follow('u2');
    expect(seen.method, 'PUT');
    expect(seen.url.path, '/v1/users/u2/follow');
    await api.unfollow('u2');
    expect(seen.method, 'DELETE');
  });

  test('createStory posts body and parses 201', () async {
    late http.Request seen;
    final api = fakeApi((req) async {
      seen = req;
      return jsonResponse(story(), 201);
    });
    final s = await api.createStory(
      title: 'T',
      type: 'food',
      description: 'D',
      imageUrl: 'https://x/s.jpg',
      lat: 21,
      lng: 105.5,
    );
    expect(s.id, 's1');
    expect(seen.method, 'POST');
    expect(seen.url.path, '/v1/stories');
    final body = jsonDecode(seen.body) as Map<String, dynamic>;
    expect(body.keys.toSet(), {
      'title',
      'type',
      'description',
      'imageUrl',
      'lat',
      'lng',
    });
    expect(body['lng'], 105.5);
  });

  test('createStory 422 throws ApiException unprocessable', () async {
    final api = fakeApi(
      (req) async => jsonResponse({
        'error': {'code': 'unprocessable', 'message': 'no places'},
      }, 422),
    );
    await expectLater(
      api.createStory(
        title: 'T',
        type: 'x',
        description: '',
        imageUrl: 'u',
        lat: 1,
        lng: 2,
      ),
      throwsA(
        isA<ApiException>()
            .having((e) => e.status, 'status', 422)
            .having((e) => e.code, 'code', 'unprocessable'),
      ),
    );
  });

  test('registerDevice posts token and platform', () async {
    late http.Request seen;
    final api = fakeApi((req) async {
      seen = req;
      return http.Response('', 204);
    });
    await api.registerDevice('tok', 'android');
    expect(seen.method, 'POST');
    expect(seen.url.path, '/v1/me/devices');
    expect(jsonDecode(seen.body), {'token': 'tok', 'platform': 'android'});
  });

  test('unregisterDevice percent-encodes the token', () async {
    late http.Request seen;
    final api = fakeApi((req) async {
      seen = req;
      return http.Response('', 204);
    });
    await api.unregisterDevice('abc:APA91b/x');
    expect(seen.method, 'DELETE');
    expect(seen.url.path, '/v1/me/devices/abc%3AAPA91b%2Fx');
  });

  test('userStories passes cursor and returns nextCursor', () async {
    late http.Request seen;
    final api = fakeApi((req) async {
      seen = req;
      return jsonResponse({
        'items': [story()],
        'nextCursor': 'next',
      });
    });
    final page = await api.userStories('u1', cursor: 'c1', limit: 5);
    expect(seen.url.path, '/v1/users/u1/stories');
    expect(seen.url.queryParameters, {'cursor': 'c1', 'limit': '5'});
    expect(seen.headers['authorization'], 'Bearer t1');
    expect(page.items.single.id, 's1');
    expect(page.nextCursor, 'next');
    expect(page.hasMore, isTrue);
  });

  test(
    'locationStories without cursor sends only limit; no cursor ends',
    () async {
      late http.Request seen;
      final api = fakeApi((req) async {
        seen = req;
        return jsonResponse({
          'items': [story()],
        });
      });
      final page = await api.locationStories('l1');
      expect(seen.url.path, '/v1/locations/l1/stories');
      expect(seen.url.queryParameters, {'limit': '20'});
      expect(seen.headers.containsKey('authorization'), isFalse);
      expect(page.hasMore, isFalse);
    },
  );

  test('malformed item throws bad_response', () async {
    final bad = loc(1)..remove('venueName');
    final api = fakeApi(
      (req) async => jsonResponse({
        'items': [bad],
      }),
    );
    await expectLater(
      api.listLocations(),
      throwsA(
        isA<ApiException>()
            .having((e) => e.status, 'status', 200)
            .having((e) => e.code, 'code', 'bad_response'),
      ),
    );
  });

  test('non-object body throws bad_response', () async {
    final api = fakeApi((req) async => jsonResponse([1, 2]));
    await expectLater(
      api.getMe(),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'bad_response'),
      ),
    );
  });
}
