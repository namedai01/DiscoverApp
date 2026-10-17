import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:memopin/logic/map_logic.dart';
import 'package:memopin/pages/user_stories_timeline.dart';
import 'package:memopin/utils.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../const.dart';

// ignore: must_be_immutable
class UserPublicProfilePage extends StatefulWidget {
  final String uid;
  final String displayName;
  final String photoURL;
  int follower;

  UserPublicProfilePage({
    super.key,
    required this.uid,
    required this.displayName,
    required this.photoURL,
    required this.follower,
  });

  @override
  State<UserPublicProfilePage> createState() => _UserPublicProfilePageState();
}

class _UserPublicProfilePageState extends State<UserPublicProfilePage> {
  final FirebaseFirestore firestore = FirebaseFirestore.instance;
  final FirebaseAuth firebaseAuth = FirebaseAuth.instance;
  bool fl = false;

  @override
  void initState() {
    super.initState();
    firestore
        .collection(followCollectionPath)
        .where("follower", isEqualTo: firebaseAuth.currentUser!.uid)
        .where('target', isEqualTo: widget.uid)
        .get()
        .then((value) {
          if (value.docs.isNotEmpty && mounted) {
            logger.d("User public profile: ${value.docs[0].id}");
            setState(() {
              fl = true;
            });
          }
        });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.only(top: 50),
        child: Stack(
          alignment: AlignmentDirectional.topCenter,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(0, 50, 0, 0),
              child: Column(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.grey[300],
                    ),
                    height: 150,
                    width: 150,
                    child: Hero(
                      tag: 'HeroTag ' + widget.displayName,
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          image: DecorationImage(
                            image: NetworkImage(widget.photoURL),
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Center(child: Text(widget.displayName)),
                  widget.uid != FirebaseAuth.instance.currentUser!.uid
                      ? Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(formatFollower(widget.follower)),
                            SizedBox(width: 20),
                            StreamBuilder(
                              stream: FirebaseAuth.instance.authStateChanges(),
                              builder:
                                  (
                                    BuildContext context,
                                    AsyncSnapshot snapshot,
                                  ) {
                                    if (!snapshot.hasData) return Container();
                                    String currentUid = snapshot.data.uid;
                                    return StreamBuilder(
                                      stream: firestore
                                          .collection(followCollectionPath)
                                          .where(
                                            'follower',
                                            isEqualTo: currentUid,
                                          )
                                          .where(
                                            'target',
                                            isEqualTo: widget.uid,
                                          )
                                          .snapshots(),
                                      builder:
                                          (
                                            BuildContext context,
                                            AsyncSnapshot snapshot,
                                          ) {
                                            if (!snapshot.hasData ||
                                                snapshot.data.docs.length ==
                                                    0) {
                                              return ElevatedButton(
                                                onPressed: () {
                                                  follow(
                                                    currentUid,
                                                    widget.uid,
                                                  );
                                                },
                                                child: Text('Follow'),
                                              );
                                            } else {
                                              return ElevatedButton(
                                                style: ButtonStyle(
                                                  backgroundColor:
                                                      WidgetStateProperty.all<
                                                        Color
                                                      >(Colors.white10),
                                                ),
                                                onPressed: () {
                                                  unfollow(
                                                    currentUid,
                                                    widget.uid,
                                                  );
                                                },
                                                child: Text('Unfollow'),
                                              );
                                            }
                                          },
                                    );
                                  },
                            ),
                          ],
                        )
                      : Center(child: Text(formatFollower(widget.follower))),
                  SizedBox(height: 20),
                  Divider(thickness: 2),
                  fl
                      ? Expanded(child: UserStoriesTimeLine(uid: widget.uid))
                      : Container(
                          margin: EdgeInsets.all(50),
                          child: Center(
                            child: Text(
                              "Please follow me to sightsee !!!",
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                ],
              ),
            ),
            Container(
              //This is Back Arrow to Navigate Back.
              alignment: Alignment.topLeft,
              child: IconButton(
                icon: Icon(Icons.arrow_back),
                iconSize: 30,
                padding: EdgeInsets.all(0),
                onPressed: () {
                  Navigator.pop(context);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> follow(String currentUid, String uid) async {
    setState(() {
      fl = true;
      widget.follower++;
    });

    await firestore.collection(followCollectionPath).add({
      'follower': currentUid,
      'target': uid,
    });
  }

  Future<void> unfollow(String currentUid, String uid) async {
    setState(() {
      widget.follower--;
    });
    List<dynamic> records =
        (await firestore
                .collection(followCollectionPath)
                .where('follower', isEqualTo: currentUid)
                .where('target', isEqualTo: uid)
                .get())
            .docs;
    for (var record in records) {
      firestore.collection(followCollectionPath).doc(record.id).delete();
    }
  }
}
