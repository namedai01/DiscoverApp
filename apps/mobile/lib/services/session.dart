import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import './push_registration.dart';
import './services.dart';

/// Registers this device with the backend whenever a user is signed in: on
/// first login and on every app start (both backend calls are idempotent).
void startSession(PushRegistration reg) {
  FirebaseAuth.instance.authStateChanges().listen((user) async {
    if (user == null) return;
    try {
      await reg.onSignedIn();
    } catch (e) {
      debugPrint('session: sign-in sync failed: $e');
    }
  });
}

/// Unregisters the device (bounded, never throws), then signs out.
Future<void> signOut() async {
  await pushRegistration.beforeSignOut();
  await FirebaseAuth.instance.signOut();
}
