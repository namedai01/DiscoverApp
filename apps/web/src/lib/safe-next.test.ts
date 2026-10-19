import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps a same-origin path with its query", () => {
    expect(safeNext("/u/abc?x=1")).toBe("/u/abc?x=1");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "evil.com",
    "",
    "   ",
  ])("falls back to / for %j", (raw) => {
    expect(safeNext(raw)).toBe("/");
  });

  it("falls back to / when missing", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
