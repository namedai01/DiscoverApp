"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import type { Story } from "@/lib/api/types";
import { timeAgo } from "@/lib/format";
import { Avatar } from "./Avatar";
import { RemoteImage } from "./RemoteImage";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function StoryDialog({
  story,
  onClose,
}: {
  story: Story;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLElement>("button")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      // Keep Tab inside the dialog.
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <div
      data-testid="dialog-backdrop"
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <RemoteImage
          src={story.imageUrl}
          alt={story.title}
          className="aspect-[4/3] w-full object-cover"
        />
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-xl font-semibold">
              {story.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-sm"
            >
              Close
            </button>
          </div>
          {story.type && (
            <p className="inline-block rounded-full bg-accent px-3 py-0.5 text-sm text-neutral-900">
              {story.type}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <Link
              href={`/u/${encodeURIComponent(story.owner.id)}`}
              className="flex items-center gap-2 font-medium text-neutral-900 hover:underline"
            >
              <Avatar
                src={story.owner.photoUrl}
                name={story.owner.displayName}
                size="sm"
              />
              {story.owner.displayName}
            </Link>
            <time dateTime={story.createdAt} suppressHydrationWarning>
              {timeAgo(story.createdAt)}
            </time>
          </div>
          {story.description && (
            <p className="whitespace-pre-wrap">{story.description}</p>
          )}
          <p className="text-sm">
            <Link
              href={`/places/${encodeURIComponent(story.location.id)}`}
              className="underline"
            >
              {story.location.venueName}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
