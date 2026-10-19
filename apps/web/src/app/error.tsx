"use client";

// `retry` re-fetches the server data; `reset` would only clear the error
// state and show the same failure again after a backend outage.
export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div role="alert" className="space-y-4 py-8 text-center">
      <p>Something went wrong loading this page.</p>
      <button
        type="button"
        onClick={retry}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900"
      >
        Try again
      </button>
    </div>
  );
}
