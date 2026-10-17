"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useApi } from "@/lib/api/context";
import { isApiError } from "@/lib/api/errors";
import type { User } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { codePoints, formatFollowers } from "@/lib/format";
import { UploadError, getUploader, prepareUpload } from "@/lib/upload";
import { AccentPicker } from "./AccentPicker";
import { Avatar } from "./Avatar";
import { UserTimeline } from "./UserTimeline";

const NAME_ERROR = "Display name must be 1 to 50 characters.";
const PHOTO_ERROR = "Couldn't upload the photo. Try again.";

function messageOf(e: unknown): string {
  return isApiError(e) ? e.message : "Something went wrong. Try again.";
}

export function MyProfile() {
  const api = useApi();
  const router = useRouter();
  const { user: authUser, signOut } = useAuth();
  const [me, setMe] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadKey, setLoadKey] = useState(0);

  // getMe creates the profile on first call, so this is also sign-up.
  useEffect(() => {
    let cancelled = false;
    api.getMe().then(
      (u) => {
        if (!cancelled) setMe(u);
      },
      (e: unknown) => {
        if (!cancelled) setLoadError(e);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api, loadKey]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  // State updates are async; the refs make a fast double click a no-op.
  const savingNameRef = useRef(false);

  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);

  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);

  const retry = useCallback(() => {
    setLoadError(null);
    setLoadKey((k) => k + 1);
  }, []);

  if (loadError !== null && !me) {
    return (
      <div role="alert" className="space-y-3 py-8 text-center">
        <p className="text-lg font-medium">{messageOf(loadError)}</p>
        <button
          type="button"
          onClick={retry}
          className="rounded-lg border border-neutral-300 px-4 py-2"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!me) {
    return (
      <p role="status" className="py-8 text-center text-neutral-600">
        Loading…
      </p>
    );
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (savingNameRef.current) return;
    const name = draft.trim();
    const length = codePoints(name);
    if (length < 1 || length > 50) {
      setNameError(NAME_ERROR);
      return;
    }
    savingNameRef.current = true;
    setSavingName(true);
    setNameError(null);
    try {
      setMe(await api.updateMe({ displayName: name }));
      setEditing(false);
    } catch (err) {
      setNameError(messageOf(err));
    } finally {
      savingNameRef.current = false;
      setSavingName(false);
    }
  }

  async function choosePhoto(input: HTMLInputElement) {
    const file = input.files?.[0];
    // Lets the same file be chosen again after a failure.
    input.value = "";
    if (!file || !authUser || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setPhotoError(null);
    try {
      let image: Blob;
      try {
        image = await prepareUpload(file);
      } catch (err) {
        setPhotoError(err instanceof UploadError ? err.message : PHOTO_ERROR);
        return;
      }
      try {
        const upload = await getUploader();
        const photoUrl = await upload(authUser.uid, image);
        setMe(await api.updateMe({ photoUrl }));
      } catch {
        setPhotoError(PHOTO_ERROR);
      }
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }

  async function onSignOut() {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    await signOut();
    router.push("/");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar src={me.photoUrl} name={me.displayName} size="lg" />
          <div className="min-w-0 flex-1">
            {editing ? (
              <form onSubmit={saveName} className="space-y-2" noValidate>
                <label className="block text-sm font-medium" htmlFor="display-name">
                  Display name
                </label>
                <input
                  id="display-name"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingName}
                    className="rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={savingName}
                    onClick={() => {
                      setEditing(false);
                      setNameError(null);
                    }}
                    className="rounded-lg border border-neutral-300 px-4 py-2 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
                {nameError && (
                  <p role="alert" className="text-sm text-red-700">
                    {nameError}
                  </p>
                )}
              </form>
            ) : (
              <>
                <h1 className="truncate text-2xl font-semibold">
                  {me.displayName}
                </h1>
                <p className="text-neutral-600">
                  {formatFollowers(me.followerCount)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(me.displayName);
                    setNameError(null);
                    setEditing(true);
                  }}
                  className="mt-1 font-medium underline"
                >
                  Edit name
                </button>
              </>
            )}
          </div>
        </div>
        <div>
          <label className="inline-block cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 font-medium has-[:disabled]:cursor-default has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
            {uploading ? "Uploading…" : "Change photo"}
            <input
              type="file"
              accept="image/*"
              aria-label="Change photo"
              disabled={uploading}
              onChange={(e) => void choosePhoto(e.currentTarget)}
              className="sr-only"
            />
          </label>
          {photoError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {photoError}
            </p>
          )}
        </div>
      </header>

      <AccentPicker />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My stories</h2>
        <UserTimeline userId={me.id} ownerName={me.displayName} refreshKey={0} />
      </section>

      <button
        type="button"
        onClick={() => void onSignOut()}
        disabled={signingOut}
        className="rounded-lg border border-neutral-300 px-4 py-2 font-medium disabled:opacity-60"
      >
        Sign out
      </button>
    </div>
  );
}
