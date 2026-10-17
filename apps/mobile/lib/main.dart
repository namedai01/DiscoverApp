import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:memopin/const.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import './logic/bloc.dart';
import './logic/sharedPref_logic.dart';
import './logic/theme_chooser.dart';
import './pages/homepage.dart';
import './services/services.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

Future<void> main() async {
  //Following codes Customizes the StatusBar & NavigationBar.
  //Services Package were imported for these.
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");
  await Firebase.initializeApp();
  initServices();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
      systemNavigationBarDividerColor: Colors.transparent,
    ),
  );

  await initializeNotification();
  registerNotification();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  runApp(const MyApp());
}

Future<void> initializeNotification() async {
  const initializationSettings = InitializationSettings(
    android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    iOS: DarwinInitializationSettings(),
  );
  await flutterLocalNotificationsPlugin.initialize(
    settings: initializationSettings,
    onDidReceiveNotificationResponse: (NotificationResponse response) {
      if (response.payload != null) {
        debugPrint('notification payload: ${response.payload}');
      }
    },
  );

  /// Android 13+ needs the runtime POST_NOTIFICATIONS permission.
  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >()
      ?.requestNotificationsPermission();
}

/// Listener on the current user's `follow` docs.
StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _followSubscription;

/// One `stories` listener per followed user, keyed by their uid.
final Map<String, StreamSubscription<QuerySnapshot<Map<String, dynamic>>>>
_storySubscriptions = {};

void registerNotification() {
  FirebaseAuth.instance.authStateChanges().listen(
    registerNotificationForCurrentUser,
  );
}

/// Drops every listener belonging to the previous user (logout / switch).
void _cancelAllNotificationListeners() {
  _followSubscription?.cancel();
  _followSubscription = null;
  for (final sub in _storySubscriptions.values) {
    sub.cancel();
  }
  _storySubscriptions.clear();
}

void registerNotificationForCurrentUser(User? user) {
  debugPrint('register current user');
  _cancelAllNotificationListeners();
  if (user == null) return;
  _followSubscription = FirebaseFirestore.instance
      .collection(followCollectionPath)
      .where('follower', isEqualTo: user.uid)
      .snapshots()
      .listen((event) {
        final Set<String> followingUid = event.docs
            .map((e) => e['target'].toString())
            .toSet();

        /// Unfollowed users: stop listening to their stories.
        _storySubscriptions.removeWhere((uid, sub) {
          if (followingUid.contains(uid)) return false;
          sub.cancel();
          return true;
        });

        /// Newly followed users: start listening. Existing ones are kept as is.
        for (final uid in followingUid) {
          _storySubscriptions.putIfAbsent(
            uid,
            () => registerSingleUserNotification(uid),
          );
        }
      });
}

StreamSubscription<QuerySnapshot<Map<String, dynamic>>>
registerSingleUserNotification(String targetUid) {
  int numPreviousStories = -1;
  return FirebaseFirestore.instance
      .collection(storiesCollectionPath)
      .where('owner', isEqualTo: targetUid)
      .snapshots()
      .listen((event) {
        if (event.docs.length > numPreviousStories &&
            numPreviousStories != -1) {
          showNewStoryNotification(targetUid);
        }
        numPreviousStories = event.docs.length;
      });
}

Future<void> showNewStoryNotification(String uid) async {
  final userDoc = await FirebaseFirestore.instance
      .collection(userCollectionPath)
      .doc(uid)
      .get();
  final String name = userDoc.data()?['displayName'] ?? 'Someone';
  const platformChannelSpecifics = NotificationDetails(
    android: AndroidNotificationDetails(
      '1',
      'Memopin',
      channelDescription: 'Memopin',
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'ticker',
    ),
    iOS: DarwinNotificationDetails(),
  );
  await flutterLocalNotificationsPlugin.show(
    id: 0,
    title: '',
    body: '$name have just uploaded a new story.',
    notificationDetails: platformChannelSpecifics,
    payload: 'item x',
  );
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  void initState() {
    super.initState();
    loadColor();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<String>(
      stream: bloc.recieveColorName,
      initialData: 'Yellow',
      builder: (BuildContext context, AsyncSnapshot<String> snapshot) {
        final Color primary = themeChooser(snapshot.data);
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'Memopin',
          theme: ThemeData(
            // Keep the original Material 2 look; Material 3 restyles every widget.
            useMaterial3: false,
            primaryColor: primary,
            colorScheme: ColorScheme.fromSeed(
              seedColor: primary,
            ).copyWith(primary: primary, secondary: const Color(0xffb6b6b6)),
            fontFamily: 'NotoSerif',
            scaffoldBackgroundColor: Colors.white,
          ),

          //The HomePage is being called here homepage.dart
          home: const HomePage(),
        );
      },
    );
  }
}
