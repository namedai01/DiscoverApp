// `next` comes from the URL, so it must stay a path on this origin. Browsers
// drop tabs and newlines inside URLs and treat `\` like `/`, so a path
// containing any of those could turn into `//evil.com`.
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return "/";
  return raw;
}
