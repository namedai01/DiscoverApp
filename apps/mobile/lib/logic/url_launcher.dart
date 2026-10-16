import 'package:url_launcher/url_launcher.dart';

//Actual Function to launch external links.
Future<void> launchURL(String url) async {
  if (!await launchUrl(Uri.parse(url))) {
    throw 'Could not launch $url';
  }
}
