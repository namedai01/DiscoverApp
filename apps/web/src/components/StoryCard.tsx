import type { Story } from "@/lib/api/types";
import { timeAgo } from "@/lib/format";
import { Avatar } from "./Avatar";
import { RemoteImage } from "./RemoteImage";

export function StoryCard({
  story,
  onOpen,
}: {
  story: Story;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-left hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <RemoteImage
        src={story.imageUrl}
        alt=""
        className="aspect-[4/3] w-full object-cover"
      />
      <span className="block p-3">
        <span className="block font-semibold">{story.title}</span>
        <span className="mt-1 flex items-center gap-2 text-sm text-neutral-600">
          <Avatar
            src={story.owner.photoUrl}
            name={story.owner.displayName}
            size="sm"
          />
          <span className="min-w-0 flex-1 truncate">
            {story.owner.displayName}
          </span>
          <time dateTime={story.createdAt} suppressHydrationWarning>
            {timeAgo(story.createdAt)}
          </time>
        </span>
      </span>
    </button>
  );
}
