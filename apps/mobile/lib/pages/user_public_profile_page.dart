import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:memopin/api/api_client.dart';
import 'package:memopin/api/models.dart';
import 'package:memopin/components/net_image.dart';
import 'package:memopin/pages/user_stories_timeline.dart';
import 'package:memopin/services/services.dart';
import 'package:memopin/utils.dart';

class UserPublicProfilePage extends StatefulWidget {
  final AppUser user;

  const UserPublicProfilePage({super.key, required this.user});

  @override
  State<UserPublicProfilePage> createState() => _UserPublicProfilePageState();
}

class _UserPublicProfilePageState extends State<UserPublicProfilePage> {
  // Starts as the user passed in; replaced by GET /v1/users/{id}, which
  // carries the current follower count and `isFollowing`.
  late AppUser _user;
  bool _busy = false;
  Key _timelineKey = UniqueKey();

  String get _currentUid => FirebaseAuth.instance.currentUser?.uid ?? '';
  bool get _isMe => _user.id == _currentUid;
  bool get _canSeeStories => _isMe || _user.isFollowing == true;

  @override
  void initState() {
    super.initState();
    _user = widget.user;
    _load();
  }

  Future<void> _load() async {
    try {
      final fresh = await api.getUser(widget.user.id);
      if (!mounted) return;
      setState(() {
        _user = fresh;
        _timelineKey = UniqueKey();
      });
    } catch (e) {
      if (!mounted) return;
      _showError(e, retry: _load);
    }
  }

  void _showError(Object e, {VoidCallback? retry}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          e is ApiException
              ? e.userMessage
              : 'Something went wrong. Please try again.',
        ),
        action: retry == null
            ? null
            : SnackBarAction(label: 'Retry', onPressed: retry),
      ),
    );
  }

  Future<void> _toggleFollow() async {
    if (_busy) return;
    final following = _user.isFollowing == true;
    setState(() => _busy = true);
    try {
      if (following) {
        await api.unfollow(_user.id);
      } else {
        await api.follow(_user.id);
      }
      final fresh = await api.getUser(_user.id);
      if (!mounted) return;
      setState(() {
        _user = fresh;
        _timelineKey = UniqueKey();
      });
    } catch (e) {
      if (mounted) _showError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _followButton() {
    final following = _user.isFollowing == true;
    return ElevatedButton(
      style: following
          ? ButtonStyle(
              backgroundColor: WidgetStateProperty.all<Color>(Colors.white10),
            )
          : null,
      // Disabled while a request is in flight or until we know the state.
      onPressed: _busy || _user.isFollowing == null ? null : _toggleFollow,
      child: Text(following ? 'Unfollow' : 'Follow'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final image = imageOrNull(_user.photoUrl);
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.only(top: 50),
        child: Stack(
          alignment: AlignmentDirectional.topCenter,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(0, 50, 0, 0),
              child: Column(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.grey[300],
                    ),
                    height: 150,
                    width: 150,
                    child: Hero(
                      tag: 'HeroTag ${_user.id}',
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          image: image == null
                              ? null
                              : DecorationImage(
                                  image: image,
                                  fit: BoxFit.contain,
                                ),
                        ),
                      ),
                    ),
                  ),
                  Center(child: Text(_user.displayName)),
                  _isMe
                      ? Center(child: Text(formatFollower(_user.followerCount)))
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(formatFollower(_user.followerCount)),
                            SizedBox(width: 20),
                            _followButton(),
                          ],
                        ),
                  SizedBox(height: 20),
                  Divider(thickness: 2),
                  _canSeeStories
                      ? Expanded(
                          child: UserStoriesTimeLine(
                            key: _timelineKey,
                            uid: _user.id,
                          ),
                        )
                      : Container(
                          margin: EdgeInsets.all(50),
                          child: Center(
                            child: Text(
                              "Please follow me to sightsee !!!",
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                ],
              ),
            ),
            Container(
              //This is Back Arrow to Navigate Back.
              alignment: Alignment.topLeft,
              child: IconButton(
                icon: Icon(Icons.arrow_back),
                iconSize: 30,
                padding: EdgeInsets.all(0),
                onPressed: () {
                  Navigator.pop(context);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
