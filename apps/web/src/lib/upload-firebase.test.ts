import { beforeEach, describe, expect, it, vi } from "vitest";

const { storage, ref, uploadBytes, getDownloadURL } = vi.hoisted(() => ({
  storage: { name: "storage" },
  ref: vi.fn((_s: unknown, path: string) => ({ path })),
  uploadBytes: vi.fn(async () => ({})),
  getDownloadURL: vi.fn(async () => "https://dl.example.com/x.jpg"),
}));

vi.mock("firebase/storage", () => ({ ref, uploadBytes, getDownloadURL }));
vi.mock("@/lib/firebase", () => ({ getFirebaseStorage: () => storage }));

import { firebaseUploader } from "./upload-firebase";

beforeEach(() => {
  ref.mockClear();
  uploadBytes.mockClear();
  getDownloadURL.mockClear();
});

describe("firebaseUploader", () => {
  it("uploads a JPEG under uploads/{uid}/ and returns its download URL", async () => {
    const image = new Blob(["x"], { type: "image/jpeg" });
    const url = await firebaseUploader("u1", image);

    expect(ref).toHaveBeenCalledWith(
      storage,
      expect.stringMatching(/^uploads\/u1\/[0-9a-f-]{36}\.jpg$/),
    );
    expect(uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/^uploads\/u1\// ) }),
      image,
      { contentType: "image/jpeg" },
    );
    expect(url).toBe("https://dl.example.com/x.jpg");
  });

  it("uses a fresh object name each time", async () => {
    await firebaseUploader("u1", new Blob(["x"]));
    await firebaseUploader("u1", new Blob(["x"]));
    expect(ref.mock.calls[0]?.[1]).not.toBe(ref.mock.calls[1]?.[1]);
  });
});
