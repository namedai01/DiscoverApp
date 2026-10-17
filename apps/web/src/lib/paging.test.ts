import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  cursorPages,
  mergeById,
  offsetPages,
  usePagedList,
  type PageResult,
} from "./paging";

type Item = { id: string; v?: number };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("mergeById", () => {
  it("keeps the first occurrence", () => {
    const a = { id: "a", v: 1 };
    const b = { id: "b", v: 1 };
    const b2 = { id: "b", v: 2 };
    const c = { id: "c", v: 1 };
    expect(mergeById([a, b], [b2, c])).toEqual([a, b, c]);
  });
});

describe("offsetPages", () => {
  it("advances by limit while full pages come back", async () => {
    const fn = vi
      .fn<(o: number, l: number) => Promise<{ items: Item[] }>>()
      .mockResolvedValueOnce({ items: [{ id: "1" }, { id: "2" }] })
      .mockResolvedValueOnce({ items: [{ id: "3" }] });
    const fetcher = offsetPages(fn, 2);
    expect(await fetcher(null)).toEqual({
      items: [{ id: "1" }, { id: "2" }],
      next: "2",
    });
    expect(fn).toHaveBeenLastCalledWith(0, 2);
    expect(await fetcher("2")).toEqual({ items: [{ id: "3" }], next: null });
    expect(fn).toHaveBeenLastCalledWith(2, 2);
  });
});

describe("cursorPages", () => {
  it("maps nextCursor to next and passes the cursor through", async () => {
    const fn = vi
      .fn<(c: string | null) => Promise<{ items: Item[]; nextCursor: string | null }>>()
      .mockResolvedValue({ items: [{ id: "1" }], nextCursor: null });
    const fetcher = cursorPages(fn);
    expect(await fetcher("abc")).toEqual({ items: [{ id: "1" }], next: null });
    expect(fn).toHaveBeenCalledWith("abc");
    await fetcher(null);
    expect(fn).toHaveBeenLastCalledWith(null);
  });
});

describe("usePagedList", () => {
  it("seeds from initial and dedupes appended pages", async () => {
    const d = deferred<PageResult<Item>>();
    const fetcher = vi.fn(() => d.promise);
    const initial: PageResult<Item> = { items: [{ id: "a" }], next: "c1" };
    const { result } = renderHook(() =>
      usePagedList<Item>(fetcher, { key: "k", initial }),
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([{ id: "a" }]);
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("c1");
    expect(result.current.loading).toBe(true);

    await act(async () => {
      d.resolve({ items: [{ id: "a" }, { id: "b" }], next: null });
    });
    expect(result.current.items).toEqual([{ id: "a" }, { id: "b" }]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("fetches the first page on mount without initial", async () => {
    const fetcher = vi.fn(async () => ({ items: [{ id: "a" }], next: null }));
    const { result } = renderHook(() => usePagedList<Item>(fetcher, { key: "k" }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.items).toEqual([{ id: "a" }]));
    expect(fetcher).toHaveBeenCalledWith(null);
    expect(result.current.loading).toBe(false);
  });

  it("discards stale pages after the key changes", async () => {
    const first = deferred<PageResult<Item>>();
    const fetcher = vi.fn(() => first.promise);
    const { result, rerender } = renderHook(
      ({ k }) =>
        usePagedList<Item>(
          k === "q=a"
            ? fetcher
            : async () => ({ items: [{ id: "b1" }], next: null }),
          { key: k },
        ),
      { initialProps: { k: "q=a" } },
    );
    rerender({ k: "q=b" });
    await waitFor(() => expect(result.current.items).toEqual([{ id: "b1" }]));
    await act(async () => {
      first.resolve({ items: [{ id: "a1" }], next: "x" });
    });
    expect(result.current.items).toEqual([{ id: "b1" }]);
    expect(result.current.hasMore).toBe(false);
  });

  it("keeps items on error and reload recovers from the first page", async () => {
    const fetcher = vi
      .fn<(n: string | null) => Promise<PageResult<Item>>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ items: [{ id: "n" }], next: null });
    const initial: PageResult<Item> = { items: [{ id: "a" }], next: "c1" };
    const { result } = renderHook(() =>
      usePagedList<Item>(fetcher, { key: "k", initial }),
    );
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.items).toEqual([{ id: "a" }]);
    expect(result.current.loading).toBe(false);

    act(() => result.current.reload());
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(result.current.items).toEqual([{ id: "n" }]));
    expect(result.current.error).toBeNull();
  });
});
