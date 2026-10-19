import { notFound } from "next/navigation";
import { cache } from "react";
import type { Api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import type { Location } from "@/lib/api/types";

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
