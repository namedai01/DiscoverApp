import 'package:memopin/api/models.dart';
import 'package:memopin/components/net_image.dart';
import 'package:memopin/pages/user_public_profile_page.dart';
import 'package:memopin/utils.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class UserCard extends StatelessWidget {
  final AppUser user;

  const UserCard({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final image = imageOrNull(user.photoUrl);
    return InkWell(
      onTap: () {
        if (FirebaseAuth.instance.currentUser == null) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text("Please Login :((((")));
        } else {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (BuildContext context) =>
                  UserPublicProfilePage(user: user),
            ),
          );
        }
      },
      child: Row(
        children: <Widget>[
          Hero(
            tag: 'HeroTag ${user.displayName}',
            child: Container(
              height: 70,
              width: 70,
              decoration: BoxDecoration(
                image: image == null
                    ? null
                    : DecorationImage(image: image, fit: BoxFit.cover),
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
                  user.displayName,
                  maxLines: 1,
                  style: TextStyle(fontSize: 15),
                ),
              ),
              SizedBox(height: 5),
              Container(
                width: MediaQuery.of(context).size.width - 160,
                child: Text(
                  formatFollower(user.followerCount),
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
