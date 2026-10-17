"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/api/context";
import type { Location } from "@/lib/api/types";
import { publicEnv } from "@/lib/env";
import { directionsUrl } from "@/lib/format";
import { fetchAllLocations } from "./fetch-all";
import { LocationPicker } from "./LocationPicker";

// Leaflet touches `window` on import, so the map never renders on the server.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <p className="grid h-full place-items-center text-neutral-500">
      Loading map…
    </p>
  ),
});

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; locations: Location[] };

const button = "rounded-lg px-4 py-2 font-medium";

export function MapScreen({ initialPlaceId }: { initialPlaceId?: string }) {
  const api = useApi();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPlaceId ?? null,
  );

  useEffect(() => {
    let live = true;
    fetchAllLocations(api).then(
      (locations) => {
        if (live) setLoad({ status: "ready", locations });
      },
      () => {
        if (live) setLoad({ status: "error" });
      },
    );
    return () => {
      live = false;
    };
  }, [api, attempt]);

  function retry() {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  const locations = load.status === "ready" ? load.locations : [];
  // An id that is not in the list (stale link) selects nothing.
  const selected = locations.find((p) => p.id === selectedId) ?? null;
  const { map } = publicEnv;

  return (
    <section className="space-y-3">
      <h1 className="sr-only">Map</h1>
      {load.status === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-red-700">Couldn&apos;t load places. Try again.</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-lg border border-neutral-300 px-4 py-2"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <LocationPicker
            locations={locations}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
          {selected && (
            <>
              <a
                href={directionsUrl(selected.lat, selected.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${button} bg-accent text-neutral-900`}
              >
                Directions
              </a>
              <Link
                href={`/places/${encodeURIComponent(selected.id)}`}
                className={`${button} border border-neutral-300`}
              >
                Details
              </Link>
            </>
          )}
        </div>
      )}
      {/* `isolate` keeps Leaflet's internal z-indexes (up to 1000) inside the
          map, so the fixed nav and offline banner always paint above it. */}
      <div className="isolate h-[calc(100dvh-14rem)] min-h-64 overflow-hidden rounded-lg border border-neutral-200">
        <MapView
          locations={locations}
          selected={selected}
          onMarkerClick={(id) =>
            router.push(`/places/${encodeURIComponent(id)}`)
          }
          tileUrl={map.tileUrl}
          attribution={map.attribution}
          center={[map.initialLat, map.initialLng]}
          zoom={map.initialZoom}
        />
      </div>
    </section>
  );
}
