import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import './logic/bloc.dart';
import './logic/sharedPref_logic.dart';
import './logic/theme_chooser.dart';
import './pages/homepage.dart';
import './services/push.dart';
import './services/services.dart';
import './services/session.dart';

Future<void> main() async {
  //Following codes Customizes the StatusBar & NavigationBar.
  //Services Package were imported for these.
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");
  await Firebase.initializeApp();
  initServices();
  await initPush(pushRegistration);
  startSession(pushRegistration);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
      systemNavigationBarDividerColor: Colors.transparent,
    ),
  );

  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  runApp(const MyApp());
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
          navigatorKey: navigatorKey,
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
