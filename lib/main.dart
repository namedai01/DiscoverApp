import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:exploreapp/const.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:rxdart/subjects.dart';

import './logic/bloc.dart';
import './pages/homepage.dart';
import './logic/sharedPref_logic.dart';
import './logic/theme_chooser.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'package:wemapgl/wemapgl.dart' as WEMAP;

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

final BehaviorSubject<ReceivedNotification> didReceiveLocalNotificationSubject =
    BehaviorSubject<ReceivedNotification>();

class ReceivedNotification {
  ReceivedNotification({
    @required this.id,
    @required this.title,
    @required this.body,
    @required this.payload,
  });

  final int id;
  final String title;
  final String body;
  final String payload;
}




void main() async {
  WEMAP.Configuration.setWeMapKey("GqfwrZUEfxbwbnQUhtBMFivEysYIxelQ");

  //Following codes Customizes the StatusBar & NavigationBar.
  //Services Package were imported for these.
  WidgetsFlutterBinding.ensureInitialized();
  await load(fileName: ".env");
  await Firebase.initializeApp();
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
    systemNavigationBarDividerColor: Colors.transparent,
  ));

  initializeNotification();
  registerNotification();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  runApp(MyApp());
}

void initializeNotification() async {
  FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();
  const AndroidInitializationSettings initializationSettingsAndroid =
      AndroidInitializationSettings('@mipmap/ic_launcher');
  final IOSInitializationSettings initializationSettingsIOS =
      IOSInitializationSettings(onDidReceiveLocalNotification:
          (int id, String title, String body, String payload) async {
    didReceiveLocalNotificationSubject.add(ReceivedNotification(
        id: id, title: title, body: body, payload: payload));
  });
  // final MacOSInitializationSettings initializationSettingsMacOS =
  //     MacOSInitializationSettings();
  // final InitializationSettings initializationSettings = InitializationSettings(
  //     android: initializationSettingsAndroid,
  //     iOS: initializationSettingsIOS,
  //     macOS: initializationSettingsMacOS);
  ///[Chu' y
  var initializationSettings = new InitializationSettings(
      initializationSettingsAndroid, initializationSettingsIOS);
  /// ]
  await flutterLocalNotificationsPlugin.initialize(initializationSettings,
      onSelectNotification: (String payload) async {
    if (payload != null) {
      debugPrint('notification payload: $payload');
    }
  });
}

void registerNotification() async {
  FirebaseAuth.instance
      .authStateChanges()
      .listen(registerNotificationForCurrentUser);
}

void registerNotificationForCurrentUser(User user) {
  print('register current user');
  if (user == null) return;
  FirebaseFirestore.instance
      .collection('follow')
      .where('follower', isEqualTo: user.uid)
      .snapshots()
      .listen((event) {
    List<String> followingUid =
        event.docs.map((e) => e['target'].toString()).toList();
    for (String uid in followingUid) {
      registerSingleUserNotification(uid);
    }
  });
}

void registerSingleUserNotification(String targetUid) async {
  int numPreviousStories = -1;
  FirebaseFirestore.instance
      .collection('stories')
      .where('owner', isEqualTo: targetUid)
      .snapshots()
      .listen((event) {
    if (event.docs.length > numPreviousStories && numPreviousStories != -1) {
      showNewStoryNotification(targetUid);
    }
    numPreviousStories = event.docs.length;
  });
}

Future<void> showNewStoryNotification(String uid) async {
  String name = (await FirebaseFirestore.instance.collection(userCollectionPath).doc(uid).get())['displayName'];
  /// fix me "const"
  AndroidNotificationDetails androidPlatformChannelSpecifics =
      AndroidNotificationDetails(
          '1', 'Explore App', 'Explore App',
          importance: Importance.Max,
          priority: Priority.High,
          ticker: 'ticker');

  /// Fix me
  NotificationDetails platformChannelSpecifics =
      NotificationDetails(androidPlatformChannelSpecifics, null);
  await flutterLocalNotificationsPlugin.show(
      0, '', '$name have just uploaded a new story.', platformChannelSpecifics,
      payload: 'item x');
}

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  void initState() {
    super.initState();
    loadColor();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: bloc.recieveColorName,
      initialData: 'Yellow',
      builder: (BuildContext context, AsyncSnapshot snapshot) => MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Explore App',
        theme: ThemeData(
          primaryColor: themeChooser(snapshot.data),
          accentColor: Color(0xffb6b6b6),
          fontFamily: 'NotoSerif',
          scaffoldBackgroundColor: Colors.white,
        ),

        //The HomePage is being called here homepage.dart
        //Also the bloc is being transfered to HomePage here. Its Imp.
        home: HomePage(),
      ),
    );
  }
}
