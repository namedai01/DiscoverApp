import { RemoteImage } from "./RemoteImage";

const SIZES = { sm: "h-8 w-8 text-sm", md: "h-10 w-10", lg: "h-16 w-16 text-2xl" };

export function Avatar({
  src,
  name,
  size = "md",
}: {
  src: string;
  name: string;
  size?: keyof typeof SIZES;
}) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? "?";
  return (
    <RemoteImage
      src={src}
      // Decorative: the name is always shown next to the avatar.
      alt=""
      className={`${SIZES[size]} shrink-0 rounded-full object-cover`}
      fallback={<span className="font-medium">{initial}</span>}
    />
  );
}
