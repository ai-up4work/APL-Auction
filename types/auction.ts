// types/auction.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all auction-related TypeScript types.
// Imported by AuctionContext, auctionDb, and every Admin tab component.
// ─────────────────────────────────────────────────────────────────────────────

export type AuctionStatus = "setup" | "live" | "paused" | "completed";

// ── Team ──────────────────────────────────────────────────────────────────────
export interface Team {
  /** Local React key (ephemeral, resets on refresh) */
  id: number;
  /** Supabase UUID — undefined until the row is first written */
  supabaseId?: string;

  code:   string;
  name:   string;
  tier:   "Pro" | "Elite" | "Legend" | "A" | "B" | "C";
  owner:  string;
  color:  string;
  logo:   string;
  roster: number;
  pin?:   string;
}

// ── Player ────────────────────────────────────────────────────────────────────
export type PlayerRole =
  | "Batsman"
  | "Batter"
  | "Bowler"
  | "All-rounder"
  | "Wicket Keeper"
  | "WK-Batter";

export interface Player {
  /** Local React key (ephemeral, resets on refresh) */
  id: number;
  /** Supabase UUID — undefined until the row is first written */
  supabaseId?: string;

  name:    string;
  role:    PlayerRole;
  origin:  "Local" | "Overseas" | "local" | "overseas";
  price:   number;
  capped:  boolean;
  img:     string;
  country: string;
}

// ── Auction Rules ─────────────────────────────────────────────────────────────
export interface BiddingTier {
  from:      number;
  to:        number | null;
  increment: number;
}

export interface AuctionRules {
  totalPoints:           number;
  teamSize:              number;
  basePrice:             number;
  targetPlayerCount:     number;   // ← ADDED: how many players must be in pool before launch
  ownerParticipation:    boolean;
  ownerSelfPurchaseCost: number;
  maxOverseasPlayers:    number;
  reservePointsEnforced: boolean;
  maxBidTimeSeconds:     number;
  unsoldReentryRounds:   number;
  tiers:                 BiddingTier[];
}

// ── Session Config ────────────────────────────────────────────────────────────
export interface SessionConfig {
  auctionName:        string;
  auctioneer:         string;
  auctionDate:        string;
  auctionTime:        string;
  venue:              string;
  timerSeconds:       number;
  accessMode:         "private" | "spectator" | "broadcast";
  spectatorLink:      string;
  ownerParticipation: boolean;
  unsoldReintroduce:  boolean;
}

// ── Full Auction State ────────────────────────────────────────────────────────
export interface AuctionState {
  /** Supabase row UUID — null until first save */
  auctionId: string | null;
  status:    AuctionStatus;
  teams:     Team[];
  players:   Player[];
  rules:     AuctionRules;
  session:   SessionConfig;
}

// ── Auction Summary (for list/switcher UI) ────────────────────────────────────
export interface AuctionSummary {
  id:           string;
  name:         string;
  status:       AuctionStatus;
  createdAt:    string;
  launchedAt:   string | null;
  completedAt:  string | null;
  teamCount:    number;
  playerCount:  number;
}

// ── Auction Links ─────────────────────────────────────────────────────────────
export interface OwnerLink {
  teamCode: string;
  teamName: string;
  url:      string;
  pin:      string;
}

export interface AuctionLinks {
  admin:      string;
  spectator:  string;
  live:       string;
  ownerLinks: OwnerLink[];
}