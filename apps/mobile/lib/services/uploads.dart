import 'dart:io';
import 'dart:math';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';

const _alphabet =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/// `uploads/<uid>/<20 alphanumerics>.jpg`: the only place the Storage rules
/// let a user write, and the only URL prefix the backend accepts.
String newUploadPath(String uid, {Random? random}) {
  final r = random ?? Random.secure();
  final name = String.fromCharCodes(
    List.generate(20, (_) => _alphabet.codeUnitAt(r.nextInt(_alphabet.length))),
  );
  return 'uploads/$uid/$name.jpg';
}

/// Uploads [file] as the signed-in user's image and returns its download URL.
/// Throws [StateError] when signed out.
Future<String> uploadImage(File file) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) throw StateError('Not signed in');
  final ref = FirebaseStorage.instance.ref(newUploadPath(user.uid));
  await ref.putFile(file, SettableMetadata(contentType: 'image/jpeg'));
  return ref.getDownloadURL();
}
