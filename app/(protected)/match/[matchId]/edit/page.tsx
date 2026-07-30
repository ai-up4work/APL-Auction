// app/(protected)/match/[matchId]/edit/page.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Pencil,
  Save,
  Plus,
  Trash2,
  Users,
  MapPin,
  Gavel,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Shield,
  Lock,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { AppHeader } from "@/components/app-header"
import { pageStyles } from "@/data/site-data"
import { supabaseBrowser as supabase } from "@/lib/matches/supabase-browser"

// ─────────────────────────────────────────────────────────────
// TYPES
//
// Mirrors the shape simulate/page.tsx already reads via
// parseMatchSetup / poolFromSetup — this editor writes into the same
// match_setup JSON column on `matches`, so anything saved here is
// immediately picked up by both the simulator and the live match page.
// Runtime-only fields the simulator owns (target, currentInnings) are
// preserved as-is on save rather than edited here, since editing them
// mid-match would desync the live scorecard.
//
// `playerId`, when present, links this jsonb player entry back to a
// specific row in the relational `players` table. It's never shown or
// edited directly in the UI — it's populated automatically after a
// successful sync (see syncSquadsToPlayers) and round-tripped on every
// subsequent load/save so renames update the existing `players` row
// instead of creating a duplicate via name-matching.
//
// `rosterLocked` mirrors `match_setup.rosterLocked`, set once at
// creation time by createFriendlyMatch (organization.ts) — true only
// when this match's teams came from a REAL bidding auction (not a
// Squad Board, and not a standalone/manual match). It can't be derived
// here by looking up `matches.auction_id`, because that column is
// always set to the match's OWN generated id (see resolveAuctionId
// below and createFriendlyMatch) — never to the original source
// auction's id — so the "was this real bidding data" fact has to be
// captured at creation time and just read back here.
//
// ── ADDED FIELDS ──
// `team1Color`/`team2Color`, `matchTitle`, `matchNumber`, `matchMeta`,
// `tossWinner`/`tossDecision`, `tournament`, `tournamentLogoUrl` are
// purely additive: they're new optional keys on match_setup, read with
// blank/default fallbacks and written straight through on save. They
// don't replace `toss` (kept as-is, still free text) or the
// tournamentName/round fields already here — anything that only knows
// the old shape keeps working untouched.
//
// ── SEASON / FORMAT (NEW) ──
// The overlay admin side (MatchSetup in lib/overlayBus.ts) already has
// `season` and an explicit `format: "T20"|"ODI"|"Test"` — this editor
// had neither. `season` is purely additive, same pattern as the fields
// above. `format` used to only be inferrable on the overlay side by
// guessing from `overs` (see guessFormatFromOvers in
// matchPersistence.ts) — that guess still exists as a fallback for old
// rows, but new saves from here write an explicit `format` so nothing
// needs to guess anymore.
//
// ── TOSS (DE-DUPLICATED) ──
// This used to have a manual free-text `toss` field ("X won the toss
// and elected to bat") living alongside the structured `tossWinner` /
// `tossDecision` fields below — the same fact, entered twice, with no
// guarantee they'd agree. `toss` is now auto-derived from
// tossWinner/tossDecision (see the effect in the component) rather than
// directly editable; it's still written into match_setup under the
// same `toss` key so anything already reading that field as plain text
// (the simulator, older overlay reads) keeps working unchanged.
// ─────────────────────────────────────────────────────────────

interface SquadPlayer {
  name: string
  role: string
  xi: boolean
  playerId?: string
}

interface Squad {
  teamId: "team1" | "team2"
  captain: string
  players: SquadPlayer[]
}

interface Officials {
  format: string
  umpires: string
  thirdUmpire: string
  referee: string
}

type MatchFormat = "T20" | "ODI" | "Test"

interface EditableSetup {
  tournamentName: string
  season: string
  round: string
  team1Name: string
  team1Short: string
  team1Logo: string
  team1Color: string
  team2Name: string
  team2Short: string
  team2Logo: string
  team2Color: string
  venue: string
  date: string
  time: string
  toss: string
  format: MatchFormat
  overs: number
  officials: Officials
  squads: Squad[]
  rosterLocked: boolean
  // ── added fields ──
  matchTitle: string
  matchNumber: string
  matchMeta: string
  tossWinner: string
  tossDecision: string
  tournament: string
  tournamentLogoUrl: string
}

const ROLE_OPTIONS = ["Batter", "Bowler", "All-rounder", "WK-Batter"]
const FORMAT_OPTIONS: MatchFormat[] = ["T20", "ODI", "Test"]

const emptyOfficials: Officials = { format: "", umpires: "", thirdUmpire: "", referee: "" }

const DEFAULT_TEAM_COLOR = "#c9971f"

function emptySquad(teamId: "team1" | "team2"): Squad {
  return { teamId, captain: "", players: [] }
}

function emptySetup(): EditableSetup {
  return {
    tournamentName: "",
    season: "",
    round: "",
    team1Name: "",
    team1Short: "",
    team1Logo: "",
    team1Color: DEFAULT_TEAM_COLOR,
    team2Name: "",
    team2Short: "",
    team2Logo: "",
    team2Color: DEFAULT_TEAM_COLOR,
    venue: "",
    date: "",
    time: "",
    toss: "",
    format: "T20",
    overs: 20,
    officials: { ...emptyOfficials },
    squads: [emptySquad("team1"), emptySquad("team2")],
    rosterLocked: false,
    matchTitle: "",
    matchNumber: "",
    matchMeta: "",
    tossWinner: "",
    tossDecision: "",
    tournament: "",
    tournamentLogoUrl: "",
  }
}

// ─────────────────────────────────────────────────────────────
// SQUADS NORMALIZATION
//
// match_setup.squads shows up in TWO different shapes depending on how
// this match was created:
//
//  1. GROUPED shape — what this editor itself writes on save:
//     [{ teamId: "team1", captain: "...", players: [{ name, role, xi, playerId }] }]
//
//  2. FLAT shape — what createFriendlyMatch (organization.ts) writes
//     when a match is created from a Squad Board or a real auction:
//     [{ name, role, team: "<short code>", captain?: boolean }]
//     (Squad Boards are just synthetic auctions under the hood, so
//     both sources produce this exact same flat shape — there's
//     nothing source-specific to branch on here; source-specific
//     behavior is instead driven entirely by `rosterLocked`, see below.)
//
// normalizeRawSquads() detects which shape is present and always
// returns shape #1, so the rest of the page never has to care where
// the data came from.
// ─────────────────────────────────────────────────────────────

function isGroupedShape(rawSquads: any[]): boolean {
  return rawSquads.some((s) => s && typeof s === "object" && "teamId" in s)
}

