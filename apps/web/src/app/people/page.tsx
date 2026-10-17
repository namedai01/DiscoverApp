import type { Metadata } from "next";
import { Suspense } from "react";
import { PeopleList } from "@/components/PeopleList";

export const metadata: Metadata = {
  title: "People",
  robots: { index: false },
};

export default function PeoplePage() {
  // PeopleList reads ?q= on the client; Suspense keeps the page prerenderable.
  return (
    <Suspense fallback={null}>
      <PeopleList />
    </Suspense>
  );
}
