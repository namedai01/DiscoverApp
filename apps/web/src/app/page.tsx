import { PlaceGrid } from "@/components/PlaceGrid";
import { SearchForm } from "@/components/SearchForm";
import { serverApi } from "@/lib/api/server";

const PAGE_SIZE = 24;
const MAX_QUERY_CODE_POINTS = 100;

function cleanQuery(raw: string | string[] | undefined): string {
  const q = Array.isArray(raw) ? raw[0] : raw;
  return [...(q ?? "").trim()].slice(0, MAX_QUERY_CODE_POINTS).join("");
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const q = cleanQuery((await searchParams).q);
  const { items } = await serverApi.listLocations({ q, limit: PAGE_SIZE });
  const next = items.length >= PAGE_SIZE ? String(PAGE_SIZE) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Explore places</h1>
      <SearchForm action="/" defaultValue={q} placeholder="Search places" />
      {items.length === 0 ? (
        <p className="text-neutral-600">
          {q ? `No places match "${q}".` : "No places yet."}
        </p>
      ) : (
        // Keyed by the query so a new search starts from fresh server data.
        <PlaceGrid
          key={q}
          initial={{ items, next }}
          query={q}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}
