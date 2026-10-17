"use client";

import { useState, type ReactNode } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  // Replaces the grey placeholder (the avatar shows an initial instead).
  fallback?: ReactNode;
};

// The only plain <img> in the app: seed and user image URLs come from
// arbitrary hosts, so next/image's host allow-list does not fit.
export function RemoteImage({ src, alt, className = "", fallback }: Props) {
  // Remember which src failed, so a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <span
        data-testid="image-placeholder"
        aria-hidden="true"
        className={`flex items-center justify-center bg-neutral-200 text-neutral-500 ${className}`}
      >
        {fallback}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
