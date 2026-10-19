/// Typed views of the Memopin API's JSON. Each `fromJson` throws a
/// [TypeError] or [FormatException] on a malformed payload; `MemopinApi`
/// turns that into an `ApiException`.
library;

double _double(Object? v) => (v as num).toDouble();
int _int(Object? v) => (v as num).toInt();

class AppUser {
  const AppUser({
    required this.id,
    required this.displayName,
    required this.photoUrl,
    required this.followerCount,
    this.isFollowing,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id'] as String,
    displayName: json['displayName'] as String,
    photoUrl: json['photoUrl'] as String,
    followerCount: _int(json['followerCount']),
    isFollowing: json['isFollowing'] as bool?,
  );

  final String id;
  final String displayName;
  final String photoUrl;
  final int followerCount;

  /// Only present on `GET /v1/users/{id}`; `null` on `/v1/me` and in lists.
  final bool? isFollowing;
}

class Location {
  const Location({
    required this.id,
    required this.venueName,
    required this.venueLocation,
    required this.description,
    required this.imageUrl,
    required this.lat,
    required this.lng,
    required this.storyCount,
  });

  factory Location.fromJson(Map<String, dynamic> json) => Location(
    id: json['id'] as String,
    venueName: json['venueName'] as String,
    venueLocation: json['venueLocation'] as String,
    description: json['description'] as String,
    imageUrl: json['imageUrl'] as String,
    lat: _double(json['lat']),
    lng: _double(json['lng']),
    storyCount: _int(json['storyCount']),
  );

  final String id;
  final String venueName;
  final String venueLocation;
  final String description;
  final String imageUrl;
  final double lat;
  final double lng;
  final int storyCount;
}

class Story {
  const Story({
    required this.id,
    required this.title,
    required this.type,
    required this.description,
    required this.imageUrl,
    required this.createdAt,
    required this.locationId,
    required this.venueName,
    required this.ownerId,
    required this.ownerDisplayName,
    required this.ownerPhotoUrl,
  });

  factory Story.fromJson(Map<String, dynamic> json) {
    final location = json['location'] as Map<String, dynamic>;
    final owner = json['owner'] as Map<String, dynamic>;
    return Story(
      id: json['id'] as String,
      title: json['title'] as String,
      type: json['type'] as String,
      description: json['description'] as String,
      imageUrl: json['imageUrl'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String).toUtc(),
      locationId: location['id'] as String,
      venueName: location['venueName'] as String,
      ownerId: owner['id'] as String,
      ownerDisplayName: owner['displayName'] as String,
      ownerPhotoUrl: owner['photoUrl'] as String,
    );
  }

  final String id;
  final String title;
  final String type;
  final String description;
  final String imageUrl;

  /// Always UTC.
  final DateTime createdAt;
  final String locationId;
  final String venueName;
  final String ownerId;
  final String ownerDisplayName;
  final String ownerPhotoUrl;
}

/// One page of a cursor-paginated list.
class Paged<T> {
  const Paged({required this.items, required this.nextCursor});

  final List<T> items;

  /// Pass to the next call to get the following page; `null` on the last page.
  final String? nextCursor;

  bool get hasMore => nextCursor != null;
}
