import { publicEnv } from "@/lib/env";

// Matches the Storage rule on uploads/{uid}/*.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// What we accept from the picker before shrinking it; phone photos are big.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

// A failure whose message is safe to show to the user as is.
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export function validateImageFile(file: File): string | null {
  // Some browsers leave the type empty for formats they do not know (HEIC);
  // those go on to decoding, which explains the failure. A type that is set
  // and is not an image is a plain wrong file.
  if (file.type && !file.type.startsWith("image/")) {
    return "Choose an image file.";
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return "That photo is too large (max 25 MB).";
  }
  return null;
}

// Re-encodes as a JPEG no wider or taller than maxEdge. Decoding also applies
// the photo's EXIF rotation, and drawing on white replaces PNG transparency
// (a JPEG would turn it black).
export async function toJpeg(
  file: Blob,
  maxEdge = 1600,
  quality = 0.85,
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    // Explicit so the EXIF rotation is applied in every browser.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UploadError(
      "This photo format isn't supported. Choose a JPEG or PNG.",
    );
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new UploadError("Couldn't process that photo.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new UploadError("Couldn't process that photo.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function prepareUpload(file: File): Promise<Blob> {
  const problem = validateImageFile(file);
  if (problem) throw new UploadError(problem);
  const jpeg = await toJpeg(file);
  if (jpeg.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("That photo is too large to upload.");
  }
  return jpeg;
}

// Resolves to the public URL the backend will accept for the photo.
export type ImageUploader = (uid: string, image: Blob) => Promise<string>;

// Dev-only stand-in: no Storage, just a URL of the right shape.
export function fakeUploader(bucket: string): ImageUploader {
  return async (uid) =>
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/uploads%2F${uid}%2F${crypto.randomUUID()}.jpg?alt=media`;
}

// Same guard as loadAuthClient: the NODE_ENV test is replaced at build time,
// so production bundles can never choose the fake uploader.
export async function getUploader(): Promise<ImageUploader> {
  if (process.env.NODE_ENV !== "production" && publicEnv.authMode === "fake") {
    return fakeUploader(publicEnv.firebase.storageBucket);
  }
  const { firebaseUploader } = await import("./upload-firebase");
  return firebaseUploader;
}
