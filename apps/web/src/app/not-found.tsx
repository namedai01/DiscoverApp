import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-8 text-center">
      <p>We couldn&apos;t find that page.</p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900"
      >
        Back to places
      </Link>
    </div>
  );
}