function normalizeRawSquads(raw: Record<string, any> | null): Squad[] {
  const team1Short = (raw?.team1?.short ?? "").toString().toUpperCase()
  const team2Short = (raw?.team2?.short ?? "").toString().toUpperCase()
  const rawSquads: any[] = raw && Array.isArray(raw.squads) ? raw.squads : []

  if (rawSquads.length === 0) {
    return [emptySquad("team1"), emptySquad("team2")]
  }

  if (isGroupedShape(rawSquads)) {
    const squadFor = (teamId: "team1" | "team2"): Squad => {
      const found = rawSquads.find((s) => s?.teamId === teamId)
      if (!found) return emptySquad(teamId)
      return {
        teamId,
        captain: found.captain ?? "",
        players: Array.isArray(found.players)
          ? found.players.map((p: any) => ({
              name: p?.name ?? "",
              role: p?.role ?? "Batter",
              xi: !!p?.xi,
              playerId: typeof p?.playerId === "string" && p.playerId.trim() ? p.playerId : undefined,
            }))
          : [],
      }
    }
    return [squadFor("team1"), squadFor("team2")]
  }

  // Flat shape from createFriendlyMatch — bucket by short code, falling
  // back to team1 for anything that doesn't clearly match team2's code.
  const team1Players: SquadPlayer[] = []
  const team2Players: SquadPlayer[] = []
  let team1Captain = ""
  let team2Captain = ""

  rawSquads.forEach((p: any) => {
    if (!p) return
    const code = (p.team ?? "").toString().toUpperCase()
    const isTeam2 = !!code && code === team2Short && code !== team1Short
    const name = p.name ?? ""
    const player: SquadPlayer = { name, role: p.role ?? "Batter", xi: false }
    if (isTeam2) {
      team2Players.push(player)
      if (p.captain) team2Captain = name
    } else {
      team1Players.push(player)
      if (p.captain) team1Captain = name
    }
  })

  // Default the first 11 (by original order) on each side into the
  // Playing XI so a freshly-imported roster is immediately usable
  // rather than showing "0/11" until someone manually ticks each box.
  team1Players.slice(0, 11).forEach((p) => (p.xi = true))
  team2Players.slice(0, 11).forEach((p) => (p.xi = true))

  return [
    { teamId: "team1", captain: team1Captain, players: team1Players },
    { teamId: "team2", captain: team2Captain, players: team2Players },
  ]
}

function normalizeFormat(value: unknown): MatchFormat {
  return value === "T20" || value === "ODI" || value === "Test" ? value : "T20"
}

// Reads whatever shape currently exists in match_setup and maps it onto
// the editable form fields, filling in blanks rather than erroring —
// this page needs to work on a match_setup that's missing squads
// entirely just as well as one that's fully populated from a board or
// auction, or already-edited by hand.
function fromRawSetup(raw: Record<string, any> | null): EditableSetup {
  if (!raw) return emptySetup()
  return {
    tournamentName: raw.tournamentName ?? "",
    season: raw.season ?? "",
    round: raw.round ?? "",
    team1Name: raw.team1?.name ?? "",
    team1Short: raw.team1?.short ?? "",
    team1Logo: raw.team1?.logo ?? "",
    team1Color: raw.team1?.color ?? DEFAULT_TEAM_COLOR,
    team2Name: raw.team2?.name ?? "",
    team2Short: raw.team2?.short ?? "",
    team2Logo: raw.team2?.logo ?? "",
    team2Color: raw.team2?.color ?? DEFAULT_TEAM_COLOR,
    venue: raw.venue ?? "",
    date: raw.date ?? "",
    time: raw.time ?? "",
    toss: raw.toss ?? "",
    format: normalizeFormat(raw.format),
    overs: typeof raw.overs === "number" ? raw.overs : 20,
    officials: {
      format: raw.officials?.format ?? "",
      umpires: raw.officials?.umpires ?? "",
      thirdUmpire: raw.officials?.thirdUmpire ?? "",
      referee: raw.officials?.referee ?? "",
    },
    squads: normalizeRawSquads(raw),
    rosterLocked: !!raw.rosterLocked,
    matchTitle: raw.matchTitle ?? "",
    matchNumber: raw.matchNumber ?? "",
    matchMeta: raw.matchMeta ?? "",
    tossWinner: raw.tossWinner ?? "",
    tossDecision: raw.tossDecision ?? "",
    tournament: raw.tournament ?? "",
    tournamentLogoUrl: raw.tournamentLogoUrl ?? "",
  }
}

// True if match_setup.squads was in the flat (auction/board-import)
// shape on load — used purely to show a one-time "imported from your
// auction/board" hint banner, not stored anywhere.
function hadFlatSquads(raw: Record<string, any> | null): boolean {
  const rawSquads: any[] = raw && Array.isArray(raw.squads) ? raw.squads : []
  return rawSquads.length > 0 && !isGroupedShape(rawSquads)
}

// Builds the plain-text toss sentence from the structured fields, so
// there's exactly one place this fact gets composed instead of a
// separately-typed field that can drift out of sync with Toss
// Winner/Toss Decision. Returns "" until both are set.
function composeTossText(tossWinner: string, tossDecision: string): string {
  if (!tossWinner || !tossDecision) return ""
  const decisionText = tossDecision === "bat" ? "bat" : "bowl"
  return `${tossWinner} won the toss and elected to ${decisionText}`
}

// Merges the edited fields back into whatever the raw match_setup blob
// already contained, so runtime-only keys the simulator owns (target,
// currentInnings) survive a save untouched instead of being wiped.
// `playerId` is included on every player entry (as undefined if absent)
// so it round-trips through JSON without extra bookkeeping. Once saved
// once, squads are always written back in the GROUPED shape — the flat
// shape only ever exists on the very first load right after creation.
// `rosterLocked` is passed straight through from what was loaded — this
// page never changes it, only createFriendlyMatch sets it.
function toRawSetup(raw: Record<string, any> | null, form: EditableSetup): Record<string, any> {
  return {
    ...(raw ?? {}),
    tournamentName: form.tournamentName,
    season: form.season,
    round: form.round,
    team1: { name: form.team1Name, short: form.team1Short, logo: form.team1Logo, color: form.team1Color },
    team2: { name: form.team2Name, short: form.team2Short, logo: form.team2Logo, color: form.team2Color },
    venue: form.venue,
    date: form.date,
    time: form.time,
    // Derived, not manually typed — see composeTossText. Written under
    // the same `toss` key so any existing reader of plain toss text
    // keeps working without changes.
    toss: composeTossText(form.tossWinner, form.tossDecision),
    format: form.format,
    overs: form.overs,
    officials: { ...form.officials },
    squads: form.squads.map((s) => ({
      teamId: s.teamId,
      captain: s.captain,
      players: s.players.map((p) => ({
        name: p.name,
        role: p.role,
        xi: p.xi,
        playerId: p.playerId,
      })),
    })),
    rosterLocked: form.rosterLocked,
    matchTitle: form.matchTitle,
    matchNumber: form.matchNumber,
    matchMeta: form.matchMeta,
    tossWinner: form.tossWinner,
    tossDecision: form.tossDecision,
    tournament: form.tournament,
    tournamentLogoUrl: form.tournamentLogoUrl,
  }
}

