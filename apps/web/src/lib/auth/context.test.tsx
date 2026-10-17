import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Api } from "@/lib/api/client";
import { useApi } from "@/lib/api/context";
import { AuthProvider, useAuth, type AuthState } from "./context";
import type { FakeAuthClient } from "./types";

const loadAuthClient = vi.fn();
vi.mock("./index", () => ({ loadAuthClient: () => loadAuthClient() }));

function client(overrides: Partial<FakeAuthClient> = {}): FakeAuthClient {
  return {
    subscribe: vi.fn((cb) => {
      cb({ uid: "u1", phone: null });
      return () => {};
    }),
    getToken: vi.fn(async (force: boolean) => (force ? "fresh" : "stale")),
    signOut: vi.fn(async () => {}),
    signIn: vi.fn(),
    ...overrides,
  };
}

// Filled by an effect, so tests read the latest context values.
const latest = {} as { auth: AuthState; api: Api };
function Probe() {
  const auth = useAuth();
  const api = useApi();
  useEffect(() => {
    latest.auth = auth;
    latest.api = api;
  });
  return <p>{auth.status}</p>;
}

function mount() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  loadAuthClient.mockReset();
  vi.unstubAllGlobals();
});

describe("AuthProvider", () => {
  it("stays loading until the client reports its first user", async () => {
    let report!: (u: { uid: string; phone: string | null } | null) => void;
    loadAuthClient.mockResolvedValue(
      client({
        subscribe: vi.fn((cb) => {
          report = cb;
          return () => {};
        }),
      }),
    );
    mount();
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(report).toBeDefined());
    expect(screen.getByText("loading")).toBeInTheDocument();
    act(() => report(null));
    expect(screen.getByText("signedOut")).toBeInTheDocument();
    act(() => report({ uid: "u1", phone: null }));
    expect(screen.getByText("signedIn")).toBeInTheDocument();
    expect(latest.auth.user).toEqual({ uid: "u1", phone: null });
  });

  it("settles as signed out when the client cannot be created", async () => {
    loadAuthClient.mockRejectedValue(new Error("Firebase web config is missing"));
    mount();
    expect(await screen.findByText("signedOut")).toBeInTheDocument();
    expect(latest.auth.client).toBeNull();
    await expect(latest.auth.getToken(false)).resolves.toBeNull();
    await expect(latest.auth.signOut()).resolves.toBeUndefined();
  });

  it("getToken resolves null when the client fails for a non-network reason", async () => {
    loadAuthClient.mockResolvedValue(
      client({
        getToken: vi
          .fn()
          .mockRejectedValue({ code: "auth/user-token-expired" }),
      }),
    );
    mount();
    await screen.findByText("signedIn");
    await expect(latest.auth.getToken(true)).resolves.toBeNull();
  });

  it("getToken rejects with a typed network error when Firebase is offline", async () => {
    loadAuthClient.mockResolvedValue(
      client({
        getToken: vi
          .fn()
          .mockRejectedValue({ code: "auth/network-request-failed" }),
      }),
    );
    mount();
    await screen.findByText("signedIn");
    await expect(latest.auth.getToken(true)).rejects.toMatchObject({
      code: "network",
      status: 0,
      message: "Can't reach the server. Check your connection.",
    });
  });

  it("refreshes the token once on a 401 and retries", async () => {
    const c = client();
    loadAuthClient.mockResolvedValue(c);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: "unauthorized", message: "expired" } }))
      .mockResolvedValueOnce(json(200, { id: "u1" }));
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await screen.findByText("signedIn");

    await expect(latest.api.getMe()).resolves.toEqual({ id: "u1" });
    expect(c.getToken).toHaveBeenNthCalledWith(1, false);
    expect(c.getToken).toHaveBeenNthCalledWith(2, true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(c.signOut).not.toHaveBeenCalled();
    expect(latest.auth.notice).toBeNull();
  });

  it("a second 401 signs out with the session-expired notice, without looping", async () => {
    const c = client();
    loadAuthClient.mockResolvedValue(c);
    const fetchMock = vi.fn(async () =>
      json(401, { error: { code: "unauthorized", message: "expired" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await screen.findByText("signedIn");

    await expect(latest.api.getMe()).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(c.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(latest.auth.notice).toBe("Your session expired. Sign in again."),
    );
  });

  it("a refresh that fails for a non-network reason signs out with the notice", async () => {
    const c = client({
      getToken: vi.fn(async (force: boolean) => {
        if (force) throw { code: "auth/user-token-expired" };
        return "stale";
      }),
    });
    loadAuthClient.mockResolvedValue(c);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(401, { error: { code: "unauthorized", message: "x" } })),
    );
    mount();
    await screen.findByText("signedIn");

    await expect(latest.api.getMe()).rejects.toMatchObject({
      code: "unauthorized",
    });
    expect(c.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(latest.auth.notice).toBe("Your session expired. Sign in again."),
    );
  });

  it("a refresh that fails because the network is down keeps the session", async () => {
    const c = client({
      getToken: vi.fn(async (force: boolean) => {
        if (force) throw { code: "auth/network-request-failed" };
        return "stale";
      }),
    });
    loadAuthClient.mockResolvedValue(c);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(401, { error: { code: "unauthorized", message: "x" } })),
    );
    mount();
    await screen.findByText("signedIn");

    await expect(latest.api.getMe()).rejects.toMatchObject({ code: "network" });
    expect(c.signOut).not.toHaveBeenCalled();
    expect(latest.auth.notice).toBeNull();
  });

  it.each(["auth/too-many-requests", "auth/internal-error"])(
    "a refresh that fails with %s keeps the session like a network error",
    async (code) => {
      const c = client({
        getToken: vi.fn(async (force: boolean) => {
          if (force) throw { code };
          return "stale";
        }),
      });
      loadAuthClient.mockResolvedValue(c);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => json(401, { error: { code: "unauthorized", message: "x" } })),
      );
      mount();
      await screen.findByText("signedIn");

      await expect(latest.api.getMe()).rejects.toMatchObject({
        code: "network",
        status: 0,
      });
      expect(c.signOut).not.toHaveBeenCalled();
      expect(latest.auth.notice).toBeNull();
    },
  );

  it("an offline first token lookup is a network error, not a sign-in prompt", async () => {
    const c = client({
      getToken: vi.fn().mockRejectedValue({ code: "auth/network-request-failed" }),
    });
    loadAuthClient.mockResolvedValue(c);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await screen.findByText("signedIn");

    await expect(latest.api.getMe()).rejects.toMatchObject({ code: "network" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(c.signOut).not.toHaveBeenCalled();
    expect(latest.auth.notice).toBeNull();
  });

  it("clears the notice on the next sign-in", async () => {
    let report!: (u: { uid: string; phone: string | null } | null) => void;
    const c = client({
      subscribe: vi.fn((cb) => {
        report = cb;
        cb({ uid: "u1", phone: null });
        return () => {};
      }),
    });
    loadAuthClient.mockResolvedValue(c);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(401, { error: { code: "unauthorized", message: "x" } })),
    );
    mount();
    await screen.findByText("signedIn");
    await expect(latest.api.getMe()).rejects.toBeDefined();
    await waitFor(() => expect(latest.auth.notice).not.toBeNull());
    act(() => report(null));
    act(() => report({ uid: "u2", phone: null }));
    expect(latest.auth.notice).toBeNull();
  });
});
