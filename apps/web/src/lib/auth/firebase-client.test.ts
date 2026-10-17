import { beforeEach, describe, expect, it, vi } from "vitest";

const verifiers: { el: HTMLElement; clear: ReturnType<typeof vi.fn> }[] = [];
const signInWithPhoneNumber = vi.fn();

vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  signInWithPhoneNumber: (...a: unknown[]) => signInWithPhoneNumber(...a),
  // Mimics @firebase/auth: rendering twice into one element throws.
  RecaptchaVerifier: class {
    clear = vi.fn();
    constructor(_auth: unknown, el: HTMLElement) {
      if (el.dataset.rendered) {
        throw new Error("reCAPTCHA has already been rendered in this element");
      }
      el.dataset.rendered = "1";
      verifiers.push({ el, clear: this.clear });
    }
  },
}));
vi.mock("@/lib/firebase", () => ({ getFirebaseApp: () => ({}) }));

import { createFirebaseAuthClient } from "./firebase-client";

beforeEach(() => {
  verifiers.length = 0;
  signInWithPhoneNumber.mockReset();
});

describe("createFirebaseAuthClient phone auth", () => {
  it("renders every send into a fresh, empty element", async () => {
    signInWithPhoneNumber.mockRejectedValueOnce({ code: "auth/too-many-requests" });
    signInWithPhoneNumber.mockResolvedValueOnce({ confirm: vi.fn() });
    const { phone } = createFirebaseAuthClient();
    const container = document.createElement("div");

    await expect(phone.sendCode("+84900000001", container)).rejects.toBeDefined();
    await phone.sendCode("+84900000001", container);

    expect(verifiers).toHaveLength(2);
    expect(verifiers[0]!.el).not.toBe(verifiers[1]!.el);
    expect(verifiers[0]!.el).not.toBe(container);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(verifiers[1]!.el);
  });

  it("clears the verifier and the container after a failed send", async () => {
    signInWithPhoneNumber.mockRejectedValueOnce({ code: "auth/network-request-failed" });
    const { phone } = createFirebaseAuthClient();
    const container = document.createElement("div");
    await expect(phone.sendCode("+84900000001", container)).rejects.toBeDefined();
    expect(verifiers[0]!.clear).toHaveBeenCalledTimes(1);
    expect(container.children).toHaveLength(0);
  });

  it("clears the verifier and the container on reset, so the next send works", async () => {
    signInWithPhoneNumber.mockResolvedValue({ confirm: vi.fn() });
    const { phone } = createFirebaseAuthClient();
    const container = document.createElement("div");
    await phone.sendCode("+84900000001", container);
    phone.reset();
    expect(verifiers[0]!.clear).toHaveBeenCalledTimes(1);
    expect(container.children).toHaveLength(0);
    await expect(phone.sendCode("+84900000001", container)).resolves.toBeUndefined();
  });

  it("passes the invisible verifier to signInWithPhoneNumber", async () => {
    signInWithPhoneNumber.mockResolvedValue({ confirm: vi.fn() });
    const { phone } = createFirebaseAuthClient();
    await phone.sendCode("+84900000001", document.createElement("div"));
    expect(signInWithPhoneNumber).toHaveBeenCalledWith(
      expect.anything(),
      "+84900000001",
      expect.objectContaining({ clear: verifiers[0]!.clear }),
    );
  });
});
