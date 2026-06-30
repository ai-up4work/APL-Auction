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

  /** Position in the shuffled draw order — null until shuffled */
  lotOrder?: number;

  /**
   * The team code this player is a captain/owner of.
   * When set, this player can only be purchased by the matching team,
   * and their base price is overridden to ownerSelfPurchaseCost.
   */
  ownerTeamCode?: string;

  /**
   * True if this player is the captain of their team (ownerTeamCode must
   * also be set). Triggers the restricted-bidding / elevated-base-price
   * rules during the live auction.
   */
  isCaptain?: boolean;

  /**
   * How many re-entry rounds this player has been through.
   * Incremented each time the player goes back into the pool unsold.
   * Mirrors the reentry_count column in the DB.
   */
  reentryCount?: number;

  /**
   * Set to true once the auctioneer marks the auction complete while
   * this player is still unsold — signals they won't be re-entered again.
   * Mirrors is_unsold_final in the DB.
   */
  isUnsoldFinal?: boolean;
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
  /** How many players must be in pool before launch */
  targetPlayerCount:     number;
  ownerParticipation:    boolean;
  /**
   * The base price applied to a captain lot instead of the player's
   * normal price. Defaults to 3000 in DEFAULT_RULES.
   */
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
  auctionLogo:        string;        
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