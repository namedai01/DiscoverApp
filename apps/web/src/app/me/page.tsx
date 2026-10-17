import type { Metadata } from "next";
import { MyProfile } from "@/components/MyProfile";
import { RequireAuth } from "@/components/RequireAuth";

export const metadata: Metadata = {
  title: "My profile",
  robots: { index: false },
};

export default function MePage() {
  return (
    <RequireAuth reason="see your profile">
      <MyProfile />
    </RequireAuth>
  );
}
