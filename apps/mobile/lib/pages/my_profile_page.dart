import 'dart:io';

import 'package:memopin/pages/user_stories_timeline.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl_phone_number_input/intl_phone_number_input.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../components/net_image.dart';
import '../logic/validators.dart';
import '../services/services.dart';
import '../services/session.dart';
import '../services/uploads.dart';

class MyProfilePage extends StatefulWidget {
  const MyProfilePage({super.key});

  @override
  State<MyProfilePage> createState() => _MyProfilePageState();
}

class _MyProfilePageState extends State<MyProfilePage> {
  final FirebaseAuth firebaseAuth = FirebaseAuth.instance;

  String phoneNumber = '';

  /// The signed-in user's profile. Replaced after each write.
  Future<AppUser>? _me;
  String? _meUid;
  bool _updatingPhoto = false;

  void _loadMe() => setState(() => _me = api.getMe());

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: firebaseAuth.authStateChanges(),
      builder: (BuildContext context, AsyncSnapshot snapshot) {
        if (!snapshot.hasData) {
          _meUid = null;
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Padding(
                  padding: EdgeInsets.all(8.0),
                  child: InternationalPhoneNumberInput(
                    onInputChanged: (PhoneNumber number) {
                      phoneNumber = number.phoneNumber ?? '';
                    },
                    ignoreBlank: true,
                    autoValidateMode: AutovalidateMode.disabled,
                    selectorConfig: SelectorConfig(
                      selectorType: PhoneInputSelectorType.BOTTOM_SHEET,
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: () {
                    firebaseAuth.verifyPhoneNumber(
                      phoneNumber: phoneNumber,
                      verificationFailed: (FirebaseAuthException e) {
                        print(e);
                      },
                      codeAutoRetrievalTimeout: (String verificationId) {},
                      codeSent:
                          (String verificationId, int? resendToken) async {
                            String smsCode = await promptSmsCode();
                            PhoneAuthCredential credential =
                                PhoneAuthProvider.credential(
                                  verificationId: verificationId,
                                  smsCode: smsCode,
                                );
                            await firebaseAuth.signInWithCredential(
                              credential,
                            );
                          },
                      verificationCompleted: (PhoneAuthCredential credential) {
                        firebaseAuth.signInWithCredential(credential);
                      },
                    );
                  },
                  child: Text('Sign in'),
                ),
              ],
            ),
          );
        } else {
          return _signedIn(snapshot.data as User);
        }
      },
    );
  }

  Widget _signedIn(User user) {
    if (_meUid != user.uid) {
      _meUid = user.uid;
      _me = api.getMe();
    }
    return FutureBuilder<AppUser>(
      future: _me,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        final me = snapshot.data;
        if (snapshot.hasError || me == null) {
          final error = snapshot.error;
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  error is ApiException
                      ? error.userMessage
                      : 'Could not load your profile.',
                ),
                TextButton(onPressed: _loadMe, child: const Text('Retry')),
                TextButton(onPressed: signOut, child: const Text('Sign out')),
              ],
            ),
          );
        }
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(0, 0, 0, 10),
              child: SizedBox(
                height: 100,
                child: Row(
                  children: [
                    Expanded(
                      flex: 30,
                      child: GestureDetector(
                        onTap: showPhotoOptions,
                        child: CircleAvatar(
                          radius: 50,
                          backgroundColor: Colors.black12,
                          backgroundImage: imageOrNull(me.photoUrl),
                          child: _updatingPhoto
                              ? const CircularProgressIndicator()
                              : null,
                        ),
                      ),
                    ),
                    Expanded(
                      flex: 50,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: Text(me.displayName)),
                          Expanded(
                            child: Row(
                              children: [
                                Icon(Icons.favorite_outline_sharp),
                                SizedBox(width: 5),
                                Text('${me.followerCount} followers'),
                              ],
                            ),
                          ),
                          Expanded(
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.start,
                              children: [
                                IconButton(
                                  onPressed: editDisplayName,
                                  icon: Icon(Icons.edit_outlined),
                                ),
                                IconButton(
                                  onPressed: signOut,
                                  icon: Icon(Icons.logout),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Divider(thickness: 2),
            Expanded(child: UserStoriesTimeLine(uid: me.id)),
          ],
        );
      },
    );
  }

  Future<String> promptSmsCode() async {
    String smsCode = '';
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          contentPadding: const EdgeInsets.all(16.0),
          content: Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  keyboardType: TextInputType.number,
                  autofocus: true,
                  decoration: InputDecoration(labelText: 'Verification code'),
                  onChanged: (value) {
                    smsCode = value;
                    if (value.length == 6) {
                      Navigator.pop(context);
                    }
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
    return smsCode;
  }

  void _showError(Object e) {
    if (!mounted) return;
    final message = e is ApiException
        ? e.userMessage
        : 'Something went wrong. Please try again.';
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> editDisplayName() async {
    final formKey = GlobalKey<FormState>();
    String displayName = '';
    var saving = false;
    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            contentPadding: const EdgeInsets.all(16.0),
            content: Form(
              key: formKey,
              child: TextFormField(
                validator: (value) => validateDisplayName(value ?? ''),
                autofocus: true,
                decoration: InputDecoration(labelText: 'New display name'),
                onChanged: (value) {
                  displayName = value;
                },
              ),
            ),
            actions: <Widget>[
              TextButton(
                child: const Text('Cancel'),
                onPressed: () {
                  Navigator.pop(context);
                },
              ),
              TextButton(
                onPressed: saving
                    ? null
                    : () async {
                        if (!formKey.currentState!.validate()) return;
                        setDialogState(() => saving = true);
                        try {
                          final updated = await api.updateMe(
                            displayName: displayName.trim(),
                          );
                          if (mounted) {
                            setState(() => _me = Future.value(updated));
                          }
                          if (context.mounted) Navigator.pop(context);
                        } catch (e) {
                          _showError(e);
                          if (context.mounted) {
                            setDialogState(() => saving = false);
                          }
                        }
                      },
                child: const Text('OK'),
              ),
            ],
          ),
        );
      },
    );
  }

  void showPhotoOptions() {
    showModalBottomSheet<void>(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.0)),
      context: context,
      builder: (BuildContext sheetContext) {
        return Container(
          child: new Padding(
            padding: const EdgeInsets.all(32.0),
            child: ListView(
              children: <Widget>[
                ListTile(
                  title: Text(
                    'Change photo',
                    textAlign: TextAlign.center,
                    style: new TextStyle(color: Colors.black87, fontSize: 24.0),
                  ),
                  onTap: () {
                    Navigator.pop(sheetContext);
                    updatePhoto();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> updatePhoto() async {
    if (_updatingPhoto) return;
    final pickedFile = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 85,
    );
    if (pickedFile == null) return;
    setState(() => _updatingPhoto = true);
    try {
      final url = await uploadImage(File(pickedFile.path));
      final updated = await api.updateMe(photoUrl: url);
      if (mounted) setState(() => _me = Future.value(updated));
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => _updatingPhoto = false);
    }
  }
}
