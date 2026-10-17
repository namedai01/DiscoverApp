import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:memopin/services/push_registration.dart';

import '../support/fake_api.dart';

const _me = {
  'id': 'u1',
  'displayName': 'Dai',
  'photoUrl': 'https://x/y.jpg',
  'followerCount': 3,
};

void main() {
  late List<String> calls;
  late List<Object?> bodies;

  final realDebugPrint = debugPrint;
  setUpAll(() => debugPrint = (String? m, {int? wrapWidth}) {});
  tearDownAll(() => debugPrint = realDebugPrint);

  setUp(() {
    calls = [];
    bodies = [];
  });

  /// Records "METHOD path" and the decoded body; answers [onDevice] for
  /// everything except `GET /v1/me`.
  PushRegistration make({
    Future<String?> Function()? fcmToken,
    Future<http.Response> Function(http.Request req)? onDevice,
    Duration signOutTimeout = const Duration(seconds: 5),
  }) {
    final api = fakeApi((req) {
      calls.add('${req.method} ${req.url.path}');
      bodies.add(req.body.isEmpty ? null : jsonDecode(req.body));
      if (req.method == 'GET') return Future.value(jsonResponse(_me));
      return onDevice != null
          ? onDevice(req)
          : Future.value(http.Response('', 204));
    });
    return PushRegistration(
      api: api,
      fcmToken: fcmToken ?? () async => 't:1',
      platform: 'android',
      signOutTimeout: signOutTimeout,
    );
  }

  test('onSignedIn calls GET /v1/me then POST /v1/me/devices', () async {
    final reg = make();
    final user = await reg.onSignedIn();
    expect(user.id, 'u1');
    expect(user.displayName, 'Dai');
    expect(calls, ['GET /v1/me', 'POST /v1/me/devices']);
    expect(bodies[1], {'token': 't:1', 'platform': 'android'});
  });

  test('onSignedIn when fcmToken throws still returns the profile', () async {
    final reg = make(fcmToken: () async => throw StateError('no apns'));
    final user = await reg.onSignedIn();
    expect(user.id, 'u1');
    expect(calls, ['GET /v1/me']);
  });

  test('onSignedIn when fcmToken is null skips registration', () async {
    final reg = make(fcmToken: () async => null);
    await reg.onSignedIn();
    expect(calls, ['GET /v1/me']);
  });

  test('onSignedIn when device POST fails still returns the profile', () async {
    final reg = make(
      onDevice: (_) async => jsonResponse({
        'error': {'code': 'internal', 'message': 'boom'},
      }, 500),
    );
    final user = await reg.onSignedIn();
    expect(user.id, 'u1');
    expect(calls, ['GET /v1/me', 'POST /v1/me/devices']);
  });

  test('onTokenRefresh before sign-in does nothing; after sign-in posts the '
      'new token', () async {
    final reg = make();
    await reg.onTokenRefresh('t:0');
    expect(calls, isEmpty);

    await reg.onSignedIn();
    calls.clear();
    bodies.clear();
    await reg.onTokenRefresh('t:2');
    expect(calls, ['POST /v1/me/devices']);
    expect(bodies.single, {'token': 't:2', 'platform': 'android'});
  });

  test('onTokenRefresh after beforeSignOut does nothing', () async {
    final reg = make();
    await reg.onSignedIn();
    await reg.beforeSignOut();
    calls.clear();
    await reg.onTokenRefresh('t:3');
    expect(calls, isEmpty);
  });

  test('beforeSignOut deletes the registered token', () async {
    final reg = make();
    await reg.onSignedIn();
    calls.clear();
    await reg.beforeSignOut();
    expect(calls, ['DELETE /v1/me/devices/t%3A1']);

    calls.clear();
    await reg.beforeSignOut();
    expect(calls, isEmpty);
  });

  test('beforeSignOut deletes the latest refreshed token', () async {
    final reg = make();
    await reg.onSignedIn();
    await reg.onTokenRefresh('t:2');
    calls.clear();
    await reg.beforeSignOut();
    expect(calls, ['DELETE /v1/me/devices/t%3A2']);
  });

  test('beforeSignOut completes when DELETE fails', () async {
    final reg = make(
      onDevice: (req) async => req.method == 'DELETE'
          ? throw http.ClientException('offline')
          : http.Response('', 204),
    );
    await reg.onSignedIn();
    await reg.beforeSignOut();
    expect(calls.last, 'DELETE /v1/me/devices/t%3A1');
  });

  test('beforeSignOut completes when DELETE hangs', () async {
    final hang = Completer<http.Response>();
    final reg = make(
      signOutTimeout: const Duration(milliseconds: 50),
      onDevice: (req) =>
          req.method == 'DELETE' ? hang.future : Future.value(http.Response('', 204)),
    );
    await reg.onSignedIn();
    await reg.beforeSignOut().timeout(const Duration(seconds: 1));
    expect(calls.last, 'DELETE /v1/me/devices/t%3A1');
  });
}
