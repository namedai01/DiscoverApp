import type { Metadata } from "next";
import { AccentInit } from "@/components/AccentInit";
import { NavBar } from "@/components/NavBar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { publicEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    template: "%s · Memopin",
    default: "Memopin — places and stories",
  },
  description: "Discover places and the stories people post about them.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AccentInit />
        <OfflineBanner />
        <NavBar />
        <main className="mx-auto max-w-3xl px-4 pt-4 pb-24 md:pt-20 md:pb-8">
          {children}
        </main>
      </body>
    </html>
  );
}
