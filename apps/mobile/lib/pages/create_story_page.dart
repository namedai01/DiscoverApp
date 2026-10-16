import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'package:geolocator/geolocator.dart';
import 'package:logger/logger.dart';
import 'package:random_string/random_string.dart';

import 'my_profile_page.dart';

class CreateStoryPage extends StatefulWidget {
  @override
  _CreateStoryPageState createState() => _CreateStoryPageState();
}

class _CreateStoryPageState extends State<CreateStoryPage> {
  final FirebaseFirestore firebaseFirestore = FirebaseFirestore.instance;
  var logger = Logger();

  /// Properties for the story
  String title, type, desc;
  String locationId = "";
  String venueName = "";

  File selectedImage;
  bool _isLoading = false;

  /// Get the image from device when tap add-image
  Future getImage() async {
    var image = await ImagePicker.pickImage(source: ImageSource.gallery);
    setState(() {
      selectedImage = image;
    });
  }

  /// Upload story to firebase
  Future upload() async {
    if (FirebaseAuth.instance.currentUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text("Please Login :(((("),
      ));
      logger.d("Hello");
    } else {
      /// Get my current coordinate
      var myPosition = await Geolocator()
          .getCurrentPosition(desiredAccuracy: LocationAccuracy.high);

      /// Get my address location
      var place = await Geolocator()
          .placemarkFromCoordinates(myPosition.latitude, myPosition.longitude);
      // logger.d("locality", place[0].locality);
      // logger.d("country", place[0].country);
      //
      // logger.d("myPositionLat", myPosition.latitude);
      // logger.d("myPositionLong", myPosition.longitude);
      if (selectedImage != null) {
        setState(() {
          _isLoading = true;
        });
      }

      var minn = double.maxFinite;

      /// Get the explore location from firebase (lat/long)
      await firebaseFirestore
          .collection('locations')
          .get()
          .then((QuerySnapshot querySnapshot) async {
        /// Calc the smallest distance from my current location
        querySnapshot.docs.forEach((doc) {
          // logger.d("docs", doc.get("latN"), doc.get("longE"));
          var x1 = doc.get("latN");
          var y1 = doc.get("longE");
          var x2 = myPosition.latitude;
          var y2 = myPosition.longitude;
          // logger.d("locationId", doc.id);
          var distance = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
          // logger.d("distance", distance);
          if (minn > distance) {
            minn = distance;
            setState(() {
              locationId = doc.id;
              venueName = doc.get("venueName");
            });
          }
        });
        // logger.d("venueName", venueName);

        /// Add to storage
        StorageReference firebaseStorageRef = FirebaseStorage.instance
            .ref()
            .child("${randomAlphaNumeric(9)}.jpg");
        final StorageUploadTask task =
            firebaseStorageRef.putFile(selectedImage);

        /// Get the link to image in storage
        var downloadUrl = await (await task.onComplete).ref.getDownloadURL();
        logger.d("dowloadUrl", downloadUrl);

        /// Initial story object
        var story = {
          "locationId": locationId,
          "owner": FirebaseAuth.instance.currentUser.uid,
          "storyDescription": desc,
          "storyImage": downloadUrl,
          "storyTime": new DateTime.now(),
          "storyTitle": title,
          "storyType": type,
        };

        /// Add to firestore
        await firebaseFirestore
            .collection('stories')
            .add(story)
            .catchError((e) {
          logger.d("Error", e);
        }).then((result) {
          logger.d("Upload Successful !!!");
          setState(() {
            _isLoading = false;
          });
        });
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Text(
                "Create",
                style: TextStyle(
                    fontSize: 30,
                    color: Colors.black45,
                    fontWeight: FontWeight.bold),
              ),
              Text(
                "Story",
                style: TextStyle(
                    fontSize: 30,
                    color: Colors.black,
                    fontWeight: FontWeight.bold),
              )
            ],
          ),
          backgroundColor: Colors.transparent,
          elevation: 0.0,
          actions: <Widget>[
            GestureDetector(
              onTap: () {
                upload();
              },
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Icon(Icons.file_upload, color: Colors.black45),
              ),
            )
          ],
        ),
        body: _isLoading
            ? SingleChildScrollView(
                child: Container(
                alignment: Alignment.center,
                child: CircularProgressIndicator(),
              ))
            : SingleChildScrollView(
                child: Container(
                  child: Column(
                    children: <Widget>[
                      SizedBox(
                        height: 10,
                      ),
                      GestureDetector(
                        onTap: () {
                          getImage();
                        },
                        child: selectedImage != null
                            ? Container(
                                margin: EdgeInsets.symmetric(horizontal: 16),
                                height: 170,
                                width: MediaQuery.of(context).size.width,
                                child: ClipRRect(
                                    borderRadius: BorderRadius.circular(6),
                                    child: Image.file(
                                      selectedImage,
                                      fit: BoxFit.cover,
                                    )),
                              )
                            : Container(
                                margin: EdgeInsets.symmetric(horizontal: 16),
                                height: 170,
                                decoration: BoxDecoration(
                                    color: Colors.black12,
                                    borderRadius: BorderRadius.circular(6)),
                                width: MediaQuery.of(context).size.width,
                                child: Icon(
                                  Icons.add_a_photo,
                                  color: Colors.black45,
                                ),
                              ),
                      ),
                      SizedBox(
                        height: 8,
                      ),
                      Container(
                        margin:
                            EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                        child: Column(
                          children: <Widget>[
                            TextField(
                              decoration: InputDecoration(hintText: "Title"),
                              onChanged: (val) {
                                title = val;
                              },
                            ),
                            TextField(
                              decoration: InputDecoration(hintText: "Type"),
                              onChanged: (val) {
                                type = val;
                              },
                            ),
                            Container(
                                margin: const EdgeInsets.only(top: 20.0),
                                child: TextField(
                                      maxLines: 8,
                                      decoration: InputDecoration.collapsed(
                                          hintText: "Description"),
                                      onChanged: (val) {
                                        desc = val;
                                      }),
                                ),
                          ],
                        ),
                      )
                    ],
                  ),
                ),
              ));
  }
}
