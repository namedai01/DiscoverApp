const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Same thresholds as the mobile app's getFormattedTimeDistanceToCurrent.
export function timeAgo(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  const days = Math.floor(elapsed / DAY);
  if (days >= 365) return `${Math.floor(days / 365)}y`;
  if (days >= 7) return `${Math.floor(days / 7)}w`;
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(elapsed / HOUR);
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.floor(elapsed / MINUTE);
  if (minutes >= 1) return `${minutes}m`;
  return "Just now";
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000_000) return `${Math.floor(n / 1_000_000_000)}b followers`;
  if (n >= 1_000_000) return `${Math.floor(n / 1_000_000)}m followers`;
  if (n >= 100_000) return `${Math.floor(n / 1000)}k followers`;
  return n === 1 ? "1 follower" : `${n} followers`;
}

export function directionsUrl(lat: number, lng: number): string {
  const destination = encodeURIComponent(`${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

export function codePoints(s: string): number {
  return [...s].length;
}

// Cuts to `max` code points including the ellipsis.
export function truncate(s: string, max: number): string {
  const chars = [...s];
  if (chars.length <= max) return s;
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}
