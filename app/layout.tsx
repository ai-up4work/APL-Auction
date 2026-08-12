import "./globals.css";

import type { Metadata, Viewport } from "next";

import { AuctionProvider } from "@/context/AuctionContext";
import { AuthProvider } from "@/context/AuthContext";

const SITE_URL = "https://apl-auction-ochre.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: "Valiant League — Cricket Auction, Tournament & Broadcast Platform",
    template: "%s | Valiant League",
  },

  description:
    "Valiant League is an all-in-one cricket platform for live player auctions, tournament management, scoring and real-time broadcast overlays.",

  keywords: [
    "cricket auction",
    "cricket tournament",
    "cricket tournament management",
    "cricket scoring app",
    "live cricket scoring",
    "live cricket overlay",
    "cricket broadcast graphics",
    "player draft auction",
    "cricket league management",
    "cricket club management",
    "cricket auction software",
  ],

  applicationName: "Valiant League",

  authors: [
    {
      name: "Valiant League",
    },
  ],

  creator: "Valiant League",
  publisher: "Valiant League",

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  icons: {
    icon: [
      {
        url: "/marketing/favicon.ico",
        sizes: "any",
      },
      {
        url: "/marketing/icon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/marketing/icon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/marketing/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/marketing/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        url: "/marketing/icon.svg",
        type: "image/svg+xml",
      },
    ],

    apple: [
      {
        url: "/marketing/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],

    shortcut: [
      {
        url: "/marketing/favicon.ico",
      },
    ],
  },

  manifest: "/marketing/site.webmanifest",

  appleWebApp: {
    capable: true,
    title: "Valiant League",
    statusBarStyle: "black-translucent",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Valiant League",

    title:
      "Valiant League — Cricket Auction, Tournament & Broadcast Platform",

    description:
      "Run live cricket auctions, build tournaments, score matches and broadcast real-time cricket graphics from one connected platform.",

    images: [
      {
        url: "/marketing/og-image.png",
        width: 1200,
        height: 630,
        alt: "Valiant League — Cricket Auction, Tournament & Broadcast Platform",
        type: "image/png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title:
      "Valiant League — Cricket Auction, Tournament & Broadcast Platform",

    description:
      "Live cricket auctions, tournaments, scoring and real-time broadcast overlays in one platform.",

    images: [
      "/marketing/og-image.png",
    ],
  },
};

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
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />

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
          <AuctionProvider>
            {children}
          </AuctionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}