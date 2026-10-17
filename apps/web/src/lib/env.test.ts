import { describe, expect, it } from "vitest";
import { firebaseConfigError, missingFirebaseKeys, parsePublicEnv } from "./env";

describe("parsePublicEnv", () => {
  it("defaults", () => {
    const env = parsePublicEnv({}, "development");
    expect(env.apiBaseUrl).toBe("http://localhost:8080");
    expect(env.authMode).toBe("firebase");
    expect(env.map).toEqual({
      tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      initialLat: 21.03,
      initialLng: 105.78,
      initialZoom: 5,
    });
  });

  it("strips trailing slash", () => {
    const env = parsePublicEnv(
      { NEXT_PUBLIC_API_BASE_URL: "https://api.x/" },
      "development",
    );
    expect(env.apiBaseUrl).toBe("https://api.x");
  });

  it("rejects fake in production", () => {
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_AUTH_MODE: "fake" }, "production"),
    ).toThrow(/not allowed in a production build/);
    expect(
      parsePublicEnv({ NEXT_PUBLIC_AUTH_MODE: "fake" }, "development")
        .authMode,
    ).toBe("fake");
  });

  it("rejects unknown mode", () => {
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_AUTH_MODE: "magic" }, "development"),
    ).toThrow(/NEXT_PUBLIC_AUTH_MODE must be fake or firebase/);
  });

  it("falls back on bad map numbers", () => {
    const env = parsePublicEnv(
      { NEXT_PUBLIC_MAP_INITIAL_LAT: "abc" },
      "development",
    );
    expect(env.map.initialLat).toBe(21.03);
  });
});

describe("missingFirebaseKeys", () => {
  it("lists env names of empty fields", () => {
    expect(
      missingFirebaseKeys({
        apiKey: "",
        authDomain: "a",
        projectId: "p",
        storageBucket: "b",
        messagingSenderId: "m",
        appId: "",
      }),
    ).toEqual(["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_APP_ID"]);
  });
});

describe("firebaseConfigError", () => {
  const full = {
    apiKey: "k",
    authDomain: "a",
    projectId: "p",
    storageBucket: "b",
    messagingSenderId: "m",
    appId: "i",
  };

  it("is null when the config is complete", () => {
    expect(firebaseConfigError(full)).toBeNull();
  });

  it("names the missing keys", () => {
    expect(firebaseConfigError({ ...full, apiKey: "", appId: "" })).toBe(
      "Firebase web config is missing NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_APP_ID. See apps/web/.env.example.",
    );
  });
});
