import Link from "next/link";
import type { Location } from "@/lib/api/types";
import { RemoteImage } from "./RemoteImage";

function storyCountLabel(n: number): string {
  if (n === 0) return "No stories yet";
  return n === 1 ? "1 story" : `${n} stories`;
}

export function PlaceCard({ location }: { location: Location }) {
  return (
    <Link
      href={`/places/${encodeURIComponent(location.id)}`}
      className="block overflow-hidden rounded-lg border border-neutral-200 bg-white hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <RemoteImage
        src={location.imageUrl}
        alt=""
        className="aspect-video w-full object-cover"
      />
      <span className="block p-3">
        <span className="block font-semibold">{location.venueName}</span>
        <span className="block text-sm text-neutral-600">
          {location.venueLocation}
        </span>
        <span className="mt-1 block text-sm text-neutral-500">
          {storyCountLabel(location.storyCount)}
        </span>
      </span>
    </Link>
  );
}
