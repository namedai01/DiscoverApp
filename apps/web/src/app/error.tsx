"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="space-y-4 py-8 text-center">
      <p>Something went wrong loading this page.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900"
      >
        Try again
      </button>
    </div>
  );
}