// ─────────────────────────────────────────────────────────────
// PLAYERS-TABLE SYNC
//
// match_setup.squads is convenient JSON for the live page/simulator,
// but it's not what the relational schema actually wants: `balls`
// references striker_player_id / bowler_player_id / etc. as real FKs
// into `players`, and `players.auction_id` is itself a hard FK into
// `auctions` (NOT NULL — a team or player cannot be inserted without a
// real auction row to point at). So squads saved here also need real
// rows in `players` (and `teams`, since players.sold_to_team_id points
// there too) before those FKs can ever be populated.
//
// Two cases:
//  1. This match is genuinely tied to a real auction (or a Squad Board,
//     which is just a synthetic auction row) — `matches.auction_id`
//     already matches a row in `auctions`. Reuse that auction_id as-is,
//     so squads land alongside whatever data already exists there.
//  2. This is a manual / simulated match with no backing auction.
//     `matches.auction_id` is either missing or doesn't resolve to a
//     real `auctions` row. In that case we provision a minimal
//     `auctions` row using the match's own id as the auction id (a
//     match id and an auction id are both uuids, so this is a safe,
//     stable 1:1 key), flagged `is_synthetic: true` so it's never
//     confused with a real auction by anything that lists/aggregates
//     over `auctions`, then point matches.auction_id at it. Every
//     future save reuses the same auction_id since it's now real.
//
// The provisioned row MUST carry a real org_id and created_by (a real
// auth.users id) — the auctions RLS policy requires both, the same way
// createSquadBoard's created_by has to be a real signed-in user rather
// than an org id. Omitting either throws exactly the RLS violation this
// used to hit.
//
// PLAYER IDENTITY — matched by id first, name only as a fallback:
// Each SquadPlayer may carry a `playerId` once it's been synced once.
// upsertPlayer() prefers that id for matching/updating; it only falls
// back to case-insensitive name matching (and then insert-as-new) when
// no id is present, or the id no longer resolves (row deleted
// elsewhere). This stops a rename in the editor from forking a
// duplicate `players` row, and keeps any `balls` rows already pointing
// at that player's id correctly anchored across edits.
//
// ROSTER-LOCKED matches (form.rosterLocked === true) never reach the
// "insert a brand new player" path in practice, because the UI disables
// adding/renaming/removing players for those squads — see the SQUADS
// section of the page component. This function itself stays generic;
// the lock is purely a UI-level guard, not something enforced here.
// ─────────────────────────────────────────────────────────────

interface SyncResult {
  auctionId: string
  teamsUpserted: number
  playersUpserted: number
  skippedSquads: string[] // human-readable reasons any squad was skipped
}

interface SyncOutcome {
  result: SyncResult
  updatedSquads: Squad[]
}

async function resolveAuctionId(matchId: string, matchNameHint: string): Promise<string> {
  const { data: matchRow, error: matchErr } = await supabase
    .from("matches")
    .select("auction_id, org_id")
    .eq("id", matchId)
    .maybeSingle()

  console.log("[sync] matchRow:", matchRow, "error:", matchErr)

  if (matchErr) throw new Error(`Couldn't read match: ${matchErr.message}`)
  if (!matchRow?.org_id) {
    throw new Error("This match has no org_id set — can't provision an auction record for it.")
  }

  const candidate = matchRow.auction_id?.trim()
  if (candidate) {
    const { data: existingAuction, error: lookupErr } = await supabase
      .from("auctions")
      .select("id")
      .eq("id", candidate)
      .maybeSingle()

    console.log("[sync] existingAuction lookup:", existingAuction, "error:", lookupErr)

    if (lookupErr) {
      throw new Error(`Couldn't verify existing auction link (${candidate}): ${lookupErr.message}`)
    }
    if (existingAuction) {
      console.log("[sync] reusing existing auction:", candidate)
      return candidate
    }
    // candidate was set but doesn't resolve to a real row — fall through
    // and provision fresh below, using the SAME candidate id if it's a
    // valid uuid, so we don't orphan it further.
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    throw new Error("Couldn't verify the signed-in user — please sign in again before saving.")
  }

  const auctionId = candidate || matchId
  console.log("[sync] provisioning new synthetic auction:", auctionId)

  const { error: auctionErr } = await supabase.from("auctions").upsert(
    {
      id: auctionId,
      name: matchNameHint || "Manual Match",
      status: "completed",
      org_id: matchRow.org_id,
      created_by: userData.user.id,
      tournament_opt_out: true,
      is_synthetic: true,
    },
    { onConflict: "id" }
  )
  if (auctionErr) {
    console.error("[sync] auction provisioning failed:", auctionErr)
    throw new Error(`Couldn't provision auction record: ${auctionErr.message}`)
  }

  const { error: linkErr } = await supabase.from("matches").update({ auction_id: auctionId }).eq("id", matchId)
  if (linkErr) {
    console.error("[sync] linking match to auction failed:", linkErr)
    throw new Error(`Couldn't link match to auction: ${linkErr.message}`)
  }

  console.log("[sync] auction resolved/provisioned:", auctionId)
  return auctionId
}

async function upsertTeam(auctionId: string, code: string, name: string, owner: string): Promise<string | null> {
  if (!code.trim()) return null
  const { data: existing, error: findErr } = await supabase
    .from("teams")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("code", code)
    .maybeSingle()

  if (findErr) {
    console.error("[sync] upsertTeam lookup failed:", findErr)
    throw new Error(`Couldn't look up team "${name}" (${code}): ${findErr.message}`)
  }

  if (existing) {
    const { error } = await supabase.from("teams").update({ name, owner: owner || "Unknown" }).eq("id", existing.id)
    if (error) {
      console.error("[sync] upsertTeam update failed:", error)
      throw new Error(`Couldn't update team "${name}": ${error.message}`)
    }
    console.log("[sync] team updated:", name, code, existing.id)
    return existing.id
  }

  const { data: inserted, error } = await supabase
    .from("teams")
    .insert({ auction_id: auctionId, code, name, owner: owner || "Unknown" })
    .select("id")
    .single()

  if (error) {
    console.error("[sync] upsertTeam insert failed:", error)
    throw new Error(`Couldn't create team "${name}": ${error.message}`)
  }
  console.log("[sync] team created:", name, code, inserted.id)
  return inserted.id
}

