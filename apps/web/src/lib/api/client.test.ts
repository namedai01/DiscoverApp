import { describe, expect, it, vi } from "vitest";
import { createApi } from "./client";
import { ApiError, isApiError } from "./errors";

type Call = { url: string; init: RequestInit };

function setup(
  responder: (call: Call, n: number) => Response | Promise<Response>,
  opts: Partial<Parameters<typeof createApi>[0]> = {},
) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return responder(call, calls.length);
  });
  const api = createApi({
    baseUrl: "http://api",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...opts,
  });
  return { api, calls, fetchImpl };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const header = (call: Call, name: string) =>
  new Headers(call.init.headers).get(name);

const errorBody = (code: string, message: string) => ({
  error: { code, message },
});

describe("createApi", () => {
  it("builds query and encodes path", async () => {
    const { api, calls } = setup(() => json({ items: [] }));
    await api.listLocations({ q: "Hồ %_", limit: 24, offset: 0 });
    expect(calls[0]?.url).toBe(
      "http://api/v1/locations?q=H%E1%BB%93+%25_&limit=24&offset=0",
    );

    await api.listLocations({ q: "   ", limit: undefined });
    await api.listLocations();
    expect(calls[1]?.url).toBe("http://api/v1/locations");
    expect(calls[2]?.url).toBe("http://api/v1/locations");

    const authed = setup(() => json({ id: "a/b" }), {
      getToken: async () => "t",
    });
    await authed.api.getUser("a/b");
    expect(authed.calls[0]?.url).toBe("http://api/v1/users/a%2Fb");
  });

  it("cuts q to 100 code points after trimming", async () => {
    const { api, calls } = setup(() => json({ items: [] }));
    await api.listUsers({ q: `  ${"😀".repeat(120)}  ` });
    const q = new URL(calls[0]!.url).searchParams.get("q")!;
    expect([...q]).toHaveLength(100);
  });

  it("sends the story cursor and limit", async () => {
    const { api, calls } = setup(() => json({ items: [], nextCursor: null }));
    await api.listLocationStories("l1", { cursor: "c 1", limit: 10 });
    await api.listLocationStories("l1", { cursor: null });
    expect(calls[0]?.url).toBe(
      "http://api/v1/locations/l1/stories?cursor=c+1&limit=10",
    );
    expect(calls[1]?.url).toBe("http://api/v1/locations/l1/stories");
  });

  it("public calls send no Authorization", async () => {
    const getToken = vi.fn(async () => "fake:u1:");
    const { api, calls } = setup(() => json({ id: "l1" }), { getToken });
    await api.getLocation("l1");
    expect(getToken).not.toHaveBeenCalled();
    expect(header(calls[0]!, "Authorization")).toBeNull();
  });

  it("authed calls send bearer", async () => {
    const getToken = vi.fn(async () => "fake:u1:");
    const { api, calls } = setup(
      (call) =>
        call.init.method === "POST" ? json({ id: "s1" }, 201) : json({ id: "u1" }),
      { getToken },
    );
    await api.getMe();
    expect(getToken).toHaveBeenCalledWith(false);
    expect(header(calls[0]!, "Authorization")).toBe("Bearer fake:u1:");
    expect(calls[0]?.init.method).toBe("GET");

    const input = {
      title: "t",
      type: "food",
      description: "d",
      imageUrl: "https://x/y.jpg",
      lat: 1,
      lng: 2,
    };
    await api.createStory(input);
    expect(calls[1]?.url).toBe("http://api/v1/stories");
    expect(calls[1]?.init.method).toBe("POST");
    expect(header(calls[1]!, "Content-Type")).toBe("application/json");
    expect(calls[1]?.init.body).toBe(JSON.stringify(input));
  });

  it("updateMe sends PATCH /v1/me", async () => {
    const { api, calls } = setup(() => json({ id: "u1" }), {
      getToken: async () => "t",
    });
    await api.updateMe({ displayName: "Dai" });
    expect(calls[0]?.url).toBe("http://api/v1/me");
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(calls[0]?.init.body).toBe(JSON.stringify({ displayName: "Dai" }));
  });

  it("authed call without token", async () => {
    const { api, fetchImpl } = setup(() => json({}), {
      getToken: async () => null,
    });
    const err = await api.getMe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 401,
      code: "unauthorized",
      message: "Sign in to continue.",
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    const noGetter = setup(() => json({})).api;
    await expect(noGetter.getMe()).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("maps error body", async () => {
    const { api } = setup(
      () =>
        json(errorBody("forbidden", "follow this user to see their stories"), 403),
      { getToken: async () => "t" },
    );
    const err = await api.listUserStories("u2").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 403,
      code: "forbidden",
      message: "follow this user to see their stories",
    });
    expect(isApiError(err, "forbidden")).toBe(true);
    expect(isApiError(err, "not_found")).toBe(false);
    expect(isApiError(new Error("x"))).toBe(false);

    const teapot = setup(() => json(errorBody("teapot", "short and stout"), 418));
    await expect(teapot.api.getLocation("l1")).rejects.toMatchObject({
      status: 418,
      code: "unknown",
      message: "short and stout",
    });
  });

  it("non-JSON 502", async () => {
    const { api } = setup(() => new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(api.getLocation("l1")).rejects.toMatchObject({
      status: 502,
      code: "internal",
      message: "Server error (502). Try again.",
    });
  });

  it("non-JSON 404 maps by status", async () => {
    const { api } = setup(() => new Response("nope", { status: 404 }));
    await expect(api.getLocation("l1")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("network failure", async () => {
    const failing = setup(() => {
      throw new TypeError("Failed to fetch");
    });
    await expect(failing.api.getLocation("l1")).rejects.toMatchObject({
      status: 0,
      code: "network",
      message: "Can't reach the server. Check your connection.",
    });

    const abort = new DOMException("aborted", "AbortError");
    const aborting = setup(() => {
      throw abort;
    });
    await expect(aborting.api.getLocation("l1")).rejects.toBe(abort);
  });

  it("204 resolves undefined", async () => {
    const { api, calls } = setup(() => new Response(null, { status: 204 }), {
      getToken: async () => "t",
    });
    await expect(api.follow("u2")).resolves.toBeUndefined();
    await expect(api.unfollow("u2")).resolves.toBeUndefined();
    expect(calls[0]?.url).toBe("http://api/v1/users/u2/follow");
    expect(calls[0]?.init.method).toBe("PUT");
    expect(calls[1]?.init.method).toBe("DELETE");
  });

  it("passes init through to fetch", async () => {
    const { api, calls } = setup(() => json({ items: [] }), {
      init: { cache: "no-store" },
    });
    await api.listUsers();
    expect(calls[0]?.init.cache).toBe("no-store");
  });

  it("retries once with a refreshed token then calls onUnauthorized", async () => {
    const getToken = vi.fn(async (force: boolean) => (force ? "fresh" : "stale"));
    const onUnauthorized = vi.fn();
    const { api, calls, fetchImpl } = setup(
      () => json(errorBody("unauthorized", "invalid token"), 401),
      { getToken, onUnauthorized },
    );
    await expect(api.getMe()).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
    expect(getToken.mock.calls).toEqual([[false], [true]]);
    expect(header(calls[0]!, "Authorization")).toBe("Bearer stale");
    expect(header(calls[1]!, "Authorization")).toBe("Bearer fresh");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("a refreshed token that works does not sign out", async () => {
    const onUnauthorized = vi.fn();
    const { api, fetchImpl } = setup(
      (_call, n) =>
        n === 1 ? json(errorBody("unauthorized", "expired"), 401) : json({ id: "u1" }),
      { getToken: async (force) => (force ? "fresh" : "stale"), onUnauthorized },
    );
    await expect(api.getMe()).resolves.toEqual({ id: "u1" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("a 401 when no fresh token is available signs out", async () => {
    const onUnauthorized = vi.fn();
    const { api, fetchImpl } = setup(
      () => json(errorBody("unauthorized", "expired"), 401),
      { getToken: async (force) => (force ? null : "stale"), onUnauthorized },
    );
    await expect(api.getMe()).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
