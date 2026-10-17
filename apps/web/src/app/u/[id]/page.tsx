import type { Metadata } from "next";
import { RequireAuth } from "@/components/RequireAuth";
import { UserProfile } from "@/components/UserProfile";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false },
};

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireAuth reason="see profiles">
      <UserProfile id={id} />
    </RequireAuth>
  );
}
