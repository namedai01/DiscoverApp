"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useApi } from "@/lib/api/context";
import { offsetPages, usePagedList } from "@/lib/paging";
import { PagedFooter } from "./PagedFooter";
import { UserRow } from "./UserRow";

const PAGE_SIZE = 20;

export function PeopleList() {
  const api = useApi();
  const router = useRouter();
  const initialQuery = useSearchParams().get("q") ?? "";
  const [text, setText] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());

  const { items, hasMore, loading, error, loadMore, reload } = usePagedList(
    offsetPages(
      (offset, limit) => api.listUsers({ q: query, limit, offset }),
      PAGE_SIZE,
    ),
    { key: query },
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = text.trim();
    setQuery(next);
    router.replace(next ? `/people?q=${encodeURIComponent(next)}` : "/people");
  }

  const failed = error !== null && error !== undefined;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">People</h1>
      <form onSubmit={onSubmit} role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search people"
          aria-label="Search people"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900"
        >
          Search
        </button>
      </form>
      {items.length === 0 && !loading && !failed ? (
        <p className="text-neutral-600">No people found.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((user) => (
            <li key={user.id}>
              <UserRow user={user} />
            </li>
          ))}
        </ul>
      )}
      <PagedFooter
        hasMore={hasMore}
        loading={loading}
        error={error}
        onMore={loadMore}
        onRetry={items.length === 0 ? reload : loadMore}
      />
    </section>
  );
}
