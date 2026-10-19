import type { Location } from "@/lib/api/types";

export function LocationPicker({
  locations,
  selectedId,
  onSelect,
}: {
  locations: Location[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const sorted = [...locations].sort((a, b) =>
    a.venueName.localeCompare(b.venueName),
  );
  return (
    <select
      aria-label="Place"
      value={selectedId ?? ""}
      onChange={(e) => onSelect(e.target.value || null)}
      className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2"
    >
      <option value="">Choose a place</option>
      {sorted.map((place) => (
        <option key={place.id} value={place.id}>
          {place.venueName}
        </option>
      ))}
    </select>
  );
}
