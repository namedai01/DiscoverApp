import 'dart:io' show Platform;

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';

import '../api/api_client.dart';
import '../api/memopin_api.dart';
import '../config.dart';
import './push_registration.dart';

/// The app's API client. Set by [initServices].
late final MemopinApi api;

/// Registers this device for push and keeps the backend's device list in step.
late final PushRegistration pushRegistration;

/// Lets push taps navigate without a [BuildContext].
final navigatorKey = GlobalKey<NavigatorState>();

/// Call once from `main()`, after `dotenv.load()` and `Firebase.initializeApp()`.
void initServices() {
  api = MemopinApi(
    ApiClient(
      baseUrl: AppConfig.apiBaseUrl,
      idToken: ({bool forceRefresh = false}) async =>
          FirebaseAuth.instance.currentUser?.getIdToken(forceRefresh),
    ),
  );
  pushRegistration = PushRegistration(
    api: api,
    // Deprecated in firebase_messaging 17 for FIDs; the backend needs the FCM token.
    // ignore: deprecated_member_use
    fcmToken: () => FirebaseMessaging.instance.getToken(),
    platform: Platform.isIOS ? 'ios' : 'android',
  );
}
