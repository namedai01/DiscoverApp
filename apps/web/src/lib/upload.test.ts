import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  UploadError,
  fakeUploader,
  prepareUpload,
  toJpeg,
  validateImageFile,
} from "./upload";

const MIB = 1024 * 1024;

function fileOf(type: string, size: number, name = "photo"): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

// jsdom has no canvas or image decoding, so the browser parts are stubbed.
function stubBrowser(opts: {
  width: number;
  height: number;
  jpegBytes: number;
}) {
  const close = vi.fn();
  const createImageBitmap = vi.fn(async () => ({
    width: opts.width,
    height: opts.height,
    close,
  }));
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const ctx = { drawImage, fillRect, fillStyle: "" };
  const canvases: HTMLCanvasElement[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      canvases.push(this);
      return ctx as unknown as CanvasRenderingContext2D;
    },
  );
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((cb) =>
      cb(new Blob([new Uint8Array(opts.jpegBytes)], { type: "image/jpeg" })),
    );
  return { createImageBitmap, close, drawImage, canvases, toBlob };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("validateImageFile", () => {
  it("rejects a non-image", () => {
    expect(validateImageFile(fileOf("text/plain", 10))).toBe(
      "Choose an image file.",
    );
  });

  it("rejects a photo over 25 MiB", () => {
    expect(validateImageFile(fileOf("image/png", 30 * MIB))).toBe(
      "That photo is too large (max 25 MB).",
    );
  });

  it("accepts a normal photo", () => {
    expect(validateImageFile(fileOf("image/jpeg", 1 * MIB))).toBeNull();
  });
});

describe("toJpeg", () => {
  it("downscales so the longest edge is at most maxEdge", async () => {
    const { canvases, toBlob } = stubBrowser({
      width: 4000,
      height: 3000,
      jpegBytes: 100,
    });
    const out = await toJpeg(fileOf("image/jpeg", 1));
    expect(out.type).toBe("image/jpeg");
    expect(canvases[0]?.width).toBe(1600);
    expect(canvases[0]?.height).toBe(1200);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.85);
  });

  it("never upscales a small photo", async () => {
    const { canvases, close } = stubBrowser({
      width: 800,
      height: 600,
      jpegBytes: 100,
    });
    await toJpeg(fileOf("image/png", 1));
    expect(canvases[0]?.width).toBe(800);
    expect(canvases[0]?.height).toBe(600);
    expect(close).toHaveBeenCalled();
  });

  it("explains a format the browser cannot decode", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode failed");
      }),
    );
    await expect(toJpeg(fileOf("image/heic", 1))).rejects.toThrow(
      new UploadError(
        "This photo format isn't supported. Choose a JPEG or PNG.",
      ),
    );
  });

  it("fails clearly when the canvas yields no blob", async () => {
    stubBrowser({ width: 10, height: 10, jpegBytes: 1 });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) =>
      cb(null),
    );
    await expect(toJpeg(fileOf("image/png", 1))).rejects.toBeInstanceOf(
      UploadError,
    );
  });
});

describe("prepareUpload", () => {
  it("rejects a file that fails validation before decoding", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    await expect(prepareUpload(fileOf("text/plain", 1))).rejects.toThrow(
      "Choose an image file.",
    );
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects a result over the 5 MiB storage limit", async () => {
    stubBrowser({ width: 100, height: 100, jpegBytes: 6 * MIB });
    await expect(prepareUpload(fileOf("image/jpeg", 1 * MIB))).rejects.toThrow(
      "That photo is too large to upload.",
    );
  });

  it("returns a JPEG within the limit", async () => {
    stubBrowser({ width: 100, height: 100, jpegBytes: 1000 });
    const out = await prepareUpload(fileOf("image/jpeg", 1 * MIB));
    expect(out.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    expect(out.type).toBe("image/jpeg");
  });
});

describe("fakeUploader", () => {
  it("returns a storage-shaped URL without uploading", async () => {
    const url = await fakeUploader("b")("u1", new Blob(["x"]));
    expect(url).toMatch(
      /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/b\/o\/uploads%2Fu1%2F[0-9a-f-]{36}\.jpg\?alt=media$/,
    );
  });
});
