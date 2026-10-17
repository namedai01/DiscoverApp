import type { Metadata } from "next";
import { CreateStoryForm } from "@/components/CreateStoryForm";
import { RequireAuth } from "@/components/RequireAuth";

export const metadata: Metadata = {
  title: "Post a story",
  robots: { index: false },
};

export default function PostPage() {
  return (
    <RequireAuth reason="post a story">
      <CreateStoryForm />
    </RequireAuth>
  );
}
