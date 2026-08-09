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
//   prize_category        text not null default 'cash'  ('cash' | 'physical' | 'badge' | 'experience')
//   prize_value           text  (nullable)
//   image_url             text  (nullable)
//   is_data_derived       boolean not null default false
//   derivation_statistic  text  (nullable)
//   derivation_rank       integer (nullable)
//   override_enabled      boolean not null default true
//   created_at            timestamptz not null default now()
//
// If your actual table/columns differ, this is the only file that
// needs to change — AwardsManager only ever calls the four functions
// exported below.
// ─────────────────────────────────────────────────────────────

const TABLE = "tournament_award_templates"

import { supabaseBrowser as supabase } from "@/lib/matches/supabase-browser"

export interface AwardTemplate {
  id: string
  title: string
  description: string
  awardType: "individual" | "team"
  prizeCategory: "cash" | "physical" | "badge" | "experience"
  prizeValue?: string
  imageUrl?: string
  isDataDerived: boolean
  derivationConfig?: {
    statistic: string
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
  prize_category: "cash" | "physical" | "badge" | "experience"
  prize_value: string | null
  image_url: string | null
  is_data_derived: boolean
  derivation_statistic: string | null
  derivation_rank: number | null
  override_enabled: boolean
  created_at?: string
}

function rowToAward(row: AwardRow): AwardTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    awardType: row.award_type,
    prizeCategory: row.prize_category,
    prizeValue: row.prize_value ?? undefined,
    imageUrl: row.image_url ?? undefined,
    isDataDerived: !!row.is_data_derived,
    derivationConfig:
      row.is_data_derived && row.derivation_statistic
        ? { statistic: row.derivation_statistic, rank: row.derivation_rank ?? 1 }
        : undefined,
    overrideEnabled: row.override_enabled,
  }
}

function awardToColumns(tournamentId: string, award: AwardInput) {
  return {
    tournament_id: tournamentId,
    title: award.title,
    description: award.description,
    award_type: award.awardType,
    prize_category: award.prizeCategory,
    prize_value: award.prizeValue?.trim() ? award.prizeValue.trim() : null,
    image_url: award.imageUrl?.trim() ? award.imageUrl.trim() : null,
    is_data_derived: award.isDataDerived,
    derivation_statistic: award.isDataDerived ? award.derivationConfig?.statistic || null : null,
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