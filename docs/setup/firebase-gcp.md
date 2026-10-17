# Firebase + Google Cloud Setup

Fresh setup for Memopin: one new Firebase project, which is also the Google Cloud project that hosts the Go backend on Cloud Run. Postgres runs in local Docker during development and on Neon (free plan) once deployed. There are no real users yet, so nothing from the old project (`exploreapp-eda90`) is migrated except, optionally, the `locations` seed data.

Placeholders used below (pick once, reuse everywhere):

| Placeholder | Example | Notes |
|---|---|---|
| `<PROJECT_ID>` | `memopin-app` | Global, permanent, lowercase. Firebase project id = GCP project id. |
| `<APP_ID>` | `com.memopin.app` | Android `applicationId` and iOS bundle id. Already set in the code; not a placeholder you need to choose. |
| `<REGION>` | `asia-southeast1` | Singapore. Use it for Storage and Cloud Run; Neon goes in its Singapore region too. |

## 1. Install tools (once)

```bash
brew install --cask google-cloud-sdk
npm install -g firebase-tools
dart pub global activate flutterfire_cli

gcloud auth login
gcloud auth application-default login   # local backend uses these credentials, no key file
firebase login
```

## 2. Create the project

1. Firebase console → **Add project** → name `Memopin`, project id `<PROJECT_ID>`. Google Analytics: off (not used).
2. **Upgrade to Blaze** (pay as you go). Needed for: Cloud Run, the default Storage bucket on new projects, and sending real OTP SMS.
3. Google Cloud console → Billing → **Budgets & alerts** → budget 10 USD/month, alerts at 50/90/100%.

```bash
gcloud config set project <PROJECT_ID>
gcloud auth application-default set-quota-project <PROJECT_ID>
```

## 3. Authentication (phone)

1. Firebase console → **Authentication** → Get started → Sign-in method → **Phone** → Enable.
2. Same page → **Phone numbers for testing** → add `+84 900000001` with code `123456` (and a second one). Test numbers send no SMS and cost nothing; use them for all development.
3. Settings → **Authorized domains**: `localhost` is there by default. Add the web domain later (Phase 3).

## 4. Register the apps

The app id is already `com.memopin.app` on Android and iOS. Until this step is done, the Android build fails with `No matching client found for package name 'com.memopin.app'`, because the committed `google-services.json` still belongs to the old project.

```bash
cd apps/mobile
flutterfire configure --project=<PROJECT_ID> --platforms=android,ios
```

This registers both apps and writes `lib/firebase_options.dart`, `android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`. `main.dart` must then call `Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)` (Phase 2 change). These files hold client identifiers, not secrets; committing them is normal.

Android phone auth needs the signing fingerprints:

```bash
cd apps/mobile/android && ./gradlew signingReport   # copy SHA1 and SHA-256 of the debug variant
```

Firebase console → Project settings → Android app → **Add fingerprint** → paste both. Repeat with the release keystore later.

Web app (for Phase 3): Project settings → **Add app** → Web → nickname `web`. Copy the config object; it goes into `apps/web/.env.local` as `NEXT_PUBLIC_FIREBASE_*`.

## 5. Storage

