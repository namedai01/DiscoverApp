"use client";

import { useRef, useState } from "react";
import { useApi } from "@/lib/api/context";

export function FollowButton({
  userId,
  isFollowing,
  onChange,
}: {
  userId: string;
  isFollowing: boolean;
  onChange: (next: boolean) => void;
}) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // State updates are async; the ref makes a fast double click a no-op.
  const inFlight = useRef(false);

  async function toggle() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    const next = !isFollowing;
    try {
      await (next ? api.follow(userId) : api.unfollow(userId));
    } catch {
      inFlight.current = false;
      setBusy(false);
      setFailed(true);
      return;
    }
    inFlight.current = false;
    setBusy(false);
    onChange(next);
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={
          isFollowing
            ? "rounded-lg border border-neutral-300 px-4 py-2 font-medium disabled:opacity-60"
            : "rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900 disabled:opacity-60"
        }
      >
        {isFollowing ? "Unfollow" : "Follow"}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          Couldn&apos;t update follow. Try again.
        </p>
      )}
    </div>
  );
}
