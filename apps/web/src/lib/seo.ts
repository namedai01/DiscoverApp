import type { Metadata } from "next";
import type { Location } from "@/lib/api/types";
import { truncate } from "@/lib/format";

const DESCRIPTION_MAX = 160;

export function buildPlaceMetadata(
  location: Location,
  siteUrl: string,
): Metadata {
  const title = location.venueName;
  const description = truncate(
    location.description.trim() || location.venueLocation,
    DESCRIPTION_MAX,
  );
  const path = `/places/${encodeURIComponent(location.id)}`;
  const images = location.imageUrl ? [{ url: location.imageUrl }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Memopin",
      title,
      description,
      url: `${siteUrl.replace(/\/+$/, "")}${path}`,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: images?.map((image) => image.url),
    },
  };
}
