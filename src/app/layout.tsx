import type { Metadata } from "next";
import { Suspense } from "react";
import { Alfa_Slab_One, Barlow_Condensed, Geist_Mono, Lora } from "next/font/google";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

// Design system fonts (see .claude/skills/ui-design-system/SKILL.md).
const slab = Alfa_Slab_One({ weight: "400", subsets: ["latin"], variable: "--font-slab" });
const condensed = Barlow_Condensed({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-condensed" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Donation Manager",
  description: "Give to a campaign and see the difference your donation makes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = `${slab.variable} ${condensed.variable} ${lora.variable} ${geistMono.variable}`;
  return (
    <html lang="en" className={`${fonts} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="heading sr-only bg-yellow px-4 py-2 text-navy-dark focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <header className="on-dark bg-navy text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-heading text-2xl leading-none font-bold uppercase tracking-wide">
              Donation <span className="text-yellow">Manager</span>
            </Link>
            {/* Reads the session cookie, so it streams in behind its own boundary. */}
            <Suspense fallback={<div className="h-11" />}>
              <SiteNav />
            </Suspense>
          </div>
        </header>
        <main id="main" className="main-pad mx-auto w-full max-w-6xl flex-1 px-4">
          {children}
        </main>
        <footer className="on-dark bg-navy-dark py-5 text-center text-sm text-white/85">
          Demo project · Stripe test mode only · no real money moves
        </footer>
      </body>
    </html>
  );
}
