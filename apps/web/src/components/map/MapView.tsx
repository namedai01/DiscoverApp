"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Location } from "@/lib/api/types";

// A CSS-drawn marker: Leaflet's default icon resolves image paths that
// bundlers break.
const markerIcon = L.divIcon({
  className: "memopin-marker",
  iconSize: [18, 18],
});

function FlyTo({ selected }: { selected: Location | null }) {
  const map = useMap();
  const id = selected?.id;
  const lat = selected?.lat;
  const lng = selected?.lng;
  useEffect(() => {
    if (id !== undefined && lat !== undefined && lng !== undefined) {
      map.flyTo([lat, lng], 15);
    }
  }, [map, id, lat, lng]);
  return null;
}

export default function MapView({
  locations,
  selected,
  onMarkerClick,
  tileUrl,
  attribution,
  center,
  zoom,
}: {
  locations: Location[];
  selected: Location | null;
  onMarkerClick: (id: string) => void;
  tileUrl: string;
  attribution: string;
  center: [number, number];
  zoom: number;
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer url={tileUrl} attribution={attribution} />
      {locations.map((place) => (
        <Marker
          key={place.id}
          position={[place.lat, place.lng]}
          icon={markerIcon}
          eventHandlers={{ click: () => onMarkerClick(place.id) }}
        >
          <Tooltip>{place.venueName}</Tooltip>
        </Marker>
      ))}
      <FlyTo selected={selected} />
    </MapContainer>
  );
}
