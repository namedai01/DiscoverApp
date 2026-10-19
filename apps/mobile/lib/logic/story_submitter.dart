import 'dart:async';
import 'dart:io';

import '../api/memopin_api.dart';
import '../api/models.dart';
import './validators.dart';

/// What the user has typed and picked on the create-story form.
class StoryDraft {
  const StoryDraft({
    this.image,
    this.title = '',
    this.type = '',
    this.description = '',
  });

  final File? image;
  final String title, type, description;
}

/// The draft is not fit to post; [message] is safe to show to the user.
class StoryValidationException implements Exception {
  const StoryValidationException(this.message);

  final String message;

  @override
  String toString() => 'StoryValidationException($message)';
}

/// The position source could not read a position because location services
/// are off or failed; the submitter turns this into a [StoryValidationException].
class LocationUnavailableException implements Exception {
  const LocationUnavailableException();

  @override
  String toString() => 'LocationUnavailableException';
}

/// Validates, uploads the photo, then posts the story, at most once at a time.
///
/// Invalid input and a missing position are rejected before the upload, so no
/// orphan files are left in Storage. A second [submit] while one is running
/// returns the running one's result instead of starting another.
class StorySubmitter {
  StorySubmitter({
    required this._api,
    required this._upload,
    required this._position,
    this._uploadTimeout = const Duration(seconds: 60),
  });

  final MemopinApi _api;
  final Future<String> Function(File image) _upload;
  final Future<({double lat, double lng})?> Function() _position;
  final Duration _uploadTimeout;

  Future<Story>? _inFlight;

  bool get busy => _inFlight != null;

  /// Throws [StoryValidationException] for bad input, `ApiException` when the
  /// API refuses (for example 422 when no places exist).
  Future<Story> submit(StoryDraft draft) {
    final running = _inFlight;
    if (running != null) return running;
    final run = _run(draft).whenComplete(() => _inFlight = null);
    _inFlight = run;
    return run;
  }

  Future<Story> _run(StoryDraft draft) async {
    final image = draft.image;
    if (image == null) {
      throw const StoryValidationException('Please choose a photo');
    }
    final invalid =
        validateStoryTitle(draft.title) ??
        validateStoryType(draft.type) ??
        validateStoryDescription(draft.description);
    if (invalid != null) throw StoryValidationException(invalid);

    final ({double lat, double lng})? here;
    try {
      here = await _position();
    } on LocationUnavailableException {
      throw const StoryValidationException(
        'Turn on location services to post a story',
      );
    } on TimeoutException {
      // No GPS fix in time: same advice as location being off.
      throw const StoryValidationException(
        'Turn on location services to post a story',
      );
    }
    if (here == null) {
      throw const StoryValidationException(
        'Location permission is required to post a story',
      );
    }

    final String imageUrl;
    try {
      imageUrl = await _upload(image).timeout(_uploadTimeout);
    } on TimeoutException {
      throw const StoryValidationException(
        'Upload timed out. Please try again.',
      );
    }
    return _api.createStory(
      title: draft.title.trim(),
      type: draft.type,
      description: draft.description,
      imageUrl: imageUrl,
      lat: here.lat,
      lng: here.lng,
    );
  }
}
