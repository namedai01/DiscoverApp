import 'package:flutter/foundation.dart';

import '../api/memopin_api.dart';
import '../api/models.dart';

/// Keeps the backend's device registry in step with the signed-in user.
///
/// Push is best effort: no failure here (no APNs, permission denied, offline,
/// a hanging backend) may block sign-in or sign-out.
class PushRegistration {
  PushRegistration({
    required this._api,
    required this._fcmToken,
    required this._platform,
    this.signOutTimeout = const Duration(seconds: 5),
  });

  final MemopinApi _api;
  final Future<String?> Function() _fcmToken;
  final String _platform;

  /// Upper bound for the device DELETE on sign-out.
  final Duration signOutTimeout;

  bool _signedIn = false;
  String? _lastToken;

  /// Loads the profile (errors propagate), then registers this device.
  Future<AppUser> onSignedIn() async {
    final user = await _api.getMe();
    _signedIn = true;
    try {
      final token = await _fcmToken();
      if (token != null) await _register(token);
    } catch (e) {
      debugPrint('push: token lookup failed: $e');
    }
    return user;
  }

  /// Registers a rotated FCM token; ignored while signed out.
  Future<void> onTokenRefresh(String token) async {
    if (!_signedIn) return;
    await _register(token);
  }

  /// Unregisters this device so the next user of the phone gets no pushes.
  /// Never throws and never takes longer than [signOutTimeout].
  Future<void> beforeSignOut() async {
    final token = _lastToken;
    _signedIn = false;
    _lastToken = null;
    if (token == null) return;
    try {
      await _api.unregisterDevice(token).timeout(signOutTimeout);
    } catch (e) {
      debugPrint('push: unregister failed: $e');
    }
  }

  Future<void> _register(String token) async {
    // Remember it even if the POST fails: the server may have stored it and
    // only the response was lost, so sign-out should still try to delete it.
    _lastToken = token;
    try {
      await _api.registerDevice(token, _platform);
    } catch (e) {
      debugPrint('push: register failed: $e');
    }
  }
}
