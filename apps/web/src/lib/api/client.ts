import {
  ApiError,
  codeFromStatus,
  isServerCode,
  type ApiErrorCode,
} from "./errors";
import type {
  CursorPage,
  ListPage,
  Location,
  MePatch,
  NewStory,
  Story,
  User,
  UserWithFollow,
} from "./types";

export type ApiOptions = {
  baseUrl: string;
  getToken?: (forceRefresh: boolean) => Promise<string | null>;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
  init?: RequestInit;
};

type SearchParams = { q?: string; limit?: number; offset?: number };
type StoryParams = { cursor?: string | null; limit?: number };

export type Api = {
  listLocations(p?: SearchParams): Promise<ListPage<Location>>;
  getLocation(id: string): Promise<Location>;
  listLocationStories(id: string, p?: StoryParams): Promise<CursorPage<Story>>;
  listUsers(p?: SearchParams): Promise<ListPage<User>>;
  getMe(): Promise<User>;
  updateMe(patch: MePatch): Promise<User>;
  getUser(id: string): Promise<UserWithFollow>;
  listUserStories(id: string, p?: StoryParams): Promise<CursorPage<Story>>;
  follow(id: string): Promise<void>;
  unfollow(id: string): Promise<void>;
  createStory(input: NewStory): Promise<Story>;
};

const MAX_QUERY_CODE_POINTS = 100;

type Query = Record<string, string | number | null | undefined>;

function toSearch(query: Query | undefined): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function searchQuery(p: SearchParams | undefined): Query {
  const q = [...(p?.q?.trim() ?? "")].slice(0, MAX_QUERY_CODE_POINTS).join("");
  return { q, limit: p?.limit, offset: p?.offset };
}

function storyQuery(p: StoryParams | undefined): Query {
  return { cursor: p?.cursor, limit: p?.limit };
}

function isAbort(e: unknown): boolean {
  // DOMException is not always `instanceof Error` (jsdom), so check the name.
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { name?: unknown }).name === "AbortError"
  );
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    body = undefined;
  }
  const detail = (body as { error?: { code?: unknown; message?: unknown } })
    ?.error;
  if (detail && typeof detail.message === "string" && detail.message) {
    const code: ApiErrorCode = isServerCode(detail.code)
      ? detail.code
      : "unknown";
    return new ApiError(res.status, code, detail.message);
  }
  const code = codeFromStatus(res.status);
  const message =
    res.status >= 500
      ? `Server error (${res.status}). Try again.`
      : `Request failed (${res.status}).`;
  return new ApiError(res.status, code, message);
}

export function createApi(opts: ApiOptions): Api {
  const baseUrl = opts.baseUrl.replace(/\/+$/, "");
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  const unauthorized = (message: string) =>
    new ApiError(401, "unauthorized", message);

  async function send(
    method: string,
    url: string,
    token: string | null,
    body: unknown,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const init: RequestInit = { ...opts.init, method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    try {
      return await doFetch(url, init);
    } catch (e) {
      if (isAbort(e)) throw e;
      throw new ApiError(
        0,
        "network",
        "Can't reach the server. Check your connection.",
      );
    }
  }

  async function request<T>(
    method: string,
    path: string,
    o: { query?: Query; body?: unknown; auth: boolean },
  ): Promise<T> {
    const url = `${baseUrl}${path}${toSearch(o.query)}`;

    let token: string | null = null;
    if (o.auth) {
      token = (await opts.getToken?.(false)) ?? null;
      if (!token) throw unauthorized("Sign in to continue.");
    }

    let res = await send(method, url, token, o.body);

    if (o.auth && res.status === 401) {
      // The ID token may have expired mid-session: refresh once and retry.
      // A second 401 is final, so this can never loop.
      const fresh = (await opts.getToken?.(true)) ?? null;
      if (fresh) res = await send(method, url, fresh, o.body);
      if (!fresh || res.status === 401) opts.onUnauthorized?.();
    }

    if (!res.ok) throw await toApiError(res);
    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch (e) {
      if (isAbort(e)) throw e;
      throw new ApiError(
        res.status,
        "internal",
        `Server error (${res.status}). Try again.`,
      );
    }
  }

  const id = encodeURIComponent;

  return {
    listLocations: (p) =>
      request("GET", "/v1/locations", { query: searchQuery(p), auth: false }),
    getLocation: (locationId) =>
      request("GET", `/v1/locations/${id(locationId)}`, { auth: false }),
    listLocationStories: (locationId, p) =>
      request("GET", `/v1/locations/${id(locationId)}/stories`, {
        query: storyQuery(p),
        auth: false,
      }),
    listUsers: (p) =>
      request("GET", "/v1/users", { query: searchQuery(p), auth: false }),
    getMe: () => request("GET", "/v1/me", { auth: true }),
    updateMe: (patch) =>
      request("PATCH", "/v1/me", { body: patch, auth: true }),
    getUser: (userId) =>
      request("GET", `/v1/users/${id(userId)}`, { auth: true }),
    listUserStories: (userId, p) =>
      request("GET", `/v1/users/${id(userId)}/stories`, {
        query: storyQuery(p),
        auth: true,
      }),
    follow: (userId) =>
      request("PUT", `/v1/users/${id(userId)}/follow`, { auth: true }),
    unfollow: (userId) =>
      request("DELETE", `/v1/users/${id(userId)}/follow`, { auth: true }),
    createStory: (input) =>
      request("POST", "/v1/stories", { body: input, auth: true }),
  };
}
