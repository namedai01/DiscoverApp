import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:memopin/components/net_image.dart';

void main() {
  test('imageOrNull returns null for an empty url', () {
    expect(imageOrNull(''), isNull);
  });

  test('imageOrNull returns a NetworkImage otherwise', () {
    expect(imageOrNull('https://x/y.jpg'), isA<NetworkImage>());
  });
}
