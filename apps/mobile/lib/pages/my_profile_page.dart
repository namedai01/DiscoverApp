import 'dart:io';

import 'package:exploreapp/pages/user_stories_timeline.dart';
import 'package:exploreapp/utils.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:intl_phone_number_input/intl_phone_number_input.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:random_string/random_string.dart';

import '../const.dart';

class MyProfilePage extends StatefulWidget {
  @override
  _MyProfilePageState createState() => _MyProfilePageState();
}

class _MyProfilePageState extends State<MyProfilePage> {
  final FirebaseFirestore adminFSI = FirebaseFirestore.instance;
  final FirebaseAuth firebaseAuth = FirebaseAuth.instance;

  String phoneNumber = '';
  String verificationId;

  int numberFollower = 1;

  @override
  void initState() {
    super.initState();
    if (firebaseAuth.currentUser != null) {
      adminFSI
          .collection(followCollectionPath)
          .where("target", isEqualTo: firebaseAuth.currentUser.uid)
          .get()
          .then((value) {
        if (value != null) {
          setState(() {
            numberFollower = value.docs.length;
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: firebaseAuth.authStateChanges(),
      builder: (BuildContext context, AsyncSnapshot snapshot) {
        if (!snapshot.hasData) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Padding(
                  padding: EdgeInsets.all(8.0),
                  child: InternationalPhoneNumberInput(
                    onInputChanged: (PhoneNumber number) {
                      phoneNumber = number.phoneNumber;
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
                            (String verificationId, int resendToken) async {
                          String smsCode = await promptSmsCode();
                          PhoneAuthCredential credential =
                              PhoneAuthProvider.credential(
                                  verificationId: verificationId,
                                  smsCode: smsCode);
                          User user = (await firebaseAuth
                                  .signInWithCredential(credential))
                              .user;
                          if (!await userExisted(user.uid)) {
                            createUserPublicProfile(user.uid, phoneNumber);
                          }
                        },
                        verificationCompleted:
                            (PhoneAuthCredential credential) {
                          firebaseAuth.signInWithCredential(credential);
                        },
                      );
                    },
                    child: Text('Sign in')),
              ],
            ),
          );
        } else {
          return StreamBuilder(
              stream: adminFSI
                  .collection(userCollectionPath)
                  .doc(firebaseAuth.currentUser.uid)
                  .snapshots(),
              builder: (BuildContext context, AsyncSnapshot snapshot) {
                if (!snapshot.hasData) {
                  return Container();
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
                                  onTap: () {
                                    showPhotoOptions(snapshot.data.id);
                                  },
                                  child: CircleAvatar(
                                      radius: 50,
                                      backgroundImage: NetworkImage(
                                          snapshot.data['photoURL'])),
                                )),
                            Expanded(
                              flex: 50,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                      child:
                                          Text(snapshot.data['displayName'])),
                                  Expanded(
                                      child: Row(
                                    children: [
                                      Icon(Icons.favorite_outline_sharp),
                                      SizedBox(
                                        width: 5,
                                      ),
                                      Text(numberFollower.toString() + ' followers'),
                                    ],
                                  )),
                                  Expanded(
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.start,
                                      children: [
                                        IconButton(
                                          onPressed: () {
                                            editDisplayName(snapshot.data.id);
                                          },
                                          icon: Icon(Icons.edit_outlined),
                                        ),
                                        IconButton(
                                            onPressed: firebaseAuth.signOut,
                                            icon: Icon(Icons.logout)),
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
                    Divider(
                      thickness: 2,
                    ),
                    Expanded(child: UserStoriesTimeLine(uid: snapshot.data.id))
                  ],
                );
              });
        }
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
                )
              ],
            ),
          );
        });
    return smsCode;
  }

  Future<bool> userExisted(String uid) async {
    return (await adminFSI.collection('users').doc(uid).get()).exists;
  }

  Future<void> createUserPublicProfile(String uid, String phoneNumber) async {
    return adminFSI.collection('users').doc(uid).set({
      "displayName": 'user $phoneNumber',
      'photoURL': env['DEFAULT_USER_PHOTO_URL'],
    });
  }

  Future<void> editDisplayName(String uid) async {
    final formKey = GlobalKey<FormState>();
    String displayName = '';
    await showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            contentPadding: const EdgeInsets.all(16.0),
            content: Form(
              key: formKey,
              child: TextFormField(
                validator: (value) =>
                    value == null ? 'Please enter a new name' : null,
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
                  }),
              TextButton(
                  child: const Text('OK'),
                  onPressed: () async {
                    if (formKey.currentState.validate()) {
                      await updateDisplayName(uid, displayName);
                      Navigator.pop(context);
                    }
                  })
            ],
          );
        });
  }

  Future<void> updateDisplayName(String uid, String displayName) {
    return adminFSI
        .collection(userCollectionPath)
        .doc(uid)
        .update({'displayName': displayName});
  }

  void showPhotoOptions(String uid) {
    showModalBottomSheet<void>(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(15.0),
        ),
        context: context,
        builder: (BuildContext context) {
          return Container(
              child: new Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: ListView(
                    children: <Widget>[
                      ListTile(
                          title: Text('Change photo',
                              textAlign: TextAlign.center,
                              style: new TextStyle(
                                  color: Colors.black87, fontSize: 24.0)),
                          onTap: () {
                            updatePhoto(uid);
                          }),
                    ],
                  ))
              // )));
              );
        });
  }

  Future<void> updatePhoto(String uid) async {
    // final ImagePicker picker = ImagePicker();
    // final PickedFile pickedFile =
    //     await picker.getImage(source: ImageSource.gallery);
    var pickedFile = await ImagePicker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      String fileName = unionName(pickedFile.path);
      final FirebaseStorage instance = FirebaseStorage.instance;

      // await instance.ref(fileName).putFile(File(pickedFile.path));
      // String url = await instance.ref(fileName).getDownloadURL();
      StorageReference firebaseStorageRef =
      FirebaseStorage.instance.ref().child("${randomAlphaNumeric(9)}.jpg");
      final StorageUploadTask task = firebaseStorageRef.putFile(File(pickedFile.path));
      /// Get the link to image in storage
      var url = await (await task.onComplete).ref.getDownloadURL();

      return adminFSI.collection(userCollectionPath).doc(uid).update({'photoURL': url});
    }
  }
}
