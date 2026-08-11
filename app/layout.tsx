// Ignore TS error for side-effect CSS import when no type declarations are present
// @ts-ignore
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuctionProvider } from "@/context/AuctionContext";
import { AuthProvider } from "@/context/AuthContext";

// TODO: swap in your real production domain — this is what Next.js uses to
// turn every relative URL below (icons, og-image, canonical link) into the
// absolute URL that social crawlers and search engines require.
const SITE_URL = "https://valiantleague.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Valiant League — Live Auction, Tournament & Broadcast Platform",
  description:
    "Valiant League lets cricket clubs and tournament organizers run an entire competition lifecycle from one connected platform: draft players through a live points-based auction, build tournament brackets from the resulting teams, and broadcast matches with real-time overlay graphics — all synced live via Supabase.",
  keywords: [
    "cricket auction",
    "cricket tournament bracket",
    "live cricket overlay",
    "cricket broadcast graphics",
    "player draft auction",
    "cricket scoring app",
  ],
  // Canonical + per-locale alternates, resolved against metadataBase above.
  alternates: {
    canonical: "/",
  },
  // Favicon / touch icon / PWA icon wiring. Next.js injects the right
  // <link> tags into <head> from this — no manual <link rel="icon">
  // needed. All paths are resolved from /public.
  icons: {
    icon: [
      { url: "/marketing/favicon.ico", sizes: "any" },
      { url: "/marketing/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/marketing/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/marketing/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/marketing/icon-512x512.png", sizes: "512x512", type: "image/png" },
      // Modern browsers/OSes that support a scalable favicon
      { url: "/marketing/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/marketing/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/marketing/favicon.ico"],
  },
  manifest: "/marketing/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Valiant League",
  },
  openGraph: {
    title: "Valiant League",
    description:
      "Run your cricket club's auction, tournament bracket, and live broadcast overlay — all from one connected, real-time platform.",
    url: SITE_URL,
    siteName: "Valiant League",
    type: "website",
    images: [
      {
        url: "/marketing/og-image.png",
        width: 1200,
        height: 630,
        alt: "Valiant League — Live Cricket Auction, Tournament & Broadcast Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Valiant League",
    description:
      "Live points-based auctions, tournament brackets, and real-time broadcast overlays for cricket clubs.",
    images: ["/marketing/og-image.png"],
  },
};

// Theme color / viewport config lives in its own export as of Next.js
// 14 (previously part of `metadata.themeColor`, now deprecated there).
export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400..700;1,400..700&family=Inter:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <AuctionProvider>{children}</AuctionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}