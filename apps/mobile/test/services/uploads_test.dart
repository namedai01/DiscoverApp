import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:memopin/services/uploads.dart';

void main() {
  test('newUploadPath is uploads/<uid>/<20 alphanumerics>.jpg', () {
    expect(
      newUploadPath('u1'),
      matches(RegExp(r'^uploads/u1/[A-Za-z0-9]{20}\.jpg$')),
    );
  });

  test('two calls differ', () {
    expect(newUploadPath('u1'), isNot(newUploadPath('u1')));
  });

  test('is deterministic for a seeded Random', () {
    expect(
      newUploadPath('u1', random: Random(1)),
      newUploadPath('u1', random: Random(1)),
    );
  });
}
