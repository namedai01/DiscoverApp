export type AccentName = "Yellow" | "Red" | "Blue" | "Green" | "Pink";

export const ACCENTS: Record<AccentName, string> = {
  Yellow: "#EAC21E",
  Red: "#ff3f20",
  Blue: "#00aeff",
  Green: "#00d000",
  Pink: "#ff00a8",
};

const STORAGE_KEY = "memopin.accent";
const DEFAULT_ACCENT: AccentName = "Yellow";

function isAccentName(value: string | null): value is AccentName {
  return value !== null && Object.hasOwn(ACCENTS, value);
}

export function loadAccent(): AccentName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isAccentName(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function applyAccent(name: AccentName): void {
  document.documentElement.style.setProperty("--accent", ACCENTS[name]);
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Storage unavailable (private mode, blocked): the accent still applies
    // for this page view.
  }
}
