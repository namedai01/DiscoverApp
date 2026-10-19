"use client";

import { useApi } from "@/lib/api/context";
import type { Story } from "@/lib/api/types";
import { cursorPages, type PageResult } from "@/lib/paging";
import { StoryList } from "./StoryList";

const PAGE_SIZE = 12;

// A server page cannot hand StoryList a fetcher function, so this client
// wrapper builds it from the API context.
export function PlaceStories({
  placeId,
  initial,
}: {
  placeId: string;
  initial: PageResult<Story>;
}) {
  const api = useApi();
  return (
    <StoryList
      fetcher={cursorPages((cursor) =>
        api.listLocationStories(placeId, { cursor, limit: PAGE_SIZE }),
      )}
      listKey={`place:${placeId}`}
      initial={initial}
      empty={<p className="text-neutral-600">No stories here yet.</p>}
    />
  );
}