async function upsertPlayer(
  auctionId: string,
  player: SquadPlayer,
  teamId: string | null,
  teamCode: string,
  captainName: string
): Promise<string> {
  const name = player.name.trim()
  const payload = {
    auction_id: auctionId,
    name,
    role: player.role,
    is_manual_entry: true,
    is_captain: name.toLowerCase() === captainName.trim().toLowerCase(),
    sold_to_team_id: teamId,
    owner_team_code: teamCode || null,
    status: "sold" as const,
  }

  if (player.playerId) {
    const { data: existingById, error: byIdErr } = await supabase
      .from("players")
      .select("id")
      .eq("id", player.playerId)
      .maybeSingle()

    if (byIdErr) {
      console.error("[sync] upsertPlayer id-lookup failed:", byIdErr)
      throw new Error(`Couldn't verify player "${name}" by id: ${byIdErr.message}`)
    }

    if (existingById) {
      const { error } = await supabase.from("players").update(payload).eq("id", player.playerId)
      if (error) {
        console.error("[sync] upsertPlayer update-by-id failed:", error)
        throw new Error(`Couldn't update player "${name}": ${error.message}`)
      }
      console.log("[sync] player updated by id:", name, player.playerId)
      return player.playerId
    }
    // playerId set but no longer resolves — fall through to name-match/insert.
  }

  const { data: existingByName, error: byNameErr } = await supabase
    .from("players")
    .select("id")
    .eq("auction_id", auctionId)
    .ilike("name", name)
    .maybeSingle()

  if (byNameErr) {
    console.error("[sync] upsertPlayer name-lookup failed:", byNameErr)
    throw new Error(`Couldn't look up player "${name}" by name: ${byNameErr.message}`)
  }

  if (existingByName) {
    const { error } = await supabase.from("players").update(payload).eq("id", existingByName.id)
    if (error) {
      console.error("[sync] upsertPlayer update-by-name failed:", error)
      throw new Error(`Couldn't update player "${name}": ${error.message}`)
    }
    console.log("[sync] player updated by name match:", name, existingByName.id)
    return existingByName.id
  }

  const { data: inserted, error } = await supabase.from("players").insert(payload).select("id").single()
  if (error) {
    console.error("[sync] upsertPlayer insert failed:", error)
    throw new Error(`Couldn't create player "${name}": ${error.message}`)
  }
  console.log("[sync] player created:", name, inserted.id)
  return inserted.id
}

async function syncSquadsToPlayers(matchId: string, form: EditableSetup): Promise<SyncOutcome> {
  const matchNameHint = `${form.team1Name || "Team 1"} vs ${form.team2Name || "Team 2"}`
  const auctionId = await resolveAuctionId(matchId, matchNameHint)

  let teamsUpserted = 0
  let playersUpserted = 0
  const updatedSquads: Squad[] = []
  const skippedSquads: string[] = []

  for (const squad of form.squads) {
    const teamName = squad.teamId === "team1" ? form.team1Name : form.team2Name
    const teamCode = squad.teamId === "team1" ? form.team1Short : form.team2Short
    const hasPlayers = squad.players.some((p) => p.name.trim())

    console.log(`[sync] squad ${squad.teamId}: code="${teamCode}" players=${squad.players.length}`)

    if (!teamCode.trim()) {
      if (hasPlayers) {
        // This is almost certainly why players never show up in the DB —
        // surface it loudly instead of silently skipping.
        skippedSquads.push(
          `${teamName || squad.teamId}: no short code set — fill in "Short" above to sync this roster`
        )
      }
      updatedSquads.push(squad)
      continue
    }

    const teamId = await upsertTeam(auctionId, teamCode, teamName || teamCode, squad.captain)
    teamsUpserted += 1

    const updatedPlayers: SquadPlayer[] = []
    for (const player of squad.players) {
      if (!player.name.trim()) {
        updatedPlayers.push(player)
        continue
      }
      const id = await upsertPlayer(auctionId, player, teamId, teamCode, squad.captain)
      playersUpserted += 1
      updatedPlayers.push({ ...player, playerId: id })
    }

    updatedSquads.push({ ...squad, players: updatedPlayers })
  }

  console.log("[sync] done:", { auctionId, teamsUpserted, playersUpserted, skippedSquads })

  return { result: { auctionId, teamsUpserted, playersUpserted, skippedSquads }, updatedSquads }
}

// ─────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES — same shell/tokens as the Tournament Edit page
// (top pill nav + single active section + sticky live-preview rail),
// so this page reads as a sibling of that admin screen instead of a
// one-off form.
// ─────────────────────────────────────────────────────────────

type SectionId = "details" | "info" | "officials" | "squads"

const JUMP_SECTIONS: { id: SectionId; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "info", label: "Info" },
  { id: "officials", label: "Officials" },
  { id: "squads", label: "Squads" },
]

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="w-7 h-7 rounded-md bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-gold" />
      </div>
      <h2 className="text-lg font-bold text-white font-cinzel">{title}</h2>
    </div>
  )
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-black/50 border border-gold/20 rounded-lg p-5 sm:p-6 ${className}`}>{children}</div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] uppercase tracking-widest text-gold/70 font-cinzel block mb-1.5">{children}</label>
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props
  return (
    <input
      {...rest}
      className={`w-full bg-black/60 border border-gold/20 rounded-md px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gold/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    />
  )
}

function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput type="number" {...props} />
}

function ColorInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props
  return (
    <input
      type="color"
      {...rest}
      className={`h-[42px] w-12 rounded-md border border-gold/20 bg-black/60 shrink-0 cursor-pointer ${className}`}
    />
  )
}

function TeamAvatar({ logo }: { logo: string }) {
  return (
    <div className="h-9 w-9 rounded-full flex-shrink-0 border border-white/10 overflow-hidden flex items-center justify-center bg-black/60">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full object-cover" />
      ) : (
        <Shield className="h-4 w-4 text-gray-500" />
      )}
    </div>
  )
}

type SaveState = "idle" | "loading" | "saving" | "saved" | "error"

