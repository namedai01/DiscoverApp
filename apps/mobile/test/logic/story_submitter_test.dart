import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:memopin/api/api_client.dart';
import 'package:memopin/logic/story_submitter.dart';

import '../support/fake_api.dart';

const _story = {
  'id': 's1',
  'title': 'Hello',
  'type': 'food',
  'description': 'd',
  'imageUrl': 'https://x/img.jpg',
  'createdAt': '2026-10-17T10:00:00Z',
  'location': {'id': 'l1', 'venueName': 'Hồ Gươm'},
  'owner': {'id': 'u1', 'displayName': 'Dai', 'photoUrl': ''},
};

void main() {
  final image = File('/tmp/none.jpg');
  late List<File> uploads;
  late List<http.Request> requests;
  late Completer<void>? gate;
  var hasPosition = true;
  var status = 201;

  StorySubmitter make() => StorySubmitter(
    api: fakeApi((req) async {
      requests.add(req);
      if (gate != null) await gate!.future;
      return status == 201
          ? jsonResponse(_story, 201)
          : jsonResponse({
              'error': {'code': 'unprocessable', 'message': 'No places yet'},
            }, status);
    }),
    upload: (file) async {
      uploads.add(file);
      if (gate != null) await gate!.future;
      return 'https://x/uploaded.jpg';
    },
    position: () async => hasPosition ? (lat: 21.0, lng: 105.8) : null,
  );

  setUp(() {
    uploads = [];
    requests = [];
    gate = null;
    hasPosition = true;
    status = 201;
  });

  test('blank title rejected before upload', () async {
    final s = make();
    await expectLater(
      s.submit(StoryDraft(image: image, title: '   ')),
      throwsA(isA<StoryValidationException>()),
    );
    expect(uploads, isEmpty);
    expect(requests, isEmpty);
    expect(s.busy, isFalse);
  });

  test('missing image rejected', () async {
    await expectLater(
      make().submit(const StoryDraft(title: 'Hello')),
      throwsA(
        isA<StoryValidationException>().having(
          (e) => e.message,
          'message',
          'Please choose a photo',
        ),
      ),
    );
    expect(requests, isEmpty);
  });

  test('over-long type rejected before upload', () async {
    await expectLater(
      make().submit(StoryDraft(image: image, title: 'a', type: 'x' * 51)),
      throwsA(isA<StoryValidationException>()),
    );
    expect(uploads, isEmpty);
  });

  test('no position rejected before upload', () async {
    hasPosition = false;
    final s = make();
    await expectLater(
      s.submit(StoryDraft(image: image, title: 'Hello')),
      throwsA(
        isA<StoryValidationException>().having(
          (e) => e.message,
          'message',
          'Location permission is required to post a story',
        ),
      ),
    );
    expect(uploads, isEmpty);
    expect(requests, isEmpty);
    expect(s.busy, isFalse);
  });

  test('happy path posts trimmed title, uploaded URL and coordinates', () async {
    final story = await make().submit(
      StoryDraft(
        image: image,
        title: '  Hello  ',
        type: 'food',
        description: 'd',
      ),
    );
    expect(story.id, 's1');
    expect(uploads, [image]);
    expect(requests, hasLength(1));
    expect(requests.single.method, 'POST');
    expect(requests.single.url.path, '/v1/stories');
    expect(jsonDecode(requests.single.body), {
      'title': 'Hello',
      'type': 'food',
      'description': 'd',
      'imageUrl': 'https://x/uploaded.jpg',
      'lat': 21.0,
      'lng': 105.8,
    });
  });

  test('concurrent submits upload and post once', () async {
    gate = Completer<void>();
    final s = make();
    final draft = StoryDraft(image: image, title: 'Hello');
    final a = s.submit(draft);
    final b = s.submit(draft);
    expect(s.busy, isTrue);
    gate!.complete();
    final results = await Future.wait([a, b]);
    expect(results[0].id, results[1].id);
    expect(uploads, hasLength(1));
    expect(requests, hasLength(1));
    expect(s.busy, isFalse);
  });

  test('api 422 propagates as ApiException unprocessable and busy resets',
      () async {
    status = 422;
    final s = make();
    await expectLater(
      s.submit(StoryDraft(image: image, title: 'Hello')),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'unprocessable'),
      ),
    );
    expect(s.busy, isFalse);
  });
}
