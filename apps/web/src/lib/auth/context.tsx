"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createApi } from "@/lib/api/client";
import { ApiProvider } from "@/lib/api/context";
import { ApiError } from "@/lib/api/errors";
import { publicEnv } from "@/lib/env";
import { loadAuthClient } from "./index";
import type { AuthUser, FakeAuthClient, FirebaseAuthClient } from "./types";

const NETWORK_FAILED = "auth/network-request-failed";

export const SESSION_EXPIRED_NOTICE = "Your session expired. Sign in again.";

export type AuthState = {
  status: "loading" | "signedOut" | "signedIn";
  user: AuthUser | null;
  client: FakeAuthClient | FirebaseAuthClient | null;
  getToken(force: boolean): Promise<string | null>;
  signOut(): Promise<void>;
  notice: string | null;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth must be used inside <AuthProvider>");
  return state;
}

type Client = FakeAuthClient | FirebaseAuthClient;

// Owns the auth client and the token-aware API (AuthProvider -> ApiProvider).
// Status stays "loading" until the client reports its first user, which is
// also what the server renders, so there is no hydration mismatch.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Loaded once, on first use (never during server render), then shared by
  // the effect below and every getToken/signOut call.
  const [ensureClient] = useState(() => {
    let loading: Promise<Client> | undefined;
    return (): Promise<Client> => (loading ??= loadAuthClient());
  });

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    ensureClient().then(
      (c) => {
        if (cancelled) return;
        setClient(c);
        unsubscribe = c.subscribe((u) => {
          if (cancelled) return;
          setUser(u);
          setStatus(u ? "signedIn" : "signedOut");
          if (u) setNotice(null);
        });
      },
      () => {
        // The sign-in page explains why (e.g. missing Firebase config).
        if (!cancelled) setStatus("signedOut");
      },
    );
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [ensureClient]);

  // Rejects only with a typed network ApiError, when Firebase cannot reach its
  // servers: the session is intact, so the API call fails as "offline" instead
  // of prompting sign-in or signing out. Any other failure reads as "no
  // token", which the API client turns into a typed 401 (and, after a forced
  // refresh, a sign-out).
  const getToken = useCallback(
    async (force: boolean): Promise<string | null> => {
      try {
        return await (await ensureClient()).getToken(force);
      } catch (e) {
        if ((e as { code?: unknown } | null)?.code === NETWORK_FAILED) {
          throw new ApiError(
            0,
            "network",
            "Can't reach the server. Check your connection.",
          );
        }
        return null;
      }
    },
    [ensureClient],
  );

  const signOut = useCallback(async () => {
    try {
      await (await ensureClient()).signOut();
    } catch {
      // Nothing to undo if there was no client or the sign-out failed.
    }
  }, [ensureClient]);

  const api = useMemo(
    () =>
      createApi({
        baseUrl: publicEnv.apiBaseUrl,
        getToken,
        onUnauthorized: () => {
          setNotice(SESSION_EXPIRED_NOTICE);
          void signOut();
        },
      }),
    [getToken, signOut],
  );

  const value = useMemo<AuthState>(
    () => ({ status, user, client, getToken, signOut, notice }),
    [status, user, client, getToken, signOut, notice],
  );

  return (
    <AuthContext.Provider value={value}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </AuthContext.Provider>
  );
}
