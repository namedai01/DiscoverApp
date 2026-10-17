import 'package:intl/intl.dart';

/// Short "how long ago" label. [now] is injectable for tests; a [time] in the
/// future (clock skew) reads as "Just now".
String getFormattedTimeDistanceToCurrent(DateTime time, {DateTime? now}) {
  final duration = (now ?? DateTime.now()).difference(time);
  final numDays = duration.inDays;
  if (numDays >= 365) {
    return '${numDays ~/ 365}y';
  } else if (numDays >= 7) {
    return '${numDays ~/ 7}w';
  } else if (numDays >= 1) {
    return '${numDays}d';
  } else if (duration.inHours >= 1) {
    return '${duration.inHours}h';
  } else if (duration.inMinutes >= 1) {
    return '${duration.inMinutes}m';
  } else {
    return 'Just now';
  }
}

String getFormattedTimeStamp(DateTime time) {
  return DateFormat('MM/dd/yyyy hh:mma').format(time.toLocal());
}

String formatFollower(int follower) {
  int oneBillion = 1000000000;
  int oneMillion = 1000000;
  int oneKilo = 1000;
  if (follower > oneBillion) {
    return '${follower ~/ oneBillion}b followers';
  } else if (follower > oneMillion) {
    return '${follower ~/ oneMillion}m followers';
  } else if (follower > 100 * oneKilo) {
    return '${follower ~/ oneKilo}k followers';
  } else if (follower > 1) {
    return '${follower.toString()} followers';
  } else
    return '${follower.toString()} follower';
}
