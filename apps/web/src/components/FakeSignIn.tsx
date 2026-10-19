"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useApi } from "@/lib/api/context";
import { validateFakeUid } from "@/lib/auth/fake-client";
import type { FakeAuthClient } from "@/lib/auth/types";
import { safeNext } from "@/lib/safe-next";

export function FakeSignIn({
  client,
  next,
}: {
  client: FakeAuthClient;
  next: string;
}) {
  const api = useApi();
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const id = uid.trim();
    const problem = validateFakeUid(id);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    client.signIn(id);
    try {
      // The first authenticated call creates the profile, as on mobile.
      await api.getMe();
    } catch {
      // Best effort: pages that need the profile report their own errors.
    }
    router.replace(safeNext(next));
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">User id</span>
        <input
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="block w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900 disabled:opacity-50"
      >
        Sign in
      </button>
    </form>
  );
}
