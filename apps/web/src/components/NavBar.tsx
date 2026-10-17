"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Explore" },
  { href: "/people", label: "People" },
  { href: "/map", label: "Map" },
  { href: "/post", label: "Post" },
  { href: "/me", label: "Me" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-neutral-200 bg-white md:top-0 md:bottom-auto md:h-12 md:border-t-0 md:border-b"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around md:h-full md:items-center md:justify-start md:gap-2 md:px-4">
        {LINKS.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block px-3 py-3 text-center text-sm font-medium md:rounded-full md:py-1.5 ${
                  active
                    ? "bg-accent text-neutral-900"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
