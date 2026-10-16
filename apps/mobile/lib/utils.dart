import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:path/path.dart';

String getFormattedTimeDistanceToCurrent(Timestamp timestamp) {
  Duration duration = DateTime.now().difference(timestamp.toDate());
  int numDays = duration.inDays;
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

String getFormattedTimeStamp(Timestamp timestamp) {
  DateTime dateTime = timestamp.toDate();
  return DateFormat('MM/dd/yyyy hh:mma').format(dateTime);
}

String extractBasename(String path) {
  return basename(path);
}

String unionName(String filename) {
  return '${basenameWithoutExtension(filename)}_${Timestamp.fromDate(DateTime.now()).toString()}.${extension(filename)}';
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
