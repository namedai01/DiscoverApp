import 'package:flutter_test/flutter_test.dart';
import 'package:memopin/api/models.dart';

void main() {
  test('Location.fromJson parses all fields and integer lat/lng', () {
    final loc = Location.fromJson({
      'id': 'l1',
      'venueName': 'Hồ Gươm',
      'venueLocation': 'Hà Nội',
      'description': 'A lake',
      'imageUrl': 'https://x/y.jpg',
      'lat': 21,
      'lng': 105.85,
      'storyCount': 3,
    });
    expect(loc.id, 'l1');
    expect(loc.venueName, 'Hồ Gươm');
    expect(loc.venueLocation, 'Hà Nội');
    expect(loc.description, 'A lake');
    expect(loc.imageUrl, 'https://x/y.jpg');
    expect(loc.lat, 21.0);
    expect(loc.lat, isA<double>());
    expect(loc.lng, 105.85);
    expect(loc.storyCount, 3);
  });

  test('Story.fromJson parses nested owner and location', () {
    final s = Story.fromJson({
      'id': 's1',
      'title': 'T',
      'type': 'food',
      'description': 'D',
      'imageUrl': 'https://x/s.jpg',
      'createdAt': '2026-10-17T03:04:05.123456789Z',
      'location': {'id': 'l1', 'venueName': 'Hồ Gươm'},
      'owner': {'id': 'u1', 'displayName': 'An', 'photoUrl': 'https://x/a.jpg'},
    });
    expect(s.id, 's1');
    expect(s.title, 'T');
    expect(s.type, 'food');
    expect(s.description, 'D');
    expect(s.imageUrl, 'https://x/s.jpg');
    expect(s.locationId, 'l1');
    expect(s.venueName, 'Hồ Gươm');
    expect(s.ownerId, 'u1');
    expect(s.ownerDisplayName, 'An');
    expect(s.ownerPhotoUrl, 'https://x/a.jpg');
    expect(s.createdAt.isUtc, isTrue);
    expect(s.createdAt.millisecond, 123);
    expect(s.createdAt.microsecond, 456);
  });

  test('AppUser.fromJson isFollowing absent -> null, true -> true', () {
    final base = {
      'id': 'u1',
      'displayName': 'An',
      'photoUrl': 'https://x/a.jpg',
      'followerCount': 2,
    };
    final a = AppUser.fromJson(base);
    expect(a.followerCount, 2);
    expect(a.isFollowing, isNull);
    expect(AppUser.fromJson({...base, 'isFollowing': true}).isFollowing, true);
    expect(
      AppUser.fromJson({...base, 'isFollowing': false}).isFollowing,
      false,
    );
  });

  test('Paged nextCursor null -> hasMore false', () {
    expect(const Paged<int>(items: [1], nextCursor: null).hasMore, isFalse);
    expect(const Paged<int>(items: [1], nextCursor: 'c').hasMore, isTrue);
  });
}
