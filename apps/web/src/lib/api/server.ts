import { publicEnv } from "@/lib/env";
import { createApi, type Api } from "./client";

// For server components: public endpoints only, never cached between requests.
export const serverApi: Api = createApi({
  baseUrl: publicEnv.apiBaseUrl,
  init: { cache: "no-store" },
});
