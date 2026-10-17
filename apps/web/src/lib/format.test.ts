import { describe, expect, it } from "vitest";
import {
  codePoints,
  directionsUrl,
  formatFollowers,
  timeAgo,
  truncate,
} from "./format";

describe("timeAgo", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const s = 1000;
  const min = 60 * s;
  const h = 60 * min;
  const d = 24 * h;

  it.each([
    [30 * s, "Just now"],
    [5 * min, "5m"],
    [3 * h, "3h"],
    [2 * d, "2d"],
    [8 * d, "1w"],
    [400 * d, "1y"],
  ])("%d ms ago -> %s", (ms, expected) => {
    expect(timeAgo(ago(ms), now)).toBe(expected);
  });

  it("treats a future timestamp as just now", () => {
    expect(timeAgo(ago(-5 * min), now)).toBe("Just now");
  });
});

describe("formatFollowers", () => {
  it.each([
    [0, "0 followers"],
    [1, "1 follower"],
    [99999, "99999 followers"],
    [150000, "150k followers"],
    [2500000, "2m followers"],
    [3000000000, "3b followers"],
  ])("%d -> %s", (n, expected) => {
    expect(formatFollowers(n)).toBe(expected);
  });
});

describe("directionsUrl", () => {
  it("builds the Google Maps directions link", () => {
    expect(directionsUrl(21.03, 105.85)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=21.03%2C105.85",
    );
  });
});

describe("truncate / codePoints", () => {
  it("cuts to max with an ellipsis", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
  });
  it("leaves short strings unchanged", () => {
    expect(truncate("abc", 4)).toBe("abc");
    expect(truncate("abcd", 4)).toBe("abcd");
  });
  it("does not split surrogate pairs", () => {
    expect(truncate("😀😀😀😀", 3)).toBe("😀😀…");
  });
  it("counts code points", () => {
    expect(codePoints("Hồ😀")).toBe(3);
  });
});
