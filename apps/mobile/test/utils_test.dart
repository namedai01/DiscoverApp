import 'package:flutter_test/flutter_test.dart';
import 'package:memopin/utils.dart';

void main() {
  final now = DateTime.utc(2026, 10, 17, 12);

  String distance(Duration ago) =>
      getFormattedTimeDistanceToCurrent(now.subtract(ago), now: now);

  test('formats the distance to now', () {
    expect(distance(const Duration(seconds: 30)), 'Just now');
    expect(distance(const Duration(minutes: 5)), '5m');
    expect(distance(const Duration(hours: 3)), '3h');
    expect(distance(const Duration(days: 2)), '2d');
    expect(distance(const Duration(days: 14)), '2w');
    expect(distance(const Duration(days: 400)), '1y');
  });

  test('future timestamp (clock skew) is Just now', () {
    expect(
      getFormattedTimeDistanceToCurrent(
        now.add(const Duration(minutes: 3)),
        now: now,
      ),
      'Just now',
    );
    expect(
      getFormattedTimeDistanceToCurrent(
        now.add(const Duration(days: 3)),
        now: now,
      ),
      'Just now',
    );
  });

  test('time stamp is shown in local time', () {
    final local = DateTime(2026, 10, 17, 15, 30);
    expect(getFormattedTimeStamp(local.toUtc()), '10/17/2026 03:30PM');
  });
}
