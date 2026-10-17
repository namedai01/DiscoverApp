"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, type AuthState } from "@/lib/auth/context";
import { firebaseConfigError, publicEnv } from "@/lib/env";
import { PhoneSignIn } from "./PhoneSignIn";

// Null in production, so the fake form (and fake-client) never ships: the
// NODE_ENV test is replaced at build time and the import is dropped.
const FakeSignIn =
  process.env.NODE_ENV !== "production"
    ? dynamic(() => import("./FakeSignIn").then((m) => m.FakeSignIn))
    : null;

export function SignInView({ next }: { next: string }) {
  const { status, client, notice } = useAuth();
  const router = useRouter();
  // Only a visitor who arrives already signed in is redirected from here; one
  // who signs in on this page is redirected by the form, after it has
  // created the profile.
  const [arrivedAs, setArrivedAs] = useState<AuthState["status"] | null>(null);
  if (arrivedAs === null && status !== "loading") setArrivedAs(status);

  useEffect(() => {
    if (arrivedAs === "signedIn") router.replace(next);
  }, [arrivedAs, next, router]);

  if (status === "loading") {
    return (
      <p role="status" className="py-8 text-center text-neutral-600">
        Loading…
      </p>
    );
  }
  if (arrivedAs === "signedIn") {
    return (
      <p role="status" className="py-8 text-center text-neutral-600">
        You are signed in. Redirecting…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {notice && (
        <p role="alert" className="rounded-lg bg-neutral-100 px-4 py-2">
          {notice}
        </p>
      )}
      {FakeSignIn && client && "signIn" in client ? (
        <>
          <p className="text-sm text-neutral-600">
            Development sign-in — no Firebase
          </p>
          <FakeSignIn client={client} next={next} />
        </>
      ) : client && "phone" in client ? (
        <PhoneSignIn phoneAuth={client.phone} next={next} />
      ) : (
        <p role="alert" className="text-red-700">
          {firebaseConfigError(publicEnv.firebase) ??
            "Sign-in is unavailable right now. Reload and try again."}
        </p>
      )}
    </div>
  );
}
