export type AuthMode = "fake" | "firebase";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export type PublicEnv = {
  apiBaseUrl: string;
  siteUrl: string;
  authMode: AuthMode;
  firebase: FirebaseWebConfig;
  map: {
    tileUrl: string;
    attribution: string;
    initialLat: number;
    initialLng: number;
    initialZoom: number;
  };
};

type Raw = Record<string, string | undefined>;

const FIREBASE_KEYS: Record<keyof FirebaseWebConfig, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

function text(raw: Raw, key: string, fallback: string): string {
  const value = raw[key]?.trim();
  return value ? value : fallback;
}

function num(raw: Raw, key: string, fallback: number): number {
  const value = raw[key]?.trim();
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parsePublicEnv(
  raw: Raw,
  nodeEnv: string | undefined,
): PublicEnv {
  const mode = text(raw, "NEXT_PUBLIC_AUTH_MODE", "firebase");
  if (mode !== "fake" && mode !== "firebase") {
    throw new Error("NEXT_PUBLIC_AUTH_MODE must be fake or firebase");
  }
  if (mode === "fake" && nodeEnv === "production") {
    throw new Error(
      "NEXT_PUBLIC_AUTH_MODE=fake is not allowed in a production build",
    );
  }

  return {
    apiBaseUrl: text(
      raw,
      "NEXT_PUBLIC_API_BASE_URL",
      "http://localhost:8080",
    ).replace(/\/+$/, ""),
    siteUrl: text(raw, "NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
    authMode: mode,
    firebase: {
      apiKey: text(raw, FIREBASE_KEYS.apiKey, ""),
      authDomain: text(raw, FIREBASE_KEYS.authDomain, ""),
      projectId: text(raw, FIREBASE_KEYS.projectId, ""),
      storageBucket: text(raw, FIREBASE_KEYS.storageBucket, ""),
      messagingSenderId: text(raw, FIREBASE_KEYS.messagingSenderId, ""),
      appId: text(raw, FIREBASE_KEYS.appId, ""),
    },
    map: {
      tileUrl: text(
        raw,
        "NEXT_PUBLIC_MAP_TILE_URL",
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ),
      attribution: text(
        raw,
        "NEXT_PUBLIC_MAP_ATTRIBUTION",
        // Leaflet renders this as HTML; OSM's tile policy asks for the link.
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      ),
      initialLat: num(raw, "NEXT_PUBLIC_MAP_INITIAL_LAT", 21.03),
      initialLng: num(raw, "NEXT_PUBLIC_MAP_INITIAL_LNG", 105.78),
      initialZoom: num(raw, "NEXT_PUBLIC_MAP_INITIAL_ZOOM", 5),
    },
  };
}

export function missingFirebaseKeys(cfg: FirebaseWebConfig): string[] {
  return (Object.keys(FIREBASE_KEYS) as (keyof FirebaseWebConfig)[])
    .filter((field) => !cfg[field])
    .map((field) => FIREBASE_KEYS[field]);
}

export function firebaseConfigError(cfg: FirebaseWebConfig): string | null {
  const missing = missingFirebaseKeys(cfg);
  return missing.length > 0
    ? `Firebase web config is missing ${missing.join(", ")}. See apps/web/.env.example.`
    : null;
}

// Next inlines NEXT_PUBLIC_* only on literal `process.env.NEXT_PUBLIC_X`
// access, so every key is spelled out here and nowhere else.
export const publicEnv: PublicEnv = parsePublicEnv(
  {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL,
    NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
    NEXT_PUBLIC_MAP_INITIAL_LAT: process.env.NEXT_PUBLIC_MAP_INITIAL_LAT,
    NEXT_PUBLIC_MAP_INITIAL_LNG: process.env.NEXT_PUBLIC_MAP_INITIAL_LNG,
    NEXT_PUBLIC_MAP_INITIAL_ZOOM: process.env.NEXT_PUBLIC_MAP_INITIAL_ZOOM,
  },
  process.env.NODE_ENV,
);
