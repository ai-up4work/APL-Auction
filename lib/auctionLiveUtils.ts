// lib/auctionLiveUtils.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities used across live auction pages:
//   - auctioneer  (app/live/[auctionId]/page.tsx)
//   - spectator   (app/watch/[auctionId]/page.tsx)
//   - owner/team  (app/owner/[auctionId]/[teamCode]/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

import type { Team } from "@/types/auction";
import { loadTeamPurses, initTeamPurses } from "./auctionLiveDb";

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING
// Previously defined three times across the three pages as fmtCR / fmtPTS.
// ─────────────────────────────────────────────────────────────────────────────

export function fmtPts(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
// FISHER-YATES SHUFFLE
// Previously duplicated in auctionDb.ts (shufflePlayerOrder) and
// watch/page.tsx (local shuffleArray).  Single source of truth here.
// ─────────────────────────────────────────────────────────────────────────────

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM PURSE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamPurse {
  remaining: number;
  roster:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENSURE TEAM PURSES
// Previously copy-pasted identically into live/page.tsx and watch/page.tsx.
// Loads DB purses, initialises any teams that have never been set up,
// and returns a supabaseId → TeamPurse map.
// ─────────────────────────────────────────────────────────────────────────────

export async function ensureTeamPurses(
  auctionId:   string,
  teams:       Team[],
  totalPoints: number
): Promise<Record<string, TeamPurse>> {
  const dbPurses = await loadTeamPurses(auctionId);

  // Check if any team row has never been initialised (missing from DB result)
  const hasUninitialised =
    teams.some((t) => t.supabaseId && !dbPurses[t.supabaseId]);

  if (hasUninitialised) {
    // Fire-and-forget is intentional: if it fails we just use stale values.
    // Only the auctioneer page should ever hit this branch.
    await initTeamPurses(auctionId, totalPoints).catch(() => {});
    // Re-fetch so we have the freshly-initialised rows
    const fresh = await loadTeamPurses(auctionId);
    return buildPurseMap(teams, fresh, totalPoints);
  }

  return buildPurseMap(teams, dbPurses, totalPoints);
}

function buildPurseMap(
  teams:       Team[],
  dbPurses:    Record<string, TeamPurse>,
  totalPoints: number
): Record<string, TeamPurse> {
  const map: Record<string, TeamPurse> = {};
  for (const t of teams) {
    if (!t.supabaseId) continue;
    map[t.supabaseId] = dbPurses[t.supabaseId] ?? {
      remaining: totalPoints,
      roster:    t.roster ?? 0,
    };
  }
  return map;
}