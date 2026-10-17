import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAccent, loadAccent } from "./accent";

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty("--accent");
});

describe("accent", () => {
  it("defaults to Yellow when nothing is stored", () => {
    expect(loadAccent()).toBe("Yellow");
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem("memopin.accent", "Purple");
    expect(loadAccent()).toBe("Yellow");
  });

  it("applyAccent sets the CSS variable and stores the name", () => {
    applyAccent("Blue");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      "#00aeff",
    );
    expect(localStorage.getItem("memopin.accent")).toBe("Blue");
    expect(loadAccent()).toBe("Blue");
  });

  it("survives a throwing localStorage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadAccent()).toBe("Yellow");
    expect(() => applyAccent("Red")).not.toThrow();
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      "#ff3f20",
    );
  });
});
