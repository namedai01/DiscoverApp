import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows the public pages and hides the private ones", () => {
    expect(robots().rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/me", "/post", "/signin", "/u/", "/people"],
    });
  });
});
