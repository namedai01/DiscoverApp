"use client";

import { useState, type ReactNode } from "react";
import type { Story } from "@/lib/api/types";
import { usePagedList, type PageFetcher, type PageResult } from "@/lib/paging";
import { PagedFooter } from "./PagedFooter";
import { StoryCard } from "./StoryCard";
import { StoryDialog } from "./StoryDialog";

export function StoryList({
  fetcher,
  listKey,
  initial,
  empty,
}: {
  fetcher: PageFetcher<Story>;
  listKey: string;
  initial?: PageResult<Story>;
  empty: ReactNode;
}) {
  const { items, hasMore, loading, error, loadMore, reload } = usePagedList(
    fetcher,
    { key: listKey, initial },
  );
  const [open, setOpen] = useState<Story | null>(null);

  const failed = error !== null && error !== undefined;
  if (items.length === 0 && !loading && !failed) {
    return <div>{empty}</div>;
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((story) => (
          <li key={story.id}>
            <StoryCard story={story} onOpen={() => setOpen(story)} />
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
      {open && <StoryDialog story={open} onClose={() => setOpen(null)} />}
    </>
  );
}
