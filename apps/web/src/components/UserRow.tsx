import Link from "next/link";
import type { User } from "@/lib/api/types";
import { formatFollowers } from "@/lib/format";
import { Avatar } from "./Avatar";

export function UserRow({ user }: { user: User }) {
  return (
    <Link
      href={`/u/${encodeURIComponent(user.id)}`}
      className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Avatar src={user.photoUrl} name={user.displayName} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{user.displayName}</span>
        {" · "}
        <span className="text-neutral-600">
          {formatFollowers(user.followerCount)}
        </span>
      </span>
    </Link>
  );
}
