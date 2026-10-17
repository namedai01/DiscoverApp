import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_client.dart';
import '../logic/story_submitter.dart';
import '../services/services.dart';
import '../services/uploads.dart';

class CreateStoryPage extends StatefulWidget {
  const CreateStoryPage({super.key});

  @override
  State<CreateStoryPage> createState() => _CreateStoryPageState();
}

class _CreateStoryPageState extends State<CreateStoryPage> {
  late final StorySubmitter _submitter = StorySubmitter(
    api: api,
    upload: uploadImage,
    position: _currentPosition,
  );

  final _title = TextEditingController();
  final _type = TextEditingController();
  final _desc = TextEditingController();

  File? selectedImage;

  @override
  void dispose() {
    _title.dispose();
    _type.dispose();
    _desc.dispose();
    super.dispose();
  }

  /// Get the image from device when tap add-image
  Future<void> getImage() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 85,
    );
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

  /// Validate, upload the photo and post the story through the API.
  Future<void> upload() async {
    if (_submitter.busy) return;
    if (FirebaseAuth.instance.currentUser == null) {
      showMessage('Please sign in to post a story');
      return;
    }
    final draft = StoryDraft(
      image: selectedImage,
      title: _title.text,
      type: _type.text,
      description: _desc.text,
    );
    final posting = _submitter.submit(draft);
    setState(() {});
    try {
      final story = await posting;
      if (!mounted) return;
      _title.clear();
      _type.clear();
      _desc.clear();
      setState(() => selectedImage = null);
      showMessage('Posted at ${story.venueName}');
    } on StoryValidationException catch (e) {
      showMessage(e.message);
    } on ApiException catch (e) {
      showMessage(e.userMessage);
    } catch (_) {
      showMessage('Could not post your story. Please try again.');
    } finally {
      if (mounted) setState(() {});
    }
  }

  /// Current device position, or null when location permission is denied.
  /// Throws [LocationUnavailableException] when location services are off.
  Future<({double lat, double lng})?> _currentPosition() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      return (lat: p.latitude, lng: p.longitude);
    } on LocationServiceDisabledException {
      throw const LocationUnavailableException();
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
      body: _submitter.busy
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
                            controller: _title,
                            decoration: InputDecoration(hintText: "Title"),
                          ),
                          TextField(
                            controller: _type,
                            decoration: InputDecoration(hintText: "Type"),
                          ),
                          Container(
                            margin: const EdgeInsets.only(top: 20.0),
                            child: TextField(
                              controller: _desc,
                              maxLines: 8,
                              decoration: InputDecoration.collapsed(
                                hintText: "Description",
                              ),
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
