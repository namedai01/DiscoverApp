import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { Api } from "@/lib/api/client";
import { aLocation } from "@/test/fixtures";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound }));

import { loadPlace } from "./page";

function apiWith(getLocation: Api["getLocation"]): Api {
  return { getLocation } as Api;
}

describe("loadPlace", () => {
  beforeEach(() => {
    notFound.mockClear();
  });

  it("returns the location", async () => {
    const place = aLocation({ id: "l1" });
    const api = apiWith(() => Promise.resolve(place));
    await expect(loadPlace("l1", api)).resolves.toEqual(place);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("maps a 404 to notFound", async () => {
    const api = apiWith(() =>
      Promise.reject(new ApiError(404, "not_found", "location not found")),
    );
    await expect(loadPlace("nope", api)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("rethrows other errors", async () => {
    const err = new ApiError(0, "network", "Can't reach the server.");
    const api = apiWith(() => Promise.reject(err));
    await expect(loadPlace("l1", api)).rejects.toBe(err);
    expect(notFound).not.toHaveBeenCalled();
  });
});
