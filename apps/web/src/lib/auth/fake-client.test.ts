import { describe, expect, it, vi } from "vitest";
import { createFakeAuthClient, validateFakeUid } from "./fake-client";

describe("validateFakeUid", () => {
  it("accepts letters, digits, - and _", () => {
    expect(validateFakeUid("u1")).toBeNull();
    expect(validateFakeUid("A_b-9")).toBeNull();
    expect(validateFakeUid("a".repeat(64))).toBeNull();
  });

  it("rejects everything else with one message", () => {
    const message = "Use 1–64 letters, digits, - or _.";
    expect(validateFakeUid("u 1")).toBe(message);
    expect(validateFakeUid("")).toBe(message);
    expect(validateFakeUid("a".repeat(65))).toBe(message);
    expect(validateFakeUid("u1\n")).toBe(message);
  });
});

describe("createFakeAuthClient", () => {
  it("signs in, hands out the fake token and persists the uid", async () => {
    const client = createFakeAuthClient(localStorage);
    const seen = vi.fn();
    client.subscribe(seen);
    expect(seen).toHaveBeenLastCalledWith(null);

    client.signIn("u1");
    expect(seen).toHaveBeenLastCalledWith({ uid: "u1", phone: null });
    await expect(client.getToken(false)).resolves.toBe("fake:u1:");
    expect(localStorage.getItem("memopin.fakeUid")).toBe("u1");
  });

  it("a new client on the same storage starts signed in", () => {
    createFakeAuthClient(localStorage).signIn("u1");
    const seen = vi.fn();
    createFakeAuthClient(localStorage).subscribe(seen);
    expect(seen).toHaveBeenCalledWith({ uid: "u1", phone: null });
  });

  it("ignores a stored uid that is not valid", () => {
    localStorage.setItem("memopin.fakeUid", "bad uid");
    const seen = vi.fn();
    createFakeAuthClient(localStorage).subscribe(seen);
    expect(seen).toHaveBeenCalledWith(null);
  });

  it("refuses to sign in with an invalid uid", () => {
    const client = createFakeAuthClient(localStorage);
    expect(() => client.signIn("u 1")).toThrow();
    expect(localStorage.getItem("memopin.fakeUid")).toBeNull();
  });

  it("signs out: subscribers hear null, the key is removed, no token", async () => {
    const client = createFakeAuthClient(localStorage);
    client.signIn("u1");
    const seen = vi.fn();
    client.subscribe(seen);
    await client.signOut();
    expect(seen).toHaveBeenLastCalledWith(null);
    expect(localStorage.getItem("memopin.fakeUid")).toBeNull();
    await expect(client.getToken(false)).resolves.toBeNull();
  });

  it("stops notifying after unsubscribe", () => {
    const client = createFakeAuthClient(localStorage);
    const seen = vi.fn();
    const off = client.subscribe(seen);
    off();
    seen.mockClear();
    client.signIn("u1");
    expect(seen).not.toHaveBeenCalled();
  });

  it("falls back to memory when window.localStorage is blocked", async () => {
    const spy = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    try {
      const client = createFakeAuthClient();
      client.signIn("u1");
      await expect(client.getToken(false)).resolves.toBe("fake:u1:");
      await client.signOut();
      await expect(client.getToken(false)).resolves.toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
