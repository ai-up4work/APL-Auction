// lib/tournament/awards.ts
//
// Supabase-backed CRUD for AwardsManager. Mirrors the pattern already
// used by getPrizesForTournament/savePrizesForTournament in
// lib/tournament/tournament.ts, but per-row (create/update/delete)
// instead of one big upsert-the-whole-list call, since Awards has a
// richer per-row form (image, data-derivation config) that benefits
// from immediate save-per-action rather than a single "Save prizes"
// button.
//
// ── TABLE: tournament_award_templates ──
// NOT the pre-existing `tournament_awards` table — that one is shaped
// for recording actual award *winners* after the fact (label, team_id,
// player_name NOT NULL, note, awarded_at), which is a different concept
// from the rich award *templates* this manager edits (title,
// description, type, prize category, image, data-derivation config).
// Reusing `tournament_awards` would violate its `player_name NOT NULL`
// constraint on every insert here, so this writes to a separate table
// instead — see the CREATE TABLE migration provided alongside this file.
//
//   tournament_award_templates
//   id                    uuid primary key default gen_random_uuid()
//   tournament_id         uuid references tournaments(id)
//   title                 text not null
//   description           text not null default ''
//   award_type            text not null default 'individual'  ('individual' | 'team')
//   award_level           text not null default 'tournament'  ('tournament' | 'match')
//     -- 'tournament' = one instance of this award for the whole
//     -- tournament (Best Player, 1st Place Team). 'match' = this award
//     -- concept applies per-match (Man of the Match) — see match_id
//     -- below for whether that means "every match" or "one specific
//     -- match". This is independent of is_data_derived: a manually
//     -- assigned award (picked by hand each time) can still be scoped
//     -- to a specific match.
//   match_id               uuid references matches(id)  (nullable)
//     -- Only meaningful when award_level = 'match'. NULL means this
//     -- award recurs for every match in the tournament (the normal
//     -- "Man of the Match" case). A set value pins this award
//     -- template to that one specific match only (a one-off special
//     -- award for a single game — e.g. "Best Catch, Final"). Applies
//     -- equally whether the winner is auto-derived or manually
//     -- assigned. Always NULL when award_level = 'tournament'.
//   prize_category        text not null default 'cash'  ('cash' | 'physical' | 'badge' | 'experience')
//   prize_value            text  (nullable)
//   image_url              text  (nullable)
//   is_data_derived        boolean not null default false
//   derivation_method      text  (nullable)  ('stat_leader' | 'standings_position')
//     -- 'stat_leader' = winner is whoever ranks Nth in a chosen
//     -- statistic (Top Scorer, Best Bowler, Man of the Match by
//     -- runs...). 'standings_position' = winner is the team sitting
//     -- Nth in the final points table (1st/2nd/3rd place) — only valid
//     -- when award_level = 'tournament', since a single match has no
//     -- "standings".
//   derivation_statistic   text  (nullable)  -- only meaningful when derivation_method = 'stat_leader'
//   derivation_rank        integer (nullable)  -- stat rank OR standings position, depending on derivation_method
//   override_enabled       boolean not null default true
//   created_at             timestamptz not null default now()
//
// If your actual table/columns differ, this is the only file that
// needs to change — AwardsManager only ever calls the functions
// exported below.
//
// ── ASSUMPTION FLAGGED ──
// getMatchesForTournament() below guesses at a `matches` table shape
// (id, tournament_id, team_a_name, team_b_name, round, match_date) so
// the Awards form can offer a match picker. I don't have your actual
// matches schema/lib in context — please check the SELECT below
// against your real `matches` table (or point me at
// lib/tournament/matches.ts / wherever match data already lives, and
// I'll swap this out to reuse it instead of duplicating the query).
//
// ── NOT COVERED HERE ──
// This file only persists award *templates* (the rules for how a
// winner should be picked, and which match if any they're tied to).
// Actually resolving "who is rank-1 in runs across the tournament" or
// "who sits 1st in the standings" or "who's the Man of the Match for
// match #7" into a real winner is a separate concern — that logic
// lives wherever winners get computed / displayed, which isn't in
// scope here.
// ─────────────────────────────────────────────────────────────

const TABLE = "tournament_award_templates"
const MATCHES_TABLE = "matches"

import { supabaseBrowser as supabase } from "@/lib/matches/supabase-browser"

export type DerivationMethod = "stat_leader" | "standings_position"

export interface AwardTemplate {
  id: string
  title: string
  description: string
  awardType: "individual" | "team"
  // 'tournament' = one instance for the whole tournament.
  // 'match' = per-match award — recurs every match, or pins to one
  // specific match (see matchId).
  awardLevel: "tournament" | "match"
  // Only meaningful when awardLevel === 'match'. Undefined/absent
  // means this award applies to every match (e.g. Man of the Match).
  // Set means it's pinned to that one specific match only. Independent
  // of isDataDerived — a manually-assigned award can be match-specific too.
  matchId?: string
  prizeCategory: "cash" | "physical" | "badge" | "experience"
  prizeValue?: string
  imageUrl?: string
  isDataDerived: boolean
  derivationConfig?: {
    method: DerivationMethod
    // Required when method === 'stat_leader'. Ignored for 'standings_position'.
    statistic?: string
    // For 'stat_leader': rank within the statistic (1 = leader).
    // For 'standings_position': final table position (1 = champion, 2 = runner-up, ...).
    rank: number
  }
  overrideEnabled?: boolean
}

