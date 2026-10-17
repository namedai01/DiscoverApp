"use client";

import { useApi } from "@/lib/api/context";
import type { Location } from "@/lib/api/types";
import { offsetPages, usePagedList, type PageResult } from "@/lib/paging";
import { PagedFooter } from "./PagedFooter";
import { PlaceCard } from "./PlaceCard";

export function PlaceGrid({
  initial,
  query,
  pageSize,
}: {
  initial: PageResult<Location>;
  query: string;
  pageSize: number;
}) {
  const api = useApi();
  const { items, hasMore, loading, error, loadMore, reload } = usePagedList(
    offsetPages(
      (offset, limit) => api.listLocations({ q: query, limit, offset }),
      pageSize,
    ),
    { key: query, initial },
  );

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((location) => (
          <li key={location.id}>
            <PlaceCard location={location} />
          </li>
        ))}
      </ul>
      <PagedFooter
        hasMore={hasMore}
        loading={loading}
        error={error}
        onMore={loadMore}
        onRetry={items.length === 0 ? reload : loadMore}
      />
    </>
  );
}
