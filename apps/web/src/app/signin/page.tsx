import type { Metadata } from "next";
import { SignInView } from "@/components/SignInView";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <SignInView next={safeNext(Array.isArray(next) ? next[0] : next)} />;
}
