import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { aLocation } from "@/test/fixtures";
import PlacePage from "./page";

const { loadPlace, listLocationStories } = vi.hoisted(() => ({
  loadPlace: vi.fn(),
  listLocationStories: vi.fn(),
}));
vi.mock("@/lib/places", () => ({ loadPlace }));
vi.mock("@/lib/api/server", () => ({ serverApi: { listLocationStories } }));

const props = {
  params: Promise.resolve({ id: "loc-1" }),
  searchParams: Promise.resolve({}),
};

describe("PlacePage", () => {
  it("fetches the place and its stories concurrently", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    loadPlace.mockImplementation(async () => {
      await gate;
      return aLocation();
    });
    listLocationStories.mockResolvedValue({ items: [], nextCursor: null });

    const page = PlacePage(props);
    await vi.waitFor(() => expect(listLocationStories).toHaveBeenCalled());
    expect(loadPlace).toHaveBeenCalledWith("loc-1");
    release();
    await expect(page).resolves.toBeTruthy();
  });

  it("lets the place's not-found win over a failing stories call", async () => {
    const notFound = new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    loadPlace.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      throw notFound;
    });
    listLocationStories.mockRejectedValue(new ApiError(404, "not_found", "x"));

    await expect(PlacePage(props)).rejects.toBe(notFound);
  });
});
