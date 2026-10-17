"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/context";

export function RequireAuth({
  reason,
  children,
}: {
  reason: string;
  children: ReactNode;
}) {
  const { status, notice } = useAuth();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <p role="status" className="py-8 text-center text-neutral-600">
        Loading…
      </p>
    );
  }
  if (status === "signedOut") {
    return (
      <div className="space-y-3 py-8 text-center">
        {notice && (
          <p role="alert" className="rounded-lg bg-neutral-100 px-4 py-2">
            {notice}
          </p>
        )}
        <p className="text-lg font-medium">Sign in to {reason}</p>
        <Link
          href={`/signin?next=${encodeURIComponent(pathname)}`}
          className="inline-block rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900"
        >
          Sign in
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
