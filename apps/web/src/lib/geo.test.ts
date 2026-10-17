import { describe, expect, it, vi } from "vitest";
import { GeoError, geoErrorMessage, getCurrentPosition } from "./geo";

function fakeGeo(result: "ok" | 1 | 2 | 3) {
  const getPosition = vi.fn(
    (ok: PositionCallback, fail: PositionErrorCallback) => {
      if (result === "ok") {
        ok({
          coords: { latitude: 21.03, longitude: 105.85 },
        } as GeolocationPosition);
      } else {
        fail({ code: result } as GeolocationPositionError);
      }
    },
  );
  return {
    geo: { getCurrentPosition: getPosition } as unknown as Geolocation,
    getPosition,
  };
}

describe("getCurrentPosition", () => {
  it("resolves with the coordinates", async () => {
    const { geo, getPosition } = fakeGeo("ok");
    await expect(getCurrentPosition(geo, true)).resolves.toEqual({
      lat: 21.03,
      lng: 105.85,
    });
    expect(getPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ] as const)("maps error code %i to %s", async (code, kind) => {
    const { geo } = fakeGeo(code);
    const error = await getCurrentPosition(geo, true).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GeoError);
    expect((error as GeoError).kind).toBe(kind);
  });

  it("is unsupported without a Geolocation API", async () => {
    await expect(getCurrentPosition(undefined, true)).rejects.toMatchObject({
      kind: "unsupported",
    });
  });

  it("is unsupported on an insecure origin without calling the API", async () => {
    const { geo, getPosition } = fakeGeo("ok");
    await expect(getCurrentPosition(geo, false)).rejects.toMatchObject({
      kind: "unsupported",
    });
    expect(getPosition).not.toHaveBeenCalled();
  });
});

describe("geoErrorMessage", () => {
  it("has a specific message per kind", () => {
    expect(geoErrorMessage("denied")).toBe(
      "Location access is blocked. Your story is attached to the nearest place, so allow location for this site in your browser settings and try again.",
    );
    expect(geoErrorMessage("unavailable")).toBe(
      "Couldn't find your location. Check that location services are on, then try again.",
    );
    expect(geoErrorMessage("timeout")).toBe(
      "Finding your location took too long. Try again.",
    );
    expect(geoErrorMessage("unsupported")).toBe(
      "This browser can't share your location, so stories can't be posted from here.",
    );
  });
});
