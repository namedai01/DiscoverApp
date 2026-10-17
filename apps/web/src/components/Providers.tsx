"use client";

import { useState, type ReactNode } from "react";
import { createApi } from "@/lib/api/client";
import { ApiProvider } from "@/lib/api/context";
import { publicEnv } from "@/lib/env";

// Anonymous API for the public pages. Task 5 replaces this with the
// AuthProvider, which supplies a token-aware API instead.
export function Providers({ children }: { children: ReactNode }) {
  const [api] = useState(() => createApi({ baseUrl: publicEnv.apiBaseUrl }));
  return <ApiProvider api={api}>{children}</ApiProvider>;
}
