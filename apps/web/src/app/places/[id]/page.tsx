import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PlaceStories } from "@/components/PlaceStories";
import { RemoteImage } from "@/components/RemoteImage";
import type { Api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import type { Location } from "@/lib/api/types";
import { publicEnv } from "@/lib/env";
import { directionsUrl } from "@/lib/format";
import { buildPlaceMetadata } from "@/lib/seo";

// Shared by generateMetadata and the page: one backend call per request.
export const loadPlace = cache(
  async (id: string, api: Api = serverApi): Promise<Location> => {
    try {
      return await api.getLocation(id);
    } catch (e) {
      if (isApiError(e, "not_found")) notFound();
      throw e;
    }
  },
);

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ posted?: string | string[] }>;
};

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { id } = await params;
  return buildPlaceMetadata(await loadPlace(id), publicEnv.siteUrl);
}

const buttonBase = "rounded-lg px-4 py-2 font-medium";

export default async function PlacePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { posted } = await searchParams;
  const place = await loadPlace(id);
  const stories = await serverApi.listLocationStories(id, { limit: 12 });

  return (
    <article className="space-y-4">
      {posted === "1" && (
        <p role="status" className="rounded-lg bg-accent px-4 py-2 text-neutral-900">
          Your story was posted here.
        </p>
      )}
      <RemoteImage
        src={place.imageUrl}
        alt={place.venueName}
        className="aspect-video w-full rounded-lg object-cover"
      />
      <header>
        <h1 className="text-2xl font-semibold">{place.venueName}</h1>
        <p className="text-neutral-600">{place.venueLocation}</p>
      </header>
      {place.description && (
        <p className="whitespace-pre-wrap">{place.description}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/map?place=${encodeURIComponent(place.id)}`}
          className={`${buttonBase} bg-accent text-neutral-900`}
        >
          Show on map
        </Link>
        <a
          href={directionsUrl(place.lat, place.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonBase} border border-neutral-300`}
        >
          Directions
        </a>
      </div>
      <section aria-labelledby="stories-heading" className="space-y-3">
        <h2 id="stories-heading" className="text-xl font-semibold">
          Local stories
        </h2>
        <PlaceStories
          placeId={place.id}
          initial={{ items: stories.items, next: stories.nextCursor }}
        />
      </section>
    </article>
  );
}