1. Firebase console → **Storage** → Get started → location `<REGION>`, production mode. The bucket is `<PROJECT_ID>.firebasestorage.app`.
2. Rules live in the repo at `firebase/storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{uid}/{file} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

3. Deploy them:

```bash
cd <repo root>
firebase init storage --project <PROJECT_ID>   # choose firebase/storage.rules
firebase deploy --only storage --project <PROJECT_ID>
```

Do **not** create a Firestore database. Data lives in Postgres.

## 6. Cloud Messaging (push)

- Android: nothing to do; FCM HTTP v1 API is on by default for new projects.
- iOS (needs a paid Apple Developer account): developer.apple.com → Keys → **+** → enable Apple Push Notifications service → download the `.p8` file, note Key ID and Team ID. Firebase console → Project settings → Cloud Messaging → Apple app → **Upload APNs auth key**.

## 7. Backend infrastructure (Neon Postgres + Cloud Run)

Database plan: **local Docker now, Neon Free when the API is first deployed**, Cloud SQL later if/when the app launches (move with `pg_dump` / `pg_restore` and a new secret; no code change).

### 7a. Neon (only when deploying; skip during local dev)

1. neon.tech → sign up → **New project**: name `memopin`, Postgres 16, region **AWS Asia Pacific (Singapore)** (closest to `<REGION>`).
2. Database `memopin`, role `memopin_api` (Neon creates a default role; renaming is optional).
3. Dashboard → **Connect** → turn **Connection pooling off** and copy the *direct* connection string. It looks like `postgres://memopin_api:<pw>@ep-xxx.ap-southeast-1.aws.neon.tech/memopin?sslmode=require`. Use the direct (non `-pooler`) host: migrations need a session, and the API keeps its own small pool.
4. Check PostGIS once from the Neon SQL editor: `CREATE EXTENSION IF NOT EXISTS postgis; SELECT postgis_version();` (the backend migration also runs the `CREATE`).

Free plan limits to keep in mind: 1 GB storage per project, 100 compute-hours per month, compute sleeps after 5 minutes idle (the first request after that waits for it to wake up).

### 7b. Google Cloud

Enable APIs:

```bash
gcloud services enable run.googleapis.com secretmanager.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com fcm.googleapis.com
```

Store the Neon connection string (append `&pool_max_conns=5` to stay well under Neon's connection limit):

```bash
printf '%s' 'postgres://memopin_api:<pw>@ep-xxx.ap-southeast-1.aws.neon.tech/memopin?sslmode=require&pool_max_conns=5' \
  | gcloud secrets create database-url --data-file=-
```

Service account for the API (no key file is ever created; Cloud Run attaches it):

```bash
gcloud iam service-accounts create memopin-api --display-name="Memopin API"
SA=memopin-api@<PROJECT_ID>.iam.gserviceaccount.com
for role in roles/secretmanager.secretAccessor roles/firebasecloudmessaging.admin; do
  gcloud projects add-iam-policy-binding <PROJECT_ID> --member="serviceAccount:$SA" --role="$role"
done
```

Deploy (after backend Phase 1 is done; run from repo root):

```bash
gcloud run deploy memopin-api --source backend --region <REGION> \
  --service-account "$SA" \
  --set-secrets DATABASE_URL=database-url:latest \
  --set-env-vars APP_ENV=prod,AUTH_MODE=firebase,FIREBASE_PROJECT_ID=<PROJECT_ID>,STORAGE_BUCKET=<PROJECT_ID>.firebasestorage.app \
  --allow-unauthenticated
```

`--allow-unauthenticated` is correct: Cloud Run lets requests in, the API itself checks Firebase ID tokens.

## 8. Local development

- Postgres runs in Docker: `cd backend && make dev` starts `postgis/postgis:16-3.4` from `compose.yaml` and the API. Local connection string (in `backend/.env`, gitignored): `postgres://memopin:memopin@localhost:5433/memopin?sslmode=disable`.
- Firebase Admin (token verify, FCM) uses `gcloud auth application-default login`. Use `AUTH_MODE=fake` when you do not want real tokens.
- Seeding Neon from your laptop: `DATABASE_URL='<neon direct url>' go run ./cmd/seed`.
- **Never** put `DATABASE_URL` in `apps/mobile/.env` or any web env: those files ship inside the app/bundle.

## 9. Old project

- If you can still open `exploreapp-eda90`: export `locations` (Firestore console or a short script) into `backend/seed/locations.json` for the seed command.
- Otherwise write a few places by hand in that file.
- Deleting the old project is optional and irreversible; do it only once nothing points at it.

## Checklist

- [ ] Project created, Blaze on, budget alert set
- [ ] Phone auth on, test numbers added
- [ ] App id changed, `flutterfire configure` run, SHA-1/SHA-256 added
- [ ] Storage bucket + rules deployed
- [ ] (iOS) APNs key uploaded
- [ ] (at deploy time) Neon project in Singapore, PostGIS checked, `database-url` secret
- [ ] `memopin-api` service account with 2 roles
