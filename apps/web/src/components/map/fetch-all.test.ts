import { describe, expect, it, vi } from "vitest";
import { aLocation } from "@/test/fixtures";
import { fetchAllLocations } from "./fetch-all";

const page = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => aLocation({ id: `loc-${from + i}` }));

describe("fetchAllLocations", () => {
  it("pages by offset until a short page", async () => {
    const listLocations = vi
      .fn()
      .mockResolvedValueOnce({ items: page(100) })
      .mockResolvedValueOnce({ items: page(100, 100) })
      .mockResolvedValueOnce({ items: page(40, 200) });

    const all = await fetchAllLocations({ listLocations });

    expect(all).toHaveLength(240);
    expect(listLocations.mock.calls).toEqual([
      [{ limit: 100, offset: 0 }],
      [{ limit: 100, offset: 100 }],
      [{ limit: 100, offset: 200 }],
    ]);
  });

  it("stops at maxPages even when every page is full", async () => {
    const listLocations = vi.fn().mockResolvedValue({ items: page(100) });

    const all = await fetchAllLocations({ listLocations }, { maxPages: 2 });

    expect(listLocations).toHaveBeenCalledTimes(2);
    expect(all).toHaveLength(200);
  });

  it("rejects when the first page fails", async () => {
    const listLocations = vi.fn().mockRejectedValue(new Error("down"));

    await expect(fetchAllLocations({ listLocations })).rejects.toThrow("down");
  });
});
