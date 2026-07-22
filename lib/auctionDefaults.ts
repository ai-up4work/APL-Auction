// lib/auctionDefaults.ts
//
// FIX: previously this file pre-populated every brand-new auction with a
// hardcoded roster of real IPL teams (CSK, MI, RCB...) and real player
// names (Virat Kohli, Rohit Sharma...) plus fake-but-identical PINs
// (123456, 234578...). That meant every user who clicked "Create New
// Auction" got the exact same data, which looked indistinguishable from
// a leaked/shared auction. New auctions now start genuinely empty — the
// admin adds their own teams and players from a blank slate via the
// Teams/Players tabs, same as any other real auction.
//
// If you want a "load sample data" convenience for demos, that should be
// an explicit opt-in action (e.g. a "Use Demo Data" button on the picker
// that calls a separate seedDemoData() helper), not the default for every
// new auction.

import type { Team, Player } from "@/types/auction";

export const DEFAULT_TEAMS: Omit<Team, "supabaseId" | "roster">[] = [];

export const DEFAULT_PLAYERS: Omit<Player, "supabaseId">[] = [];