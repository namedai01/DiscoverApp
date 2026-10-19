import type { Metadata } from "next";
import { MapScreen } from "@/components/map/MapScreen";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string | string[] }>;
}) {
  const { place } = await searchParams;
  const initial = Array.isArray(place) ? place[0] : place;
  // Keyed so following a "Show on map" link while on /map re-selects.
  return <MapScreen key={initial} initialPlaceId={initial} />;
}
