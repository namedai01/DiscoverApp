import { describe, expect, it } from "vitest";
import { firebaseAuthMessage, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("strips separators and keeps the country code", () => {
    expect(normalizePhone("+84 900-000-001")).toEqual({ phone: "+84900000001" });
    expect(normalizePhone(" +1 (415) 555.0100 ")).toEqual({
      phone: "+14155550100",
    });
  });

  it("asks for the country code", () => {
    const error = "Include the country code, e.g. +84 900 000 001.";
    expect(normalizePhone("0900000001")).toEqual({ error });
    expect(normalizePhone("")).toEqual({ error });
  });

  it("rejects numbers that are not E.164", () => {
    const error = "That phone number isn't valid.";
    expect(normalizePhone("+12")).toEqual({ error });
    expect(normalizePhone("+0900000001")).toEqual({ error });
    expect(normalizePhone("+84abc00000")).toEqual({ error });
    expect(normalizePhone("+1234567890123456")).toEqual({ error });
  });
});

describe("firebaseAuthMessage", () => {
  it.each([
    ["auth/invalid-verification-code", "That code is incorrect."],
    ["auth/code-expired", "That code has expired. Request a new one."],
    [
      "auth/too-many-requests",
      "Too many attempts. Wait a few minutes and try again.",
    ],
    ["auth/invalid-phone-number", "That phone number isn't valid."],
    ["auth/network-request-failed", "Network error. Check your connection."],
    ["auth/whatever", "Sign-in failed. Try again."],
    ["", "Sign-in failed. Try again."],
  ])("%s", (code, message) => {
    expect(firebaseAuthMessage(code)).toBe(message);
  });
});
