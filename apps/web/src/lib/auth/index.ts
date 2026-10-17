import { publicEnv } from "@/lib/env";
import type { FakeAuthClient, FirebaseAuthClient } from "./types";

// The only way into the fake client. The NODE_ENV test is replaced at build
// time, so production bundles drop the import and the fake modules with it.
export async function loadAuthClient(): Promise<
  FakeAuthClient | FirebaseAuthClient
> {
  if (process.env.NODE_ENV !== "production" && publicEnv.authMode === "fake") {
    const { createFakeAuthClient } = await import("./fake-client");
    return createFakeAuthClient();
  }
  const { createFirebaseAuthClient } = await import("./firebase-client");
  return createFirebaseAuthClient();
}
