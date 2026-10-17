import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../pages/details_page.dart';
import './push_registration.dart';
import './services.dart';

const _channelId = 'new_story';

final FlutterLocalNotificationsPlugin _localNotifications =
    FlutterLocalNotificationsPlugin();

/// Sets up push: permission, the Android channel and the tap handlers.
///
/// Push is best effort, so nothing here may stop the app from starting.
Future<void> initPush(PushRegistration reg) async {
  final messaging = FirebaseMessaging.instance;

  try {
    await _initLocalNotifications();
    // Also covers the Android 13+ POST_NOTIFICATIONS permission.
    await messaging.requestPermission();
    // iOS shows foreground pushes itself; Android needs the local copy below.
    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
  } catch (e) {
    debugPrint('push: setup failed: $e');
  }

  // firebase_messaging 17 deprecates this in favour of onRegistered, which
  // yields a Firebase Installation ID, not the FCM token the backend sends to.
  // ignore: deprecated_member_use
  messaging.onTokenRefresh.listen(
    (token) => reg.onTokenRefresh(token),
    onError: (Object e) => debugPrint('push: token refresh failed: $e'),
  );
  FirebaseMessaging.onMessage.listen(_showForeground);
  FirebaseMessaging.onMessageOpenedApp.listen(_openFromMessage);

  try {
    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      // The navigator only exists once the first frame is built.
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _openFromMessage(initial),
      );
    }
  } catch (e) {
    debugPrint('push: initial message failed: $e');
  }
}

Future<void> _initLocalNotifications() async {
  await _localNotifications.initialize(
    settings: const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    ),
    onDidReceiveNotificationResponse: (response) {
      final id = response.payload;
      if (id != null && id.isNotEmpty) _openLocation(id);
    },
  );
  await _localNotifications
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >()
      ?.createNotificationChannel(
        const AndroidNotificationChannel(
          _channelId,
          'New stories',
          importance: Importance.high,
        ),
      );
}

Future<void> _showForeground(RemoteMessage message) async {
  if (!Platform.isAndroid) return;
  final notification = message.notification;
  if (notification == null) return;
  try {
    await _localNotifications.show(
      id: message.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          'New stories',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      payload: message.data['locationId']?.toString(),
    );
  } catch (e) {
    debugPrint('push: show failed: $e');
  }
}

void _openFromMessage(RemoteMessage message) {
  final id = message.data['locationId']?.toString();
  if (id != null && id.isNotEmpty) _openLocation(id);
}

Future<void> _openLocation(String id) async {
  try {
    final location = await api.getLocation(id);
    navigatorKey.currentState?.push(
      MaterialPageRoute<void>(
        builder: (_) => DetailsPage(location: location),
      ),
    );
  } catch (e) {
    debugPrint('push: open location $id failed: $e');
  }
}
