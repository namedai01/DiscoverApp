import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

/// Returns a Firebase ID token, or `null` when nobody is signed in.
/// [forceRefresh] asks for a freshly minted token instead of the cached one.
typedef IdTokenProvider = Future<String?> Function({bool forceRefresh});

/// A failed API call. `status == 0` means no HTTP response was received.
///
/// Codes come from the backend (`bad_request`, `unauthorized`, `forbidden`,
/// `not_found`, `conflict`, `unprocessable`, `internal`) or are added by the
/// client: `network` (socket error, timeout, token lookup failure or an unusable URL), `bad_response` (2xx with an
/// unparseable body) and `http_error` (non-2xx without a JSON error body).
class ApiException implements Exception {
  const ApiException(this.status, this.code, this.message);

  final int status;
  final String code;
  final String message;

  bool get isNetwork => code == 'network';

  /// Text that is safe to show to the user.
  String get userMessage {
    if (isNetwork) return 'No connection. Check your internet and try again.';
    if (status == 401) return 'Please sign in again.';
    if (status >= 500 || message.isEmpty) {
      return 'Something went wrong. Please try again.';
    }
    return message;
  }

  @override
  String toString() => 'ApiException($status, $code, $message)';
}

/// Thin JSON-over-HTTP client for the Memopin API.
class ApiClient {
  ApiClient({
    required String baseUrl,
    required this._idToken,
    http.Client? client,
    this._timeout = const Duration(seconds: 20),
  }) : _baseUrl = baseUrl.endsWith('/')
           ? baseUrl.substring(0, baseUrl.length - 1)
           : baseUrl,
       _client = client ?? http.Client();

  final String _baseUrl;
  final IdTokenProvider _idToken;
  final http.Client _client;
  final Duration _timeout;

  /// Sends a request and returns the decoded JSON body, or `null` for a 204 or
  /// an empty body. Throws [ApiException] on every failure.
  ///
  /// With [auth], sends `Authorization: Bearer <ID token>`. A 401 triggers one
  /// retry with a force-refreshed token; a second 401 is thrown as is.
  Future<Object?> send(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
    bool auth = false,
  }) async {
    if (!auth) return _once(method, path, query, body, null);

    final token = await _token(forceRefresh: false);
    if (token == null) throw _signedOut;
    try {
      return await _once(method, path, query, body, token);
    } on ApiException catch (e) {
      if (e.status != 401) rethrow;
    }
    final fresh = await _token(forceRefresh: true);
    if (fresh == null) throw _signedOut;
    return _once(method, path, query, body, fresh);
  }

  /// Asks the provider for a token. A provider that throws (Firebase offline
  /// with an expired cached token, a disabled user) is reported as `network`
  /// so callers only ever see [ApiException].
  Future<String?> _token({required bool forceRefresh}) async {
    try {
      return await _idToken(forceRefresh: forceRefresh);
    } catch (e) {
      throw ApiException(0, 'network', 'Could not get a sign-in token: $e');
    }
  }

  static const _signedOut = ApiException(
    401,
    'unauthorized',
    'You are signed out.',
  );

  Future<Object?> _once(
    String method,
    String path,
    Map<String, String>? query,
    Object? body,
    String? token,
  ) async {
    final Uri uri;
    try {
      final parsed = Uri.parse('$_baseUrl$path');
      uri = query != null && query.isNotEmpty
          ? parsed.replace(queryParameters: query)
          : parsed;
    } on FormatException catch (e) {
      throw ApiException(0, 'network', 'Invalid request URL: ${e.message}');
    }
    final request = http.Request(method, uri)
      ..headers['accept'] = 'application/json';
    if (token != null) request.headers['authorization'] = 'Bearer $token';
    if (body != null) {
      request.headers['content-type'] = 'application/json';
      request.body = jsonEncode(body);
    }

    final http.Response response;
    try {
      response = await (() async {
        return http.Response.fromStream(await _client.send(request));
      })().timeout(_timeout);
    } on TimeoutException {
      throw const ApiException(0, 'network', 'The request timed out.');
    } on IOException catch (e) {
      throw ApiException(0, 'network', e.toString());
    } on http.ClientException catch (e) {
      throw ApiException(0, 'network', e.message);
    }

    // Decode the bytes ourselves: never depend on the response charset header.
    final text = utf8.decode(response.bodyBytes, allowMalformed: true);
    final status = response.statusCode;

    if (status >= 200 && status < 300) {
      if (status == 204 || text.trim().isEmpty) return null;
      try {
        return jsonDecode(text);
      } on FormatException {
        throw ApiException(status, 'bad_response', 'Unreadable response.');
      }
    }
    throw _errorFor(status, text);
  }

  static ApiException _errorFor(int status, String text) {
    try {
      final decoded = jsonDecode(text);
      if (decoded is Map && decoded['error'] is Map) {
        final error = decoded['error'] as Map;
        final code = error['code'];
        final message = error['message'];
        if (code is String && message is String) {
          return ApiException(status, code, message);
        }
      }
    } on FormatException {
      // Not JSON (empty body, proxy HTML page): fall through.
    }
    return ApiException(status, 'http_error', '');
  }
}
