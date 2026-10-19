export type GeoErrorKind = "unsupported" | "denied" | "unavailable" | "timeout";

export class GeoError extends Error {
  readonly kind: GeoErrorKind;

  constructor(kind: GeoErrorKind) {
    super(geoErrorMessage(kind));
    this.name = "GeoError";
    this.kind = kind;
  }
}

const MESSAGES: Record<GeoErrorKind, string> = {
  denied:
    "Location access is blocked. Your story is attached to the nearest place, so allow location for this site in your browser settings and try again.",
  unavailable:
    "Couldn't find your location. Check that location services are on, then try again.",
  timeout: "Finding your location took too long. Try again.",
  unsupported:
    "This browser can't share your location, so stories can't be posted from here.",
};

export function geoErrorMessage(kind: GeoErrorKind): string {
  return MESSAGES[kind];
}

function kindOf(code: number): GeoErrorKind {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

// Geolocation only works on secure origins, so an http:// deployment fails
// here with a clear message instead of a silent browser-side denial.
export function getCurrentPosition(
  geo: Geolocation | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.geolocation,
  secure: boolean = typeof window !== "undefined" && window.isSecureContext,
): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!geo || !secure) {
      reject(new GeoError("unsupported"));
      return;
    }
    geo.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new GeoError(kindOf(e.code))),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  });
}
