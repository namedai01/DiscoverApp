/// Input limits that mirror the backend. Lengths are Unicode code points
/// (`runes`), not UTF-16 units, so emoji and accents count once. Display name
/// and title are counted after `trim()`; type and description as typed.
/// Each validator returns `null` when [v] is valid, otherwise a message.
library;

String? _between(
  String v,
  int min,
  int max,
  String message, {
  bool trim = false,
}) {
  final n = (trim ? v.trim() : v).runes.length;
  return n < min || n > max ? message : null;
}

String? validateDisplayName(String v) =>
    _between(v, 1, 50, 'Display name must be 1 to 50 characters', trim: true);

String? validateStoryTitle(String v) =>
    _between(v, 1, 100, 'Title must be 1 to 100 characters', trim: true);

String? validateStoryType(String v) =>
    _between(v, 0, 50, 'Type must be at most 50 characters');

String? validateStoryDescription(String v) =>
    _between(v, 0, 2000, 'Description must be at most 2000 characters');
