import type { PlayerDetail } from "@/lib/players/players"
import type { PlayerMatchSummary } from "@/components/landing/player-detail-client"

// ─────────────────────────────────────────────────────────────
// BADGES — fully derived, no fetch of its own. Callers pass in
// whatever match history they already loaded (e.g. from
// getPlayerMatchHistory) plus the player's career totals.
//
// Each badge is a self-contained definition with its own `check`.
// To add a badge: append one object to BADGE_DEFINITIONS below —
// nothing else needs to change.
// ─────────────────────────────────────────────────────────────

export interface PlayerBadge {
  id: string
  label: string
  description: string
  earned: boolean
}

export interface BadgeDefinition {
  id: string
  label: string
  description: string
  /** Return true if this badge is earned, given all of the player's
   *  match summaries (already sibling-id-resolved) and their career
   *  totals from PlayerDetail. */
  check: (player: PlayerDetail, matches: PlayerMatchSummary[]) => boolean
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "b1",
    label: "Century Maker",
    description: "Scored 100+ runs in a single innings",
    check: (_player, matches) => matches.some((m) => (m.batting?.runs ?? 0) >= 100),
  },
  {
    id: "b2",
    label: "Hat-trick Hero",
    description: "Took 3 wickets on 3 consecutive legal balls",
    check: (_player, matches) => matches.some((m) => m.hatTrick),
  },
  {
    id: "b3",
    label: "50 Wicket Club",
    description: "50+ career wickets",
    // Career total, not match-derived — doesn't touch `matches` at all.
    check: (player) => (player.wickets ?? 0) >= 50,
  },
  {
    id: "b4",
    label: "Iron Man",
    description: "Played 10+ matches (approximate — season-level tracking coming later)",
    check: (_player, matches) => matches.length >= 10,
  },
  {
    id: "b5",
    label: "Six Machine",
    description: "10+ sixes in a single innings",
    check: (_player, matches) => matches.some((m) => (m.batting?.sixes ?? 0) >= 10),
  },
  {
    id: "b6",
    label: "Match Winner",
    description: "On the winning side in 5+ matches",
    check: (_player, matches) => matches.filter((m) => m.outcome === "won").length >= 5,
  },
  // ── Add new badges here, e.g.:
  // {
  //   id: "b7",
  //   label: "Fifty Fever",
  //   description: "Scored 50+ runs in 5+ different innings",
  //   check: (_player, matches) =>
  //     matches.filter((m) => (m.batting?.runs ?? 0) >= 50).length >= 5,
  // },
]

export function derivePlayerBadges(player: PlayerDetail, matches: PlayerMatchSummary[]): PlayerBadge[] {
  return BADGE_DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label,
    description: def.description,
    earned: def.check(player, matches),
  }))
}