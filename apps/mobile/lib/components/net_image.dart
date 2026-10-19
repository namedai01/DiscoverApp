import 'package:flutter/painting.dart';

/// The image for an API image URL, or `null` when the URL is empty (the API
/// uses `''` for "no image"). Show a grey background when this is `null`.
ImageProvider? imageOrNull(String url) =>
    url.isEmpty ? null : NetworkImage(url);
