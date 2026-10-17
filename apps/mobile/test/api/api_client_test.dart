import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:memopin/api/api_client.dart';

/// Token provider that records every `forceRefresh` it was called with.
class FakeTokens {
  FakeTokens(this.tokens);

  /// Tokens handed out in order; the last one repeats. `null` = signed out.
  final List<String?> tokens;
  final List<bool> calls = [];

  Future<String?> call({bool forceRefresh = false}) async {
    calls.add(forceRefresh);
    final i = calls.length - 1;
    return tokens[i < tokens.length ? i : tokens.length - 1];
  }
}

ApiClient clientFor(
  Future<http.Response> Function(http.Request) handler, {
  String baseUrl = 'http://h:8080',
  FakeTokens? tokens,
  Duration timeout = const Duration(seconds: 20),
}) {
  return ApiClient(
    baseUrl: baseUrl,
    idToken: tokens?.call ?? FakeTokens(['t1']).call,
    client: MockClient(handler),
    timeout: timeout,
  );
}

http.Response json(int status, String body) => http.Response.bytes(
  utf8.encode(body),
  status,
  headers: {'content-type': 'application/json'},
);

Future<ApiException> catchApi(Future<Object?> Function() run) async {
  try {
    await run();
  } on ApiException catch (e) {
    return e;
  }
  fail('expected ApiException');
}

void main() {
  test('joins base URL with and without trailing slash', () async {
    final urls = <String>[];
    final queries = <Map<String, String>>[];
    for (final base in ['http://h:8080', 'http://h:8080/']) {
      final api = clientFor(baseUrl: base, (req) async {
        urls.add(req.url.toString());
        queries.add(req.url.queryParameters);
        return json(200, '{}');
      });
      await api.send('GET', '/v1/locations');
    }
    expect(urls, ['http://h:8080/v1/locations', 'http://h:8080/v1/locations']);

    late http.Request seen;
    final api = clientFor((req) async {
      seen = req;
      return json(200, '{}');
    });
    await api.send('GET', '/v1/locations', query: {'q': 'hồ %'});
    expect(seen.url.queryParameters['q'], 'hồ %');

    await api.send('GET', '/v1/locations', query: {});
    expect(seen.url.toString(), 'http://h:8080/v1/locations');
    expect(seen.url.toString().contains('?'), isFalse);
  });

  test('sends bearer token only when auth is true', () async {
    final tokens = FakeTokens(['t1']);
    final headers = <Map<String, String>>[];
    final api = clientFor(tokens: tokens, (req) async {
      headers.add(req.headers);
      return json(200, '{}');
    });

    await api.send('GET', '/v1/a');
    expect(headers.last.containsKey('authorization'), isFalse);
    expect(tokens.calls, isEmpty);

    await api.send('GET', '/v1/a', auth: true);
    expect(headers.last['authorization'], 'Bearer t1');
    expect(tokens.calls, [false]);
  });

  test('encodes JSON body', () async {
    late http.Request seen;
    final api = clientFor((req) async {
      seen = req;
      return json(200, '{}');
    });
    await api.send('POST', '/v1/a', body: {'a': 1});
    expect(seen.method, 'POST');
    expect(seen.headers['content-type'], startsWith('application/json'));
    expect(jsonDecode(seen.body), {'a': 1});
  });

  test('decodes UTF-8 JSON without a charset', () async {
    final api = clientFor(
      (req) async => http.Response.bytes(
        utf8.encode('{"venueName":"Hồ Gươm"}'),
        200,
        headers: {'content-type': 'application/json'},
      ),
    );
    final result = await api.send('GET', '/v1/locations/1');
    expect((result as Map)['venueName'], 'Hồ Gươm');
  });

  test('204 returns null', () async {
    final api = clientFor((req) async => http.Response('', 204));
    expect(await api.send('DELETE', '/v1/a', auth: true), isNull);
  });

  test('maps backend error body', () async {
    final api = clientFor(
      (req) async => json(
        403,
        '{"error":{"code":"forbidden","message":"follow this user to see their stories"}}',
      ),
    );
    final e = await catchApi(() => api.send('GET', '/v1/stories'));
    expect(e.status, 403);
    expect(e.code, 'forbidden');
    expect(e.userMessage, 'follow this user to see their stories');
    expect(e.isNetwork, isFalse);
  });

  test('non-JSON error body becomes http_error', () async {
    for (final r in [
      http.Response('<html>Bad Gateway</html>', 502),
      http.Response('', 504),
    ]) {
      final api = clientFor((req) async => r);
      final e = await catchApi(() => api.send('GET', '/v1/a'));
      expect(e.status, r.statusCode);
      expect(e.code, 'http_error');
      expect(e.userMessage, 'Something went wrong. Please try again.');
    }
  });

  test('bad 2xx body becomes bad_response', () async {
    final api = clientFor((req) async => http.Response('not json', 200));
    final e = await catchApi(() => api.send('GET', '/v1/a'));
    expect(e.code, 'bad_response');
  });

  test('network failure becomes network', () async {
    final api = clientFor((req) async => throw http.ClientException('x'));
    final e = await catchApi(() => api.send('GET', '/v1/a'));
    expect(e.status, 0);
    expect(e.code, 'network');
    expect(e.isNetwork, isTrue);
    expect(e.userMessage, 'No connection. Check your internet and try again.');
  });

  test('timeout becomes network', () async {
    final api = clientFor(timeout: const Duration(milliseconds: 20), (
      req,
    ) async {
      await Future<void>.delayed(const Duration(milliseconds: 200));
      return json(200, '{}');
    });
    final e = await catchApi(() => api.send('GET', '/v1/a'));
    expect(e.code, 'network');
    expect(e.isNetwork, isTrue);
  });

  test('retries once with a forced token refresh on 401', () async {
    final tokens = FakeTokens(['t1', 't2']);
    final auths = <String?>[];
    var n = 0;
    final api = clientFor(tokens: tokens, (req) async {
      auths.add(req.headers['authorization']);
      n++;
      return n == 1 ? json(401, '') : json(200, '{"ok":true}');
    });
    final result = await api.send('GET', '/v1/me', auth: true);
    expect((result as Map)['ok'], true);
    expect(auths, ['Bearer t1', 'Bearer t2']);
    expect(tokens.calls, [false, true]);
  });

  test('two 401s in a row throw after exactly 2 requests', () async {
    final tokens = FakeTokens(['t1', 't2']);
    var requests = 0;
    final api = clientFor(tokens: tokens, (req) async {
      requests++;
      return json(
        401,
        '{"error":{"code":"unauthorized","message":"bad token"}}',
      );
    });
    final e = await catchApi(() => api.send('GET', '/v1/me', auth: true));
    expect(e.status, 401);
    expect(e.userMessage, 'Please sign in again.');
    expect(requests, 2);
  });

  test('auth call while signed out throws without sending', () async {
    final tokens = FakeTokens([null]);
    var requests = 0;
    final api = clientFor(tokens: tokens, (req) async {
      requests++;
      return json(200, '{}');
    });
    final e = await catchApi(() => api.send('GET', '/v1/me', auth: true));
    expect(e.status, 401);
    expect(e.code, 'unauthorized');
    expect(requests, 0);
  });
}
