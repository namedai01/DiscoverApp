import 'package:firebase_auth/firebase_auth.dart';

import '../api/api_client.dart';
import '../api/memopin_api.dart';
import '../config.dart';

/// The app's API client. Set by [initServices]; later tasks add more services.
late final MemopinApi api;

/// Call once from `main()`, after `dotenv.load()` and `Firebase.initializeApp()`.
void initServices() {
  api = MemopinApi(
    ApiClient(
      baseUrl: AppConfig.apiBaseUrl,
      idToken: ({bool forceRefresh = false}) async =>
          FirebaseAuth.instance.currentUser?.getIdToken(forceRefresh),
    ),
  );
}