export default function EditMatchPage() {
  useScrollTop()
  const params = useParams<{ matchId: string }>()
  const matchId = params?.matchId ?? ""

  // ── Which section is open. Only one renders in the middle column at a
  // time, matching the Tournament Edit page — clicking a nav pill swaps
  // it instead of everything being stacked and scrolled past. ─────────
  const [activeSection, setActiveSection] = useState<SectionId>("details")

  const [state, setState] = useState<SaveState>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null)
  const [form, setForm] = useState<EditableSetup>(emptySetup())
  const [showImportedHint, setShowImportedHint] = useState(false)
  const rawSetupRef = useRef<Record<string, any> | null>(null)

  // ── load existing match_setup ──
  useEffect(() => {
    if (!matchId) return
    let cancelled = false

    async function load() {
      setState("loading")
      setErrorMsg(null)
      const { data, error } = await supabase.from("matches").select("id, match_setup").eq("id", matchId).maybeSingle()
      if (cancelled) return
      if (error) {
        setErrorMsg(error.message)
        setState("error")
        return
      }
      if (!data) {
        setErrorMsg("No match found with that id.")
        setState("error")
        return
      }
      const raw = (data.match_setup as Record<string, any>) ?? null
      rawSetupRef.current = raw
      setForm(fromRawSetup(raw))
      setShowImportedHint(hadFlatSquads(raw))
      setState("idle")
    }

    load()
    return () => {
      cancelled = true
    }
  }, [matchId])

  function update<K extends keyof EditableSetup>(key: K, value: EditableSetup[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateOfficials<K extends keyof Officials>(key: K, value: string) {
    setForm((prev) => ({ ...prev, officials: { ...prev.officials, [key]: value } }))
  }

  // ── Toss de-duplication ──
  // `form.toss` is derived, not directly editable (see composeTossText
  // in toRawSetup). Keep it in sync locally too so the preview line
  // below the Toss Winner/Decision selects always reflects the latest
  // choice without waiting for a save round-trip.
  useEffect(() => {
    const computed = composeTossText(form.tossWinner, form.tossDecision)
    if (computed !== form.toss) {
      setForm((prev) => ({ ...prev, toss: computed }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tossWinner, form.tossDecision])

  function updateSquad(index: number, patch: Partial<Squad>) {
    setForm((prev) => {
      const squads = [...prev.squads]
      squads[index] = { ...squads[index], ...patch }
      return { ...prev, squads }
    })
  }

  function addPlayer(squadIndex: number) {
    if (form.rosterLocked) return // belt-and-braces — button is disabled/hidden anyway
    setForm((prev) => {
      const squads = [...prev.squads]
      squads[squadIndex] = {
        ...squads[squadIndex],
        players: [...squads[squadIndex].players, { name: "", role: "Batter", xi: squads[squadIndex].players.length < 11 }],
      }
      return { ...prev, squads }
    })
  }

  function updatePlayer(squadIndex: number, playerIndex: number, patch: Partial<SquadPlayer>) {
    setForm((prev) => {
      const squads = [...prev.squads]
      const players = [...squads[squadIndex].players]
      players[playerIndex] = { ...players[playerIndex], ...patch }
      squads[squadIndex] = { ...squads[squadIndex], players }
      return { ...prev, squads }
    })
  }

  function removePlayer(squadIndex: number, playerIndex: number) {
    if (form.rosterLocked) return // belt-and-braces — button is disabled/hidden anyway
    setForm((prev) => {
      const squads = [...prev.squads]
      squads[squadIndex] = {
        ...squads[squadIndex],
        players: squads[squadIndex].players.filter((_, i) => i !== playerIndex),
      }
      return { ...prev, squads }
    })
  }

  async function handleSave() {
    if (!matchId) return
    setState("saving")
    setErrorMsg(null)
    setSyncMsg(null)
    setSyncErrorMsg(null)

    const savedForm = form

    try {
      const updated = toRawSetup(rawSetupRef.current, form)
      const { error } = await supabase.from("matches").update({ match_setup: updated }).eq("id", matchId)
      if (error) throw new Error(error.message)
      rawSetupRef.current = updated
      setShowImportedHint(false) // once saved, squads are in the grouped shape from here on
      setState("saved")
      setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 2500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save match data.")
      setState("error")
      return // don't attempt the players sync if match_setup itself failed to save
    }

    // Sync squads into the real players/teams tables. Kept separate
    // from the match_setup save above — if this part fails (e.g. a
    // duplicate team code, or an RLS rule blocking the write), the
    // match_setup save has already succeeded and shouldn't be reported
    // as an error too.
    try {
      const { result, updatedSquads } = await syncSquadsToPlayers(matchId, savedForm)

      setForm((prev) => ({ ...prev, squads: updatedSquads }))

      const withIds = {
        ...(rawSetupRef.current ?? {}),
        squads: updatedSquads.map((s) => ({
          teamId: s.teamId,
          captain: s.captain,
          players: s.players.map((p) => ({
            name: p.name,
            role: p.role,
            xi: p.xi,
            playerId: p.playerId,
          })),
        })),
      }
      const { error: idLinkErr } = await supabase.from("matches").update({ match_setup: withIds }).eq("id", matchId)
      if (!idLinkErr) {
        rawSetupRef.current = withIds
      }

      const baseMsg = `Synced to players table (auction ${result.auctionId.slice(0, 8)}…): ${result.teamsUpserted} team${
        result.teamsUpserted === 1 ? "" : "s"
      }, ${result.playersUpserted} player${result.playersUpserted === 1 ? "" : "s"}.`

      setSyncMsg(
        result.skippedSquads.length > 0
          ? `${baseMsg} Skipped — ${result.skippedSquads.join("; ")}`
          : baseMsg
      )
    } catch (err) {
      console.error("[sync] top-level failure:", err)
      setSyncErrorMsg(err instanceof Error ? err.message : "Failed to sync squads to the players table.")
    }
  }

  const xiCount = (squadIndex: number) => form.squads[squadIndex]?.players.filter((p) => p.xi).length ?? 0

  // ── Derived flags for the Setup checklist in the live-preview rail ──
  const teamsNamed = !!(form.team1Name.trim() && form.team2Name.trim())
  const venueDateSet = !!(form.venue.trim() && form.date.trim())
  const squadsHavePlayers = form.squads.every((s) => s.players.some((p) => p.name.trim()))
  const xiComplete = form.squads.every((_, i) => xiCount(i) === 11)
  const tossSet = !!form.toss
  const officialsSet = !!(form.officials.umpires.trim() || form.officials.referee.trim() || form.officials.thirdUmpire.trim())

  const isActive = (id: SectionId) => activeSection === id

  return (
    <main className="overflow-x-hidden max-w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `${pageStyles}
          html, body { overflow-x: hidden; max-width: 100%; }`,
        }}
      />

      <AppHeader title="Match Editor" />

      <section className="pt-28 sm:pt-40 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        {/* Widened from max-w-4xl so the right rail has room to breathe on
            desktop without the content column itself stretching uncomfortably wide. */}
        <div className="container mx-auto px-4 relative z-10 max-w-8xl">
          {state === "loading" && <p className="text-center text-gray-400">Loading match data…</p>}

          {state === "error" && errorMsg && (
            <div className="bg-black/50 border border-red-500/40 rounded-lg p-5 mb-6 max-w-2xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-bold font-cinzel text-sm mb-1">Something went wrong</p>
                  <p className="text-gray-400 text-sm">{errorMsg}</p>
                </div>
              </div>
            </div>
          )}

          {state !== "loading" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
                    <Pencil className="w-3.5 h-3.5" />
                    Match Admin
                  </span>
                  <h1 className="text-3xl font-bold text-white font-cinzel">
                    {form.team1Name || "Team 1"} <span className="text-gray-500 font-normal">vs</span>{" "}
                    {form.team2Name || "Team 2"}
                  </h1>
                </div>
                <Link href={`/match/${matchId}`} className="hidden sm:block shrink-0">
                  <Button className="bg-transparent hover:bg-gold/10 text-gold border border-gold/30 text-xs">
                    Back to match
                  </Button>
                </Link>
              </div>

              <p className="text-gray-400 text-sm mb-6 max-w-2xl">
                Everything below writes directly into <code className="text-gold">match_setup</code> — the same
                field the simulator and live match page both read from. Saving also syncs squads into the
                players table.
              </p>

              {/* ── TOP NAV — mirrors Tournament Edit's section pills ── */}
              <nav className="flex flex-wrap gap-x-1 gap-y-2 mb-8 pb-4 border-b border-gold/10">
                {JUMP_SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    className={`text-[11px] font-cinzel uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${
                      isActive(s.id)
                        ? "text-gold border-gold/40 bg-gold/10"
                        : "text-gray-400 hover:text-gold border-transparent hover:border-gold/20"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </nav>

              {/* ── CONTENT + LIVE PREVIEW ── */}
              <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-12 xl:items-stretch">
                {/* MAIN CONTENT COLUMN — only the active section renders */}
                <div className="min-w-0 xl:sticky xl:top-28 xl:min-h-0 xl:overflow-y-auto xl:pr-2 space-y-6 pb-6">
                  {/* DETAILS */}
                  {activeSection === "details" && (
                    <Panel>
                      <SectionHeading icon={MapPin} title="Match Details" />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <FieldLabel>Tournament / Series</FieldLabel>
                          <TextInput
                            value={form.tournamentName}
                            onChange={(e) => update("tournamentName", e.target.value)}
                            placeholder="Valiant League — Season 1"
                          />
                        </div>
                        <div>
                          <FieldLabel>Season</FieldLabel>
                          <TextInput value={form.season} onChange={(e) => update("season", e.target.value)} placeholder="e.g. 2026" />
                        </div>
                        <div>
                          <FieldLabel>Round</FieldLabel>
                          <TextInput value={form.round} onChange={(e) => update("round", e.target.value)} placeholder="Semi Final 1" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-end gap-2">
                          <TeamAvatar logo={form.team1Logo} />
                          <ColorInput value={form.team1Color} onChange={(e) => update("team1Color", e.target.value)} title="Team 1 color" />
                          <div className="grid grid-cols-[1fr_5.5rem] gap-2 flex-1">
                            <div>
                              <FieldLabel>Team 1 Name</FieldLabel>
                              <TextInput
                                value={form.team1Name}
                                onChange={(e) => update("team1Name", e.target.value)}
                                placeholder="Emberfall Paladins"
                              />
                            </div>
                            <div>
                              <FieldLabel>Short</FieldLabel>
                              <TextInput
                                value={form.team1Short}
                                onChange={(e) => update("team1Short", e.target.value.toUpperCase().slice(0, 4))}
                                placeholder="EMB"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-end gap-2">
                          <TeamAvatar logo={form.team2Logo} />
                          <ColorInput value={form.team2Color} onChange={(e) => update("team2Color", e.target.value)} title="Team 2 color" />
                          <div className="grid grid-cols-[1fr_5.5rem] gap-2 flex-1">
                            <div>
                              <FieldLabel>Team 2 Name</FieldLabel>
                              <TextInput
                                value={form.team2Name}
                                onChange={(e) => update("team2Name", e.target.value)}
                                placeholder="Duskmere Reapers"
                              />
                            </div>
                            <div>
                              <FieldLabel>Short</FieldLabel>
                              <TextInput
                                value={form.team2Short}
                                onChange={(e) => update("team2Short", e.target.value.toUpperCase().slice(0, 4))}
                                placeholder="DUS"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <FieldLabel>Venue</FieldLabel>
                          <TextInput value={form.venue} onChange={(e) => update("venue", e.target.value)} placeholder="Simulated Grounds" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <FieldLabel>Date</FieldLabel>
                            <TextInput type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
                          </div>
                          <div>
                            <FieldLabel>Time</FieldLabel>
                            <TextInput type="time" value={form.time} onChange={(e) => update("time", e.target.value)} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[9rem_1fr] gap-4">
                        <div>
                          <FieldLabel>Format</FieldLabel>
                          <select
                            className="select-input w-full"
                            value={form.format}
                            onChange={(e) => update("format", e.target.value as MatchFormat)}
                          >
                            {FORMAT_OPTIONS.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <FieldLabel>Overs / Side</FieldLabel>
                          <NumberInput
                            min={1}
                            max={50}
                            value={form.overs}
                            onChange={(e) => update("overs", Number(e.target.value) || 20)}
                          />
                        </div>
                      </div>
                    </Panel>
                  )}

                  {/* INFO (additional details) */}
                  {activeSection === "info" && (
                    <Panel>
                      <SectionHeading icon={Info} title="Additional Details" />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <FieldLabel>Match Title</FieldLabel>
                          <TextInput
                            value={form.matchTitle}
                            onChange={(e) => update("matchTitle", e.target.value)}
                            placeholder="The Grand Rematch"
                          />
                        </div>
                        <div>
                          <FieldLabel>Match Number</FieldLabel>
                          <TextInput
                            value={form.matchNumber}
                            onChange={(e) => update("matchNumber", e.target.value)}
                            placeholder="Match 14"
                          />
                        </div>
                      </div>

                      <div className="mb-4">
                        <FieldLabel>Match Meta / Notes</FieldLabel>
                        <TextInput
                          value={form.matchMeta}
                          onChange={(e) => update("matchMeta", e.target.value)}
                          placeholder="Day/night fixture, rain delay expected, etc."
                        />
                      </div>

                      {/* ── Toss — structured entry only. The plain-text
                          sentence is generated from these two fields
                          rather than typed separately, so it can't drift
                          out of sync with what's selected here. ── */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                        <div>
                          <FieldLabel>Toss Winner</FieldLabel>
                          <select
                            className="select-input w-full"
                            value={form.tossWinner}
                            onChange={(e) => update("tossWinner", e.target.value)}
                          >
                            <option value="">Select team…</option>
                            {form.team1Name && <option value={form.team1Name}>{form.team1Name}</option>}
                            {form.team2Name && <option value={form.team2Name}>{form.team2Name}</option>}
                          </select>
                        </div>
                        <div>
                          <FieldLabel>Toss Decision</FieldLabel>
                          <select
                            className="select-input w-full"
                            value={form.tossDecision}
                            onChange={(e) => update("tossDecision", e.target.value)}
                          >
                            <option value="">Elected to…</option>
                            <option value="bat">Bat</option>
                            <option value="bowl">Bowl</option>
                          </select>
                        </div>
                      </div>
                      {form.toss ? (
                        <p className="text-gray-400 text-xs mb-4">Preview: {form.toss}</p>
                      ) : (
                        <p className="text-gray-600 text-xs mb-4">Set both fields above to generate the toss line.</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <FieldLabel>Tournament (ref / slug)</FieldLabel>
                          <TextInput
                            value={form.tournament}
                            onChange={(e) => update("tournament", e.target.value)}
                            placeholder="valiant-league-s1"
                          />
                        </div>
                        <div>
                          <FieldLabel>Tournament Logo URL</FieldLabel>
                          <TextInput
                            value={form.tournamentLogoUrl}
                            onChange={(e) => update("tournamentLogoUrl", e.target.value)}
                            placeholder="https://…"
                          />
                        </div>
                      </div>
                    </Panel>
                  )}

                  {/* OFFICIALS & FORMAT */}
                  {activeSection === "officials" && (
                    <Panel>
                      <SectionHeading icon={Gavel} title="Officials & Format" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <FieldLabel>Format Note</FieldLabel>
                          <TextInput
                            value={form.officials.format}
                            onChange={(e) => updateOfficials("format", e.target.value)}
                            placeholder="T20 · 20 overs per side"
                          />
                        </div>
                        <div>
                          <FieldLabel>Umpires</FieldLabel>
                          <TextInput
                            value={form.officials.umpires}
                            onChange={(e) => updateOfficials("umpires", e.target.value)}
                            placeholder="The Umpires"
                          />
                        </div>
                        <div>
                          <FieldLabel>Third Umpire</FieldLabel>
                          <TextInput
                            value={form.officials.thirdUmpire}
                            onChange={(e) => updateOfficials("thirdUmpire", e.target.value)}
                            placeholder="The Referee"
                          />
                        </div>
                        <div>
                          <FieldLabel>Match Referee</FieldLabel>
                          <TextInput
                            value={form.officials.referee}
                            onChange={(e) => updateOfficials("referee", e.target.value)}
                            placeholder="The Witness"
                          />
                        </div>
                      </div>
                    </Panel>
                  )}

                  {/* SQUADS */}
                  {activeSection === "squads" && (
                    <div className="space-y-5">
                      {showImportedHint && (
                        <div className="flex items-start gap-3 bg-gold/[0.05] border border-gold/25 rounded-lg p-4">
                          <Sparkles className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                          <p className="text-gray-300 text-xs">
                            Squads below were imported from the source this match was created from (auction or
                            Squad Board) — the first 11 players on each side were defaulted into the Playing XI.
                            Review and hit <span className="text-gold">Save Changes</span> to lock them in.
                          </p>
                        </div>
                      )}

                      {form.rosterLocked && (
                        <div className="flex items-start gap-3 bg-white/[0.02] border border-gold/20 rounded-lg p-4">
                          <Lock className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                          <p className="text-gray-300 text-xs">
                            These squads came from a live auction, so rosters are locked here — add, rename, or
                            remove players from the <span className="text-gold">Auctions</span> tab instead. You
                            can still set today's <span className="text-gold">Playing XI</span> and{" "}
                            <span className="text-gold">captain</span> below.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {form.squads.map((squad, squadIndex) => {
                          const teamName = squadIndex === 0 ? form.team1Name || "Team 1" : form.team2Name || "Team 2"
                          const teamLogo = squadIndex === 0 ? form.team1Logo : form.team2Logo
                          const count = squad.players.length
                          const xi = xiCount(squadIndex)
                          const locked = form.rosterLocked
                          return (
                            <Panel key={squad.teamId}>
                              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <TeamAvatar logo={teamLogo} />
                                  <h2 className="text-gold text-xs uppercase tracking-widest font-cinzel truncate">
                                    {teamName} Squad
                                  </h2>
                                  {locked && <Lock className="h-3 w-3 text-gold/60 shrink-0" />}
                                </div>
                                <span
                                  className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                                    xi === 11
                                      ? "border-green-500/40 text-green-400 bg-green-500/5"
                                      : "border-amber-500/30 text-amber-400 bg-amber-500/5"
                                  }`}
                                >
                                  {xi}/11 in XI · {count} total
                                </span>
                              </div>

                              <div className="mb-5">
                                <FieldLabel>Captain</FieldLabel>
                                <TextInput
                                  value={squad.captain}
                                  onChange={(e) => updateSquad(squadIndex, { captain: e.target.value })}
                                  placeholder="Captain name"
                                  list={`${squad.teamId}-players`}
                                />
                                <datalist id={`${squad.teamId}-players`}>
                                  {squad.players.map((p, i) => (p.name ? <option key={i} value={p.name} /> : null))}
                                </datalist>
                              </div>

                              <div className="space-y-2 mb-4">
                                {squad.players.length === 0 && (
                                  <p className="text-gray-500 text-xs text-center py-6 border border-dashed border-gold/10 rounded-md">
                                    No players yet — add the squad below.
                                  </p>
                                )}
                                {squad.players.map((player, playerIndex) => (
                                  <div
                                    key={playerIndex}
                                    className="grid grid-cols-[1fr_7.5rem_2.25rem_2.25rem] gap-2 items-center bg-white/[0.02] border border-gold/10 rounded-md px-2.5 py-2"
                                  >
                                    <input
                                      value={player.name}
                                      onChange={(e) => updatePlayer(squadIndex, playerIndex, { name: e.target.value })}
                                      placeholder={`Player ${playerIndex + 1}`}
                                      disabled={locked}
                                      title={locked ? "Roster locked — edit players from the Auctions tab" : undefined}
                                      className="bg-transparent text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none min-w-0 disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                    <select
                                      className="select-input select-input-compact disabled:opacity-60 disabled:cursor-not-allowed"
                                      value={player.role}
                                      disabled={locked}
                                      title={locked ? "Roster locked — edit players from the Auctions tab" : undefined}
                                      onChange={(e) => updatePlayer(squadIndex, playerIndex, { role: e.target.value })}
                                    >
                                      {ROLE_OPTIONS.map((r) => (
                                        <option key={r} value={r}>
                                          {r}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      title={player.xi ? "In Playing XI" : "On bench"}
                                      onClick={() => updatePlayer(squadIndex, playerIndex, { xi: !player.xi })}
                                      className={`h-8 w-8 rounded-md border flex items-center justify-center text-[10px] font-bold font-cinzel transition-colors ${
                                        player.xi
                                          ? "bg-gold/15 border-gold text-gold"
                                          : "bg-white/[0.02] border-gold/15 text-gray-500 hover:text-gray-300"
                                      }`}
                                    >
                                      XI
                                    </button>
                                    <button
                                      type="button"
                                      title={locked ? "Roster locked — remove players from the Auctions tab" : "Remove player"}
                                      onClick={() => removePlayer(squadIndex, playerIndex)}
                                      disabled={locked}
                                      className="h-8 w-8 rounded-md border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-500/5"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>

                              {locked ? (
                                <p className="text-gray-500 text-[11px] text-center py-2 border border-dashed border-gold/10 rounded-md">
                                  Roster comes from a live auction — manage players on the Auctions tab.
                                </p>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => addPlayer(squadIndex)}
                                  className="w-full border-gold/40 text-gold hover:bg-gold/10 bg-transparent font-bold font-cinzel uppercase tracking-wide text-xs"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Player
                                </Button>
                              )}
                            </Panel>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="text-center xl:hidden mt-2">
                    <Link href={`/match/${matchId}`}>
                      <Button className="bg-gold hover:bg-gold/90 text-black font-bold">Back to match</Button>
                    </Link>
                  </div>
                </div>

                {/* ── RIGHT RAIL — xl-only live preview, mirrors the
                    Tournament Edit page's sticky rail. ─────────────────── */}
                <aside className="hidden xl:flex xl:sticky xl:top-28">
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 font-cinzel block">
                        Live Preview
                      </span>
                      <div className="bg-black/50 border border-gold/20 rounded-lg overflow-hidden p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamAvatar logo={form.team1Logo} />
                            <span className="text-white font-cinzel font-bold text-sm truncate">
                              {form.team1Short || form.team1Name || "TM1"}
                            </span>
                          </div>
                          <span className="text-gray-500 text-xs font-cinzel shrink-0">vs</span>
                          <div className="flex items-center gap-2 min-w-0 justify-end">
                            <span className="text-white font-cinzel font-bold text-sm truncate">
                              {form.team2Short || form.team2Name || "TM2"}
                            </span>
                            <TeamAvatar logo={form.team2Logo} />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="text-[9px] uppercase tracking-wider font-cinzel px-2 py-0.5 rounded-full border border-gold/30 text-gold bg-gold/5">
                            {form.format} · {form.overs} ov
                          </span>
                          {form.tournamentName && (
                            <span className="text-[9px] uppercase tracking-wider font-cinzel px-2 py-0.5 rounded-full border border-white/15 text-gray-300 truncate max-w-[9rem]">
                              {form.tournamentName}
                            </span>
                          )}
                        </div>

                        <dl className="space-y-1.5 text-xs">
                          <div className="flex justify-between gap-2">
                            <dt className="text-gray-500">Venue</dt>
                            <dd className="text-gray-300 text-right truncate max-w-[9rem]">{form.venue || "—"}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-gray-500">Date</dt>
                            <dd className="text-gray-300">
                              {[form.date, form.time].filter(Boolean).join(" · ") || "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-gray-500">Toss</dt>
                            <dd className="text-gray-300 text-right truncate max-w-[9rem]">
                              {form.toss ? `${form.tossWinner} — ${form.tossDecision}` : "—"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    {/* Setup checklist */}
                    <div className="bg-black/50 border border-gold/20 rounded-lg p-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 font-cinzel block">
                        Setup checklist
                      </span>
                      <ul className="space-y-2 text-xs">
                        <li className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${teamsNamed ? "bg-green-500" : "bg-gray-600"}`} />
                          <span className={teamsNamed ? "text-gray-300" : "text-gray-500"}>Teams named</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${venueDateSet ? "bg-green-500" : "bg-gray-600"}`} />
                          <span className={venueDateSet ? "text-gray-300" : "text-gray-500"}>Venue &amp; date set</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              squadsHavePlayers ? "bg-green-500" : "bg-gray-600"
                            }`}
                          />
                          <span className={squadsHavePlayers ? "text-gray-300" : "text-gray-500"}>Squads added</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${xiComplete ? "bg-green-500" : "bg-gray-600"}`} />
                          <span className={xiComplete ? "text-gray-300" : "text-gray-500"}>Playing XI complete (11/11 each)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${tossSet ? "bg-green-500" : "bg-gray-600"}`} />
                          <span className={tossSet ? "text-gray-300" : "text-gray-500"}>Toss recorded</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${officialsSet ? "bg-green-500" : "bg-gray-600"}`} />
                          <span className={officialsSet ? "text-gray-300" : "text-gray-500"}>Officials set</span>
                        </li>
                      </ul>
                    </div>

                    {/* Squads summary */}
                    <div className="bg-black/50 border border-gold/20 rounded-lg p-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 font-cinzel block">
                        Squads
                      </span>
                      <ul className="space-y-1.5 text-xs">
                        {form.squads.map((s, i) => (
                          <li key={s.teamId} className="flex justify-between gap-2">
                            <span className="text-gray-500 truncate">
                              {i === 0 ? form.team1Short || form.team1Name || "Team 1" : form.team2Short || form.team2Name || "Team 2"}
                            </span>
                            <span className="text-gray-300">
                              {xiCount(i)}/11 · {s.players.length} total
                            </span>
                          </li>
                        ))}
                      </ul>
                      {form.rosterLocked && (
                        <p className="text-gray-500 text-[10px] mt-2 flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" /> Rosters locked (from auction)
                        </p>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SAVE BAR — global, since Details/Info/Officials/Squads all
          write into the same match_setup blob in a single save (unlike
          Tournament Edit, where each section has its own save action). ── */}
      {state !== "loading" && (
        <div className="sticky bottom-4 z-20 px-4">
          <div className="container mx-auto max-w-8xl">
            <div className="bg-[#0a0a0a] border border-gold/30 rounded-lg p-4 md:p-5 flex items-center justify-between flex-wrap gap-3 shadow-2xl shadow-black/60">
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-center gap-2">
                  {state === "saving" && (
                    <span className="flex items-center gap-2 text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin text-gold" /> Saving…
                    </span>
                  )}
                  {state === "saved" && (
                    <span className="flex items-center gap-2 text-green-400 font-cinzel">
                      <CheckCircle2 className="h-4 w-4" /> Saved
                    </span>
                  )}
                  {state === "error" && errorMsg && (
                    <span className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="h-4 w-4" /> {errorMsg}
                    </span>
                  )}
                  {state === "idle" && !syncMsg && !syncErrorMsg && (
                    <span className="text-gray-500">Unsaved changes are kept locally until you save.</span>
                  )}
                </div>
                {syncMsg && (
                  <span className="flex items-center gap-2 text-gray-400 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" /> {syncMsg}
                  </span>
                )}
                {syncErrorMsg && (
                  <span className="flex items-center gap-2 text-amber-400 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Players sync: {syncErrorMsg}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/match/${matchId}`}>
                  <Button variant="outline" className="border-gold/40 text-gold hover:bg-gold/10 bg-transparent font-bold">
                    Cancel
                  </Button>
                </Link>
                <Button
                  onClick={handleSave}
                  disabled={state === "saving"}
                  className="bg-gold hover:bg-gold/90 text-black font-bold font-cinzel uppercase tracking-wide text-xs px-6 disabled:opacity-50"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}