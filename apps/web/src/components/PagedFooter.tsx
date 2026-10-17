import { isApiError } from "@/lib/api/errors";

// "Load more" + inline error with retry, shared by every paged list.
export function PagedFooter({
  hasMore,
  loading,
  error,
  onMore,
  onRetry,
}: {
  hasMore: boolean;
  loading: boolean;
  error: unknown;
  onMore: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {error !== null && error !== undefined && (
        <p role="alert" className="text-sm text-red-700">
          {isApiError(error) ? error.message : "Something went wrong."}
        </p>
      )}
      {error !== null && error !== undefined ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-neutral-300 px-4 py-2"
        >
          Try again
        </button>
      ) : hasMore ? (
        <button
          type="button"
          onClick={onMore}
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900 disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : null}
    </div>
  );
}
