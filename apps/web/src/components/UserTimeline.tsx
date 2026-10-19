"use client";

import { useState } from "react";
import { useApi } from "@/lib/api/context";
import { isApiError } from "@/lib/api/errors";
import { cursorPages } from "@/lib/paging";
import { StoryList } from "./StoryList";

const PAGE_SIZE = 12;

// The backend answers 403 until the viewer follows the owner (or is the
// owner); that is a normal state here, not an error.
export function UserTimeline({
  userId,
  ownerName,
  refreshKey,
}: {
  userId: string;
  ownerName: string;
  refreshKey: number;
}) {
  const api = useApi();
  const listKey = `user:${userId}:${refreshKey}`;
  const [lockedKey, setLockedKey] = useState<string | null>(null);

  const fetcher = cursorPages(async (cursor) => {
    try {
      return await api.listUserStories(userId, { cursor, limit: PAGE_SIZE });
    } catch (e) {
      if (!isApiError(e, "forbidden")) throw e;
      setLockedKey(listKey);
      return { items: [], nextCursor: null };
    }
  });

  return (
    <StoryList
      fetcher={fetcher}
      listKey={listKey}
      empty={
        <p className="text-neutral-600">
          {lockedKey === listKey
            ? `Follow ${ownerName} to see their stories.`
            : "No stories yet"}
        </p>
      }
    />
  );
}