export type AwardInput = Omit<AwardTemplate, "id">

interface AwardRow {
  id: string
  tournament_id: string
  title: string
  description: string | null
  award_type: "individual" | "team"
  award_level: "tournament" | "match"
  match_id: string | null
  prize_category: "cash" | "physical" | "badge" | "experience"
  prize_value: string | null
  image_url: string | null
  is_data_derived: boolean
  derivation_method: DerivationMethod | null
  derivation_statistic: string | null
  derivation_rank: number | null
  override_enabled: boolean
  created_at?: string
}

// Lightweight shape for populating the match picker dropdown. Trim or
// extend the SELECT in getMatchesForTournament to match your real
// `matches` table.
export interface MatchOption {
  id: string
  label: string
}

function rowToAward(row: AwardRow): AwardTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    awardType: row.award_type,
    awardLevel: row.award_level ?? "tournament",
    matchId: row.match_id ?? undefined,
    prizeCategory: row.prize_category,
    prizeValue: row.prize_value ?? undefined,
    imageUrl: row.image_url ?? undefined,
    isDataDerived: !!row.is_data_derived,
    derivationConfig:
      row.is_data_derived && row.derivation_method
        ? {
            method: row.derivation_method,
            statistic: row.derivation_statistic ?? undefined,
            rank: row.derivation_rank ?? 1,
          }
        : undefined,
    overrideEnabled: row.override_enabled,
  }
}

function awardToColumns(tournamentId: string, award: AwardInput) {
  const method = award.derivationConfig?.method
  const awardLevel = award.awardLevel || "tournament"

  return {
    tournament_id: tournamentId,
    title: award.title,
    description: award.description,
    award_type: award.awardType,
    award_level: awardLevel,
    match_id: awardLevel === "match" ? award.matchId || null : null,
    prize_category: award.prizeCategory,
    prize_value: award.prizeValue?.trim() ? award.prizeValue.trim() : null,
    image_url: award.imageUrl?.trim() ? award.imageUrl.trim() : null,
    is_data_derived: award.isDataDerived,
    derivation_method: award.isDataDerived ? method || null : null,
    derivation_statistic:
      award.isDataDerived && method === "stat_leader"
        ? award.derivationConfig?.statistic || null
        : null,
    derivation_rank: award.isDataDerived ? award.derivationConfig?.rank ?? 1 : null,
    override_enabled: award.overrideEnabled ?? true,
  }
}

export async function getAwardsForTournament(tournamentId: string): Promise<AwardTemplate[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[awards] load failed:", error)
    throw new Error(error.message)
  }

  return (data as AwardRow[] | null ?? []).map(rowToAward)
}

export async function createAward(tournamentId: string, award: AwardInput): Promise<AwardTemplate | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(awardToColumns(tournamentId, award))
    .select("*")
    .single()

  if (error) {
    console.error("[awards] create failed:", error)
    return null
  }

  return rowToAward(data as AwardRow)
}

export async function updateAward(id: string, award: AwardInput): Promise<boolean> {
  // tournament_id is intentionally omitted here — an award never moves
  // to a different tournament via edit, only created fresh or deleted.
  const { tournament_id, ...columns } = awardToColumns("", award)

  const { error } = await supabase.from(TABLE).update(columns).eq("id", id)

  if (error) {
    console.error("[awards] update failed:", error)
    return false
  }

  return true
}

export async function deleteAward(id: string): Promise<boolean> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id)

  if (error) {
    console.error("[awards] delete failed:", error)
    return false
  }

  return true
}

// Powers the match picker that appears whenever award level is
// "match". See the ASSUMPTION FLAGGED note at the top of this file —
// verify column names against your real `matches` table.
export async function getMatchesForTournament(tournamentId: string): Promise<MatchOption[]> {
  const { data, error } = await supabase
    .from(MATCHES_TABLE)
    .select("id, team_a_name, team_b_name, round, match_date")
    .eq("tournament_id", tournamentId)
    .order("match_date", { ascending: true })

  if (error) {
    console.error("[awards] load matches failed:", error)
    throw new Error(error.message)
  }

  return (data ?? []).map((row: any) => {
    const teams =
      row.team_a_name && row.team_b_name ? `${row.team_a_name} vs ${row.team_b_name}` : null
    const roundLabel = row.round ? `Round ${row.round}` : null
    const label = teams || roundLabel || `Match ${String(row.id).slice(0, 8)}`
    return { id: row.id, label }
  })
}