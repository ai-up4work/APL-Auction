// Ignore TS error for side-effect CSS import when no type declarations are present
// @ts-ignore
import "./globals.css";
import { AuctionProvider } from "@/context/AuctionContext";

export const metadata = {
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
  openGraph: {
    title: "Valiant League",
    description:
      "Run your cricket club's auction, tournament bracket, and live broadcast overlay — all from one connected, real-time platform.",
    siteName: "Valiant League",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Valiant League",
    description:
      "Live points-based auctions, tournament brackets, and real-time broadcast overlays for cricket clubs.",
  },
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
        <AuctionProvider>{children}</AuctionProvider>
      </body>
    </html>
  );
}