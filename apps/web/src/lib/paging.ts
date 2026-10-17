"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CursorPage, ListPage } from "@/lib/api/types";

export type PageResult<T> = { items: T[]; next: string | null };
export type PageFetcher<T> = (next: string | null) => Promise<PageResult<T>>;

export function cursorPages<T>(
  fn: (cursor: string | null) => Promise<CursorPage<T>>,
): PageFetcher<T> {
  return async (next) => {
    const page = await fn(next);
    return { items: page.items, next: page.nextCursor };
  };
}

// The API has no total: a full page means there may be more.
export function offsetPages<T>(
  fn: (offset: number, limit: number) => Promise<ListPage<T>>,
  limit: number,
): PageFetcher<T> {
  return async (next) => {
    const offset = next === null ? 0 : Number(next);
    const page = await fn(offset, limit);
    return {
      items: page.items,
      next: page.items.length >= limit ? String(offset + limit) : null,
    };
  };
}

export function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Set(a.map((x) => x.id));
  return [...a, ...b.filter((x) => !seen.has(x.id))];
}

type State<T> = {
  key: string;
  items: T[];
  next: string | null;
  loading: boolean;
  error: unknown;
};

export function usePagedList<T extends { id: string }>(
  fetcher: PageFetcher<T>,
  opts: { key: string; initial?: PageResult<T> },
) {
  const { key, initial } = opts;
  const [state, setState] = useState<State<T>>(() => ({
    key,
    items: initial?.items ?? [],
    next: initial?.next ?? null,
    loading: initial === undefined,
    error: null,
  }));

  // A new key is a new query: drop the old items during render so they never
  // flash for the new key.
  if (state.key !== key) {
    setState({ key, items: [], next: null, loading: true, error: null });
  }

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const generation = useRef(0);
  const inFlight = useRef(false);
  const nextRef = useRef(state.next);
  const seededKey = useRef<string | null>(initial ? key : null);

  useEffect(() => {
    nextRef.current = state.next;
  }, [state.next]);

  const fetchFirst = useCallback((gen: number) => {
    inFlight.current = true;
    fetcherRef.current(null).then(
      (page) => {
        if (gen !== generation.current) return;
        inFlight.current = false;
        nextRef.current = page.next;
        setState((s) => ({
          ...s,
          items: page.items,
          next: page.next,
          loading: false,
          error: null,
        }));
      },
      (error: unknown) => {
        if (gen !== generation.current) return;
        inFlight.current = false;
        setState((s) => ({ ...s, loading: false, error }));
      },
    );
  }, []);

  // Drops any response still in flight and frees the in-flight lock.
  const invalidate = useCallback(() => {
    generation.current++;
    inFlight.current = false;
  }, []);

  useEffect(() => {
    if (seededKey.current === key) return;
    seededKey.current = null;
    fetchFirst(generation.current);
    return invalidate;
  }, [key, fetchFirst, invalidate]);

  const loadMore = useCallback(() => {
    const cursor = nextRef.current;
    if (cursor === null || inFlight.current) return;
    inFlight.current = true;
    const gen = generation.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef.current(cursor).then(
      (page) => {
        if (gen !== generation.current) return;
        inFlight.current = false;
        nextRef.current = page.next;
        setState((s) => ({
          ...s,
          items: mergeById(s.items, page.items),
          next: page.next,
          loading: false,
        }));
      },
      (error: unknown) => {
        if (gen !== generation.current) return;
        inFlight.current = false;
        setState((s) => ({ ...s, loading: false, error }));
      },
    );
  }, []);

  const reload = useCallback(() => {
    invalidate();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchFirst(generation.current);
  }, [fetchFirst, invalidate]);

  return {
    items: state.items,
    hasMore: state.next !== null,
    loading: state.loading,
    error: state.error,
    loadMore,
    reload,
  };
}
