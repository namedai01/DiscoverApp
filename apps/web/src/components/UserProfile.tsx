"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api/context";
import { isApiError } from "@/lib/api/errors";
import type { UserWithFollow } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { formatFollowers } from "@/lib/format";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { UserTimeline } from "./UserTimeline";

type State = { id: string; user: UserWithFollow | null; error: unknown };

export function UserProfile({ id }: { id: string }) {
  const api = useApi();
  const { user: me } = useAuth();
  const [state, setState] = useState<State>({ id, user: null, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  // A new id is a new profile: never show the previous one.
  if (state.id !== id) {
    setState({ id, user: null, error: null });
  }

  const latest = useRef(0);
  const fetchUser = useCallback(
    (silent: boolean) => {
      const n = ++latest.current;
      api.getUser(id).then(
        (user) => {
          if (n !== latest.current) return;
          setState((s) => (s.id === id ? { ...s, user, error: null } : s));
        },
        (error: unknown) => {
          // A failed background refresh keeps the profile that is on screen.
          if (n !== latest.current || silent) return;
          setState((s) => (s.id === id ? { ...s, error } : s));
        },
      );
    },
    [api, id],
  );

  // Drops any response still in flight (id change, unmount).
  const invalidate = useCallback(() => {
    latest.current++;
  }, []);

  useEffect(() => {
    fetchUser(false);
    return invalidate;
  }, [fetchUser, invalidate]);

  function onFollowChange(next: boolean) {
    setState((s) =>
      s.user && s.id === id ? { ...s, user: { ...s.user, isFollowing: next } } : s,
    );
    setRefreshKey((k) => k + 1);
    fetchUser(true);
  }

  const { user, error } = state;

  if (error !== null && error !== undefined) {
    return (
      <div role="alert" className="space-y-3 py-8 text-center">
        <p className="text-lg font-medium">
          {isApiError(error, "not_found")
            ? "This user doesn't exist."
            : isApiError(error)
              ? error.message
              : "Something went wrong."}
        </p>
        {!isApiError(error, "not_found") && (
          <button
            type="button"
            onClick={() => {
              setState({ id, user: null, error: null });
              fetchUser(false);
            }}
            className="rounded-lg border border-neutral-300 px-4 py-2"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <p role="status" className="py-8 text-center text-neutral-600">
        Loading…
      </p>
    );
  }

  const isMe = me?.uid === user.id;

  return (
    <article className="space-y-6">
      <header className="flex items-center gap-4">
        <Avatar src={user.photoUrl} name={user.displayName} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{user.displayName}</h1>
          <p className="text-neutral-600">{formatFollowers(user.followerCount)}</p>
        </div>
        {isMe ? (
          <div className="text-right">
            <p className="text-sm text-neutral-600">This is you</p>
            <Link href="/me" className="font-medium underline">
              Edit profile
            </Link>
          </div>
        ) : (
          <FollowButton
            userId={user.id}
            isFollowing={user.isFollowing}
            onChange={onFollowChange}
          />
        )}
      </header>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Stories</h2>
        <UserTimeline
          userId={user.id}
          ownerName={user.displayName}
          refreshKey={refreshKey}
        />
      </section>
    </article>
  );
}
