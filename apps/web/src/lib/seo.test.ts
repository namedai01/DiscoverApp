import { describe, expect, it } from "vitest";
import { aLocation } from "@/test/fixtures";
import { buildPlaceMetadata } from "./seo";

const SITE = "https://memopin.app";

// Next types `twitter` as a union that hides `card`.
const cardOf = (meta: ReturnType<typeof buildPlaceMetadata>) =>
  (meta.twitter as { card?: string } | null | undefined)?.card;

describe("buildPlaceMetadata", () => {
  it("describes a place with description and image", () => {
    const meta = buildPlaceMetadata(
      aLocation({
        id: "l1",
        venueName: "Hồ Gươm",
        description: "a".repeat(200),
        imageUrl: "https://img/x.jpg",
      }),
      SITE,
    );
    expect(meta.title).toBe("Hồ Gươm");
    expect([...(meta.description ?? "")]).toHaveLength(160);
    expect(meta.description?.endsWith("…")).toBe(true);
    expect(meta.openGraph?.url).toBe("https://memopin.app/places/l1");
    expect(meta.openGraph?.images).toEqual([{ url: "https://img/x.jpg" }]);
    expect(cardOf(meta)).toBe("summary_large_image");
    expect(meta.alternates?.canonical).toBe("/places/l1");
  });

  it("falls back to venueLocation when the description is empty", () => {
    const meta = buildPlaceMetadata(
      aLocation({ description: "", venueLocation: "Hoàn Kiếm, Hà Nội" }),
      SITE,
    );
    expect(meta.description).toBe("Hoàn Kiếm, Hà Nội");
  });

  it("omits images and uses a plain card without an image", () => {
    const meta = buildPlaceMetadata(aLocation({ imageUrl: "" }), SITE);
    expect(meta.openGraph?.images).toBeUndefined();
    expect(cardOf(meta)).toBe("summary");
  });
});
