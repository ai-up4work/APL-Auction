import type {
  BatterState,
  BowlerState,
  LiveState,
  MatchSetup,
  OverlayEvent,
  SquadPlayer,
  TeamInfo,
} from "@/lib/overlayBus";

// ── Rows as they come back from Supabase ────────────────────────────────
export interface DbTeam {
  id: string;
  auction_id: string;
  code: string;
  name: string;
  tier: string;
  owner: string;
  color: string;
  logo: string | null;
  roster: number;
  remaining_purse: number | null;
}

export interface DbPlayer {
  id: string;
  auction_id: string;
  name: string;
  role: string;
  origin: string;
  price: number;
  capped: boolean;
  img: string | null;
  country: string | null;
  sold_to_team_id: string | null;
  sold_price: number | null;
  status: string | null;
  owner_team_code: string | null;
}

export interface OverlayToggle {
  key: string;
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  event: OverlayEvent["type"];
  exclusiveWith?: string;
}

export interface WicketDraft {
  batsmanOut: "striker" | "nonStriker";
  dismissalType: "bowled" | "caught" | "lbw" | "runOut" | "stumped" | "hitWicket";
  fielder: string;
}

export const emptyWicketDraft: WicketDraft = { batsmanOut: "striker", dismissalType: "bowled", fielder: "" };

export const emptyTeam = (): TeamInfo => ({
  name: "",
  shortCode: "",
  color: "#c9971f",
  logoUrl: "",
  squad: [],
  squadPlayers: [],
});

export const emptyMatchSetup: MatchSetup = {
  tournamentName: "",
  season: "",
  tournamentLogoUrl: "",
  venue: "",
  format: "T20",
  matchNumber: "",
  matchTitle: "",
  teamA: emptyTeam(),
  teamB: emptyTeam(),
  tossWinner: "",
  tossDecision: "",
};

export const emptyBatter = (): BatterState => ({ name: "", runs: 0, balls: 0, fours: 0, sixes: 0 });
export const emptyBowler = (): BowlerState => ({ name: "", overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 });

export const emptyLiveState: LiveState = {
  score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
  striker: emptyBatter(),
  nonStriker: emptyBatter(),
  bowler: emptyBowler(),
  partnership: { runs: 0, balls: 0 },
  matchBoundaries: { fours: 0, sixes: 0 },
  tournamentBoundaries: { fours: 0, sixes: 0 },
  pointsTable: [],
};

// Build a team's squad (name + photo + role) from players sold to them,
// highest sale price first.
export function squadFor(teamId: string, players: DbPlayer[]): SquadPlayer[] {
  return players
    .filter((p) => p.sold_to_team_id === teamId)
    .sort((a, b) => (b.sold_price ?? b.price) - (a.sold_price ?? a.price))
    .map((p) => ({ name: p.name, role: p.role, img: p.img }));
}

export function dbTeamToTeamInfo(team: DbTeam, players: DbPlayer[]): TeamInfo {
  const squadPlayers = squadFor(team.id, players);
  return {
    name: team.name,
    shortCode: team.code,
    color: team.color || "#c9971f",
    logoUrl: team.logo || "",
    squad: squadPlayers.map((p) => p.name),
    squadPlayers,
  };
}