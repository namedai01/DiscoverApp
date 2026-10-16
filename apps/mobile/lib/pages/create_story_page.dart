import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'package:geolocator/geolocator.dart';
import 'package:logger/logger.dart';
import 'package:random_string/random_string.dart';

class CreateStoryPage extends StatefulWidget {
  const CreateStoryPage({super.key});

  @override
  State<CreateStoryPage> createState() => _CreateStoryPageState();
}

class _CreateStoryPageState extends State<CreateStoryPage> {
  final FirebaseFirestore firebaseFirestore = FirebaseFirestore.instance;
  var logger = Logger();

  /// Properties for the story
  String title = '', type = '', desc = '';
  String locationId = "";
  String venueName = "";

  File? selectedImage;
  bool _isLoading = false;

  /// Get the image from device when tap add-image
  Future<void> getImage() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (picked == null) return;
    setState(() {
      selectedImage = File(picked.path);
    });
  }

  void showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  /// Upload story to firebase
  Future<void> upload() async {
    final user = FirebaseAuth.instance.currentUser;
    final image = selectedImage;
    if (user == null) {
      showMessage("Please Login :((((");
      return;
    }
    if (image == null) {
      showMessage("Please choose a photo");
      return;
    }

    /// Get my current coordinate
    final myPosition = await getCurrentPosition();
    if (myPosition == null) {
      showMessage("Location permission is required to post a story");
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      /// Get the explore location from firebase (lat/long)
      /// and pick the one with the smallest distance from my current location.
      final querySnapshot = await firebaseFirestore
          .collection('locations')
          .get();
      var minn = double.maxFinite;
      for (final doc in querySnapshot.docs) {
        final double x1 = (doc.get("latN") as num).toDouble();
        final double y1 = (doc.get("longE") as num).toDouble();
        final x2 = myPosition.latitude;
        final y2 = myPosition.longitude;
        final distance = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
        if (minn > distance) {
          minn = distance;
          locationId = doc.id;
          venueName = doc.get("venueName");
        }
      }

      /// Add to storage
      final firebaseStorageRef = FirebaseStorage.instance.ref().child(
        "${randomAlphaNumeric(9)}.jpg",
      );
      final taskSnapshot = await firebaseStorageRef.putFile(image);

      /// Get the link to image in storage
      final downloadUrl = await taskSnapshot.ref.getDownloadURL();
      logger.d("dowloadUrl: $downloadUrl");

      /// Initial story object
      final story = {
        "locationId": locationId,
        "owner": user.uid,
        "storyDescription": desc,
        "storyImage": downloadUrl,
        "storyTime": DateTime.now(),
        "storyTitle": title,
        "storyType": type,
      };

      /// Add to firestore
      await firebaseFirestore.collection('stories').add(story);
      logger.d("Upload Successful !!!");
    } catch (e) {
      logger.e("Upload failed", error: e);
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  /// Current device position, or null when location permission is denied.
  Future<Position?> getCurrentPosition() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
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
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              "Story",
              style: TextStyle(
                fontSize: 30,
                color: Colors.black,
                fontWeight: FontWeight.bold,
              ),
            ),
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
          ),
        ],
      ),
      body: _isLoading
          ? SingleChildScrollView(
              child: Container(
                alignment: Alignment.center,
                child: CircularProgressIndicator(),
              ),
            )
          : SingleChildScrollView(
              child: Container(
                child: Column(
                  children: <Widget>[
                    SizedBox(height: 10),
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
                                  selectedImage!,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            )
                          : Container(
                              margin: EdgeInsets.symmetric(horizontal: 16),
                              height: 170,
                              decoration: BoxDecoration(
                                color: Colors.black12,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              width: MediaQuery.of(context).size.width,
                              child: Icon(
                                Icons.add_a_photo,
                                color: Colors.black45,
                              ),
                            ),
                    ),
                    SizedBox(height: 8),
                    Container(
                      margin: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 20,
                      ),
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
                                hintText: "Description",
                              ),
                              onChanged: (val) {
                                desc = val;
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
