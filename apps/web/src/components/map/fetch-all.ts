import type { Api } from "@/lib/api/client";
import type { Location } from "@/lib/api/types";

// The list endpoint has no total, so a short page marks the end. maxPages
// bounds the work if the catalogue ever outgrows what a map should draw.
export async function fetchAllLocations(
  api: Pick<Api, "listLocations">,
  { pageSize = 100, maxPages = 10 }: { pageSize?: number; maxPages?: number } = {},
): Promise<Location[]> {
  const all: Location[] = [];
  for (let page = 0; page < maxPages; page++) {
    const { items } = await api.listLocations({
      limit: pageSize,
      offset: page * pageSize,
    });
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}
