"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApi } from "@/lib/api/context";
import { isApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/context";
import { codePoints } from "@/lib/format";
import { GeoError, getCurrentPosition } from "@/lib/geo";
import {
  UploadError,
  getUploader,
  prepareUpload,
  validateImageFile,
} from "@/lib/upload";
import { RemoteImage } from "./RemoteImage";

const PHOTO_ERROR = "Couldn't upload the photo. Try again.";
const NO_PLACES = "There are no places yet to attach your story to.";

type Step = "preparing" | "locating" | "uploading" | "posting";

const STEP_TEXT: Record<Step, string> = {
  preparing: "Preparing photo…",
  locating: "Finding your location…",
  uploading: "Uploading photo…",
  posting: "Posting…",
};

function validate(file: File | null, title: string, type: string, description: string) {
  if (!file) return "Choose a photo.";
  const length = codePoints(title);
  if (length === 0) return "Add a title.";
  if (length > 100) return "Title must be 1 to 100 characters.";
  if (codePoints(type) > 50) return "Type must be at most 50 characters.";
  if (codePoints(description) > 2000) {
    return "Description must be at most 2000 characters.";
  }
  return null;
}

function messageOf(e: unknown): string {
  if (e instanceof GeoError || e instanceof UploadError) return e.message;
  if (isApiError(e, "unprocessable")) return NO_PLACES;
  if (isApiError(e)) return e.message;
  return "Something went wrong. Try again.";
}

const inputClass = "w-full rounded-lg border border-neutral-300 px-3 py-2";

export function CreateStoryForm() {
  const api = useApi();
  const router = useRouter();
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  // State updates are async; the ref makes a fast double click a no-op.
  const busyRef = useRef(false);
  // The photo already uploaded, so a retry after a failed post doesn't leave
  // another orphan in Storage.
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  // The decoded JPEG, so a retry after a denied location doesn't decode again.
  const prepared = useRef<{ file: File; image: Blob } | null>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function choosePhoto(chosen: File | undefined) {
    if (!chosen) return;
    const problem = validateImageFile(chosen);
    if (problem) {
      setError(problem);
      return;
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(chosen);
    previewRef.current = url;
    setPreviewUrl(url);
    setFile(chosen);
    setError(null);
  }

  // Validates, decodes and shrinks the photo. Needs no network, so it runs
  // before the location prompt; the result is kept for a retry.
  async function preparePhoto(photo: File): Promise<Blob> {
    const cached = prepared.current;
    if (cached && cached.file === photo) return cached.image;
    const image = await prepareUpload(photo);
    prepared.current = { file: photo, image };
    return image;
  }

  async function uploadPhoto(photo: File, image: Blob, uid: string): Promise<string> {
    const cached = uploaded.current;
    if (cached && cached.file === photo) return cached.url;
    let url: string;
    try {
      const upload = await getUploader();
      url = await upload(uid, image);
    } catch {
      throw new UploadError(PHOTO_ERROR);
    }
    uploaded.current = { file: photo, url };
    return url;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busyRef.current || !user) return;
    // NFC first: the backend counts code points, and decomposed text (e.g.
    // pasted from macOS) is longer than the same text composed.
    const fields = {
      title: title.normalize("NFC").trim(),
      type: type.normalize("NFC"),
      description: description.normalize("NFC"),
    };
    const problem = validate(file, fields.title, fields.type, fields.description);
    if (problem || !file) {
      setError(problem);
      return;
    }
    busyRef.current = true;
    setError(null);
    try {
      // Decode first (no network, and a bad photo shouldn't ask for location),
      // then locate, and only then upload: a location denial must not leave an
      // uploaded photo behind.
      setStep("preparing");
      const image = await preparePhoto(file);
      setStep("locating");
      const { lat, lng } = await getCurrentPosition();
      setStep("uploading");
      const imageUrl = await uploadPhoto(file, image, user.uid);
      setStep("posting");
      const story = await api.createStory({
        ...fields,
        imageUrl,
        lat,
        lng,
      });
      // Stays busy on success so nothing can post twice while navigating.
      router.push(`/places/${encodeURIComponent(story.location.id)}?posted=1`);
    } catch (err) {
      setError(messageOf(err));
      busyRef.current = false;
      setStep(null);
    }
  }

  const busy = step !== null;

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
      <h1 className="text-2xl font-semibold">Post a story</h1>
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="story-photo">
            Photo
          </label>
          <input
            id="story-photo"
            type="file"
            accept="image/*"
            onChange={(e) => choosePhoto(e.currentTarget.files?.[0])}
          />
          {previewUrl && (
            <RemoteImage
              src={previewUrl}
              alt="Selected photo"
              className="max-h-64 rounded-lg object-cover"
            />
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="story-title">
            Title
          </label>
          <input
            id="story-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="story-type">
            Type
          </label>
          <input
            id="story-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="story-description">
            Description
          </label>
          <textarea
            id="story-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
      </fieldset>
      <p className="text-sm text-neutral-600">
        Your story is attached to the nearest place to where you are now.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900 disabled:opacity-60"
      >
        Post story
      </button>
      {step && (
        <p role="status" className="text-sm text-neutral-600">
          {STEP_TEXT[step]}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
