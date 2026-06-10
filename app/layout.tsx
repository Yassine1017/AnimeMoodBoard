import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anime Moodboard",
  description: "Spoiler-free anime recommendations for the mood you are in.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={cn(geistSans.variable, "font-sans")}>
        <div className="min-h-screen">
          <header className="sticky top-0 z-30 border-b border-line bg-ink/78 backdrop-blur-xl">
            <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-ember text-ink shadow-aura">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="hidden text-base font-semibold tracking-normal text-white min-[520px]:inline">
                  Anime Moodboard
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-1 text-sm font-medium text-white/68">
                <Link
                  href="/browse"
                  className="rounded-md px-2 py-2 transition hover:bg-white/8 hover:text-white sm:px-3"
                >
                  Browse
                </Link>
                <Link
                  href="/library"
                  className="rounded-md px-2 py-2 transition hover:bg-white/8 hover:text-white sm:px-3"
                >
                  Library
                </Link>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-1.5 rounded-md border border-ember/40 bg-ember/14 px-2 py-2 font-semibold text-ember transition hover:bg-ember hover:text-ink sm:px-3"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Taste
                </Link>
                <Link
                  href="/profile"
                  className="rounded-md px-2 py-2 transition hover:bg-white/8 hover:text-white sm:px-3"
                >
                  Profile
                </Link>
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
