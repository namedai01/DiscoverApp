import 'package:flutter_test/flutter_test.dart';
import 'package:memopin/logic/validators.dart';

void main() {
  group('validateDisplayName', () {
    test('trims before counting', () {
      expect(validateDisplayName('  An  '), isNull);
    });
    test('rejects empty and blank', () {
      expect(validateDisplayName(''), 'Display name must be 1 to 50 characters');
      expect(validateDisplayName('   '), isNotNull);
    });
    test('counts code points, not bytes', () {
      expect(validateDisplayName('a' * 50), isNull);
      expect(validateDisplayName('a' * 51), isNotNull);
      expect(validateDisplayName('é' * 50), isNull);
      expect(validateDisplayName('é' * 51), isNotNull);
    });
  });

  group('validateStoryTitle', () {
    test('1..100 code points after trim', () {
      expect(validateStoryTitle(''), 'Title must be 1 to 100 characters');
      expect(validateStoryTitle('   '), isNotNull);
      expect(validateStoryTitle('é' * 100), isNull);
      expect(validateStoryTitle('é' * 101), isNotNull);
    });
  });

  group('validateStoryType', () {
    test('at most 50, may be empty', () {
      expect(validateStoryType(''), isNull);
      expect(validateStoryType('a' * 50), isNull);
      expect(
        validateStoryType('a' * 51),
        'Type must be at most 50 characters',
      );
    });
  });

  group('validateStoryDescription', () {
    test('at most 2000, may be empty', () {
      expect(validateStoryDescription(''), isNull);
      expect(validateStoryDescription('a' * 2000), isNull);
      expect(
        validateStoryDescription('a' * 2001),
        'Description must be at most 2000 characters',
      );
    });
  });
}
