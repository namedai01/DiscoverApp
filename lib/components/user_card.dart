import 'package:exploreapp/pages/user_public_profile_page.dart';
import 'package:exploreapp/utils.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class UserCard extends StatefulWidget {
  final String uid;
  final String displayName;
  final String photoURL;
  final int follower;

  UserCard({this.uid, this.displayName, this.photoURL, this.follower});

  @override
  _UserCardState createState() => _UserCardState();
}

class _UserCardState extends State<UserCard> {
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        if (FirebaseAuth.instance.currentUser == null) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text("Please Login :(((("),
          ));
        } else {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (BuildContext context) => UserPublicProfilePage(
                uid: widget.uid,
                displayName: widget.displayName,
                photoURL: widget.photoURL,
                follower: widget.follower,
              ),
            ),
          );
        }

      },
      child: Row(
        children: <Widget>[
          Hero(
            tag: 'HeroTag ' + widget.displayName,
            child: Container(
              height: 70,
              width: 70,
              decoration: BoxDecoration(
                image: DecorationImage(
                  image: NetworkImage(widget.photoURL),
                  fit: BoxFit.cover,
                ),
                borderRadius: BorderRadius.circular(5),
                color: Colors.grey[300],
              ),
            ),
          ),
          SizedBox(width: 20),
          Column(
            children: <Widget>[
              Container(
                width: MediaQuery.of(context).size.width - 160,
                child: Text(
                  widget.displayName,
                  maxLines: 1,
                  style: TextStyle(fontSize: 15),
                ),
              ),
              SizedBox(height: 5),
              Container(
                width: MediaQuery.of(context).size.width - 160,
                child: Text(
                  formatFollower(widget.follower),
                  textAlign: TextAlign.left,
                  style: TextStyle(
                    fontFamily: 'OpenSans',
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Color(0xffacacac),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
