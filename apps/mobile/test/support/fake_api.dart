import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:memopin/api/api_client.dart';
import 'package:memopin/api/memopin_api.dart';

/// A [MemopinApi] whose HTTP layer is [handler]. [token] is the ID token the
/// signed-in user holds; `null` means signed out.
MemopinApi fakeApi(
  Future<http.Response> Function(http.Request req) handler, {
  String? token = 't1',
}) {
  return MemopinApi(
    ApiClient(
      baseUrl: 'http://h:8080',
      idToken: ({bool forceRefresh = false}) async => token,
      client: MockClient(handler),
    ),
  );
}

/// A JSON response encoded as UTF-8 bytes.
http.Response jsonResponse(Object body, [int status = 200]) {
  return http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    status,
    headers: {'content-type': 'application/json'},
  );
}
