// app/(protected)/match/[matchId]/edit/page.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Pencil, Save, Plus, Trash2, Users, MapPin, Gavel, Loader2, CheckCircle2, AlertTriangle, Sparkles, Shield, Lock } from "lucide-react"
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

interface EditableSetup {
  tournamentName: string
  round: string
  team1Name: string
  team1Short: string
  team1Logo: string
  team2Name: string
  team2Short: string
  team2Logo: string
  venue: string
  date: string
  time: string
  toss: string
  overs: number
  officials: Officials
  squads: Squad[]
  rosterLocked: boolean
}

const ROLE_OPTIONS = ["Batter", "Bowler", "All-rounder", "WK-Batter"]

const emptyOfficials: Officials = { format: "", umpires: "", thirdUmpire: "", referee: "" }

function emptySquad(teamId: "team1" | "team2"): Squad {
  return { teamId, captain: "", players: [] }
}

function emptySetup(): EditableSetup {
  return {
    tournamentName: "",
    round: "",
    team1Name: "",
    team1Short: "",
    team1Logo: "",
    team2Name: "",
    team2Short: "",
    team2Logo: "",
    venue: "",
    date: "",
    time: "",
    toss: "",
    overs: 20,
    officials: { ...emptyOfficials },
    squads: [emptySquad("team1"), emptySquad("team2")],
    rosterLocked: false,
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

// Reads whatever shape currently exists in match_setup and maps it onto
// the editable form fields, filling in blanks rather than erroring —
// this page needs to work on a match_setup that's missing squads
// entirely just as well as one that's fully populated from a board or
// auction, or already-edited by hand.
function fromRawSetup(raw: Record<string, any> | null): EditableSetup {
  if (!raw) return emptySetup()
  return {
    tournamentName: raw.tournamentName ?? "",
    round: raw.round ?? "",
    team1Name: raw.team1?.name ?? "",
    team1Short: raw.team1?.short ?? "",
    team1Logo: raw.team1?.logo ?? "",
    team2Name: raw.team2?.name ?? "",
    team2Short: raw.team2?.short ?? "",
    team2Logo: raw.team2?.logo ?? "",
    venue: raw.venue ?? "",
    date: raw.date ?? "",
    time: raw.time ?? "",
    toss: raw.toss ?? "",
    overs: typeof raw.overs === "number" ? raw.overs : 20,
    officials: {
      format: raw.officials?.format ?? "",
      umpires: raw.officials?.umpires ?? "",
      thirdUmpire: raw.officials?.thirdUmpire ?? "",
      referee: raw.officials?.referee ?? "",
    },
    squads: normalizeRawSquads(raw),
    rosterLocked: !!raw.rosterLocked,
  }
}

// True if match_setup.squads was in the flat (auction/board-import)
// shape on load — used purely to show a one-time "imported from your
// auction/board" hint banner, not stored anywhere.
function hadFlatSquads(raw: Record<string, any> | null): boolean {
  const rawSquads: any[] = raw && Array.isArray(raw.squads) ? raw.squads : []
  return rawSquads.length > 0 && !isGroupedShape(rawSquads)
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
    round: form.round,
    team1: { name: form.team1Name, short: form.team1Short, logo: form.team1Logo },
    team2: { name: form.team2Name, short: form.team2Short, logo: form.team2Logo },
    venue: form.venue,
    date: form.date,
    time: form.time,
    toss: form.toss,
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
  if (matchErr) throw new Error(`Couldn't read match: ${matchErr.message}`)
  if (!matchRow?.org_id) {
    throw new Error("This match has no org_id set — can't provision an auction record for it.")
  }

  const candidate = matchRow.auction_id?.trim()
  if (candidate) {
    const { data: existingAuction } = await supabase.from("auctions").select("id").eq("id", candidate).maybeSingle()
    if (existingAuction) return candidate // already points at a real auction (or Squad Board) — reuse it
  }

  // The auctions RLS policy requires the row to be tied to a real org
  // and a real signed-in user — omitting either is exactly what a
  // "new row violates row-level security policy" error looks like.
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    throw new Error("Couldn't verify the signed-in user — please sign in again before saving.")
  }

  // No real auction backs this match — provision one keyed to the
  // match's own id, flagged as synthetic, then link matches.auction_id
  // to it so this only has to happen once.
  const auctionId = matchId
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
  if (auctionErr) throw new Error(`Couldn't provision auction record: ${auctionErr.message}`)

  const { error: linkErr } = await supabase.from("matches").update({ auction_id: auctionId }).eq("id", matchId)
  if (linkErr) throw new Error(`Couldn't link match to auction: ${linkErr.message}`)

  return auctionId
}

async function upsertTeam(auctionId: string, code: string, name: string, owner: string): Promise<string | null> {
  if (!code.trim()) return null
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("code", code)
    .maybeSingle()
  if (existing) {
    await supabase.from("teams").update({ name, owner: owner || "Unknown" }).eq("id", existing.id)
    return existing.id
  }
  const { data: inserted, error } = await supabase
    .from("teams")
    .insert({ auction_id: auctionId, code, name, owner: owner || "Unknown" })
    .select("id")
    .single()
  if (error) throw new Error(`Couldn't create team "${name}": ${error.message}`)
  return inserted.id
}

// Returns the id of the players row this squad entry now corresponds
// to — either the existing row it matched/updated, or a freshly
// inserted one. Callers use this to write the id back into
// match_setup so future syncs skip name-matching entirely.
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

  // Prefer matching by id — this is what prevents a rename from
  // forking a duplicate players row, and keeps any balls rows already
  // referencing this player's id correctly anchored.
  if (player.playerId) {
    const { data: existingById } = await supabase
      .from("players")
      .select("id")
      .eq("id", player.playerId)
      .maybeSingle()
    if (existingById) {
      const { error } = await supabase.from("players").update(payload).eq("id", player.playerId)
      if (error) throw new Error(`Couldn't update player "${name}": ${error.message}`)
      return player.playerId
    }
    // playerId was set but no longer resolves (row deleted elsewhere)
    // — fall through to name-matching / insert rather than erroring.
  }

  const { data: existingByName } = await supabase
    .from("players")
    .select("id")
    .eq("auction_id", auctionId)
    .ilike("name", name)
    .maybeSingle()

  if (existingByName) {
    const { error } = await supabase.from("players").update(payload).eq("id", existingByName.id)
    if (error) throw new Error(`Couldn't update player "${name}": ${error.message}`)
    return existingByName.id
  }

  const { data: inserted, error } = await supabase.from("players").insert(payload).select("id").single()
  if (error) throw new Error(`Couldn't create player "${name}": ${error.message}`)
  return inserted.id
}

// Syncs every squad's team + players into the relational tables, and
// returns an updated copy of the squads with each player's `playerId`
// filled in from the sync — callers should fold this back into both
// local form state and match_setup so subsequent saves reuse the ids
// instead of re-matching by name.
async function syncSquadsToPlayers(matchId: string, form: EditableSetup): Promise<SyncOutcome> {
  const matchNameHint = `${form.team1Name || "Team 1"} vs ${form.team2Name || "Team 2"}`
  const auctionId = await resolveAuctionId(matchId, matchNameHint)

  let teamsUpserted = 0
  let playersUpserted = 0
  const updatedSquads: Squad[] = []

  for (const squad of form.squads) {
    const teamName = squad.teamId === "team1" ? form.team1Name : form.team2Name
    const teamCode = squad.teamId === "team1" ? form.team1Short : form.team2Short

    if (!teamCode.trim()) {
      // No short code yet — can't key a team row without one. Leave
      // this squad's players untouched (no ids assigned) rather than
      // failing the whole sync.
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

  return { result: { auctionId, teamsUpserted, playersUpserted }, updatedSquads }
}

// ─────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES — same shell/tokens as the rest of the app
// (OrganizationClient / MatchesTab / TeamsManager / SquadBoardTab), so
// this page reads as part of the same dashboard.
// ─────────────────────────────────────────────────────────────

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-8 shadow-lg shadow-black/40 ${className}`}
    >
      {children}
    </div>
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

      // Fold the resolved playerIds back into local state so future
      // saves reuse them instead of re-matching by name every time.
      setForm((prev) => ({ ...prev, squads: updatedSquads }))

      // Also write the ids back into match_setup itself — otherwise a
      // page refresh would reload squads without playerId and we'd be
      // back to name-matching on the very next save.
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
      // If idLinkErr fires, the players/teams sync itself still
      // succeeded — only the id-linkage write-back failed. The next
      // save will just re-match any missing-id players by name again,
      // so this is a soft failure and not worth surfacing as an error.

      setSyncMsg(
        `Synced to players table (auction ${result.auctionId.slice(0, 8)}…): ${result.teamsUpserted} team${
          result.teamsUpserted === 1 ? "" : "s"
        }, ${result.playersUpserted} player${result.playersUpserted === 1 ? "" : "s"}.`
      )
    } catch (err) {
      setSyncErrorMsg(err instanceof Error ? err.message : "Failed to sync squads to the players table.")
    }
  }

  const xiCount = (squadIndex: number) => form.squads[squadIndex]?.players.filter((p) => p.xi).length ?? 0

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
        <div className="container mx-auto px-4 relative z-10 max-w-4xl space-y-6">
          <div>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
              <Pencil className="w-3.5 h-3.5" />
              Match Editor
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-white font-cinzel mb-2">
              {form.team1Name || "Team 1"} <span className="text-gray-500 font-normal">vs</span> {form.team2Name || "Team 2"}
            </h1>
            <p className="text-gray-400 text-sm">
              Everything here writes directly into <code className="text-gold">match_setup</code> — the same field
              the simulator and live match page both read from.
            </p>
          </div>

          {state === "loading" && (
            <Panel className="flex items-center justify-center gap-3 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
              Loading match data…
            </Panel>
          )}

          {state === "error" && errorMsg && (
            <Panel className="border-red-500/40">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-bold font-cinzel text-sm mb-1">Something went wrong</p>
                  <p className="text-gray-400 text-sm">{errorMsg}</p>
                </div>
              </div>
            </Panel>
          )}

          {state !== "loading" && (
            <>
              {showImportedHint && (
                <div className="flex items-start gap-3 bg-gold/[0.05] border border-gold/25 rounded-lg p-4">
                  <Sparkles className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                  <p className="text-gray-300 text-xs">
                    Squads below were imported from the source this match was created from (auction or Squad Board) —
                    the first 11 players on each side were defaulted into the Playing XI. Review and hit{" "}
                    <span className="text-gold">Save Changes</span> to lock them in.
                  </p>
                </div>
              )}

              {form.rosterLocked && (
                <div className="flex items-start gap-3 bg-white/[0.02] border border-gold/20 rounded-lg p-4">
                  <Lock className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                  <p className="text-gray-300 text-xs">
                    These squads came from a live auction, so rosters are locked here — add, rename, or remove players
                    from the <span className="text-gold">Auctions</span> tab instead. You can still set today's{" "}
                    <span className="text-gold">Playing XI</span> and <span className="text-gold">captain</span> below.
                  </p>
                </div>
              )}

              {/* ── MATCH DETAILS ── */}
              <Panel>
                <div className="flex items-center gap-2 mb-6">
                  <MapPin className="h-4 w-4 text-gold" />
                  <h2 className="text-gold text-xs uppercase tracking-widest font-cinzel">Match Details</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <FieldLabel>Tournament / Series</FieldLabel>
                    <TextInput
                      value={form.tournamentName}
                      onChange={(e) => update("tournamentName", e.target.value)}
                      placeholder="Valiant League — Season 1"
                    />
                  </div>
                  <div>
                    <FieldLabel>Round</FieldLabel>
                    <TextInput
                      value={form.round}
                      onChange={(e) => update("round", e.target.value)}
                      placeholder="Semi Final 1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-end gap-2">
                    <TeamAvatar logo={form.team1Logo} />
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

                <div className="grid grid-cols-1 md:grid-cols-[1fr_9rem] gap-4">
                  <div>
                    <FieldLabel>Toss</FieldLabel>
                    <TextInput
                      value={form.toss}
                      onChange={(e) => update("toss", e.target.value)}
                      placeholder="Emberfall Paladins won the toss and elected to bat"
                    />
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

              {/* ── OFFICIALS & FORMAT ── */}
              <Panel>
                <div className="flex items-center gap-2 mb-6">
                  <Gavel className="h-4 w-4 text-gold" />
                  <h2 className="text-gold text-xs uppercase tracking-widest font-cinzel">Officials &amp; Format</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Format</FieldLabel>
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

              {/* ── SQUADS ── */}
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
                          <h2 className="text-gold text-xs uppercase tracking-widest font-cinzel truncate">{teamName} Squad</h2>
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

              {/* ── SAVE BAR ── */}
              <div className="sticky bottom-4 z-20">
                <Panel className="p-4 md:p-5 flex items-center justify-between flex-wrap gap-3 shadow-2xl shadow-black/60">
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
                </Panel>
              </div>

              <div className="flex items-center justify-center gap-4 pt-2 pb-4">
                <Link href={`/match/${matchId}`} className="text-gold hover:underline text-sm font-cinzel">
                  ← Back to Match
                </Link>
                <span className="text-gray-700">|</span>
                <Link href={`/match/${matchId}/simulate`} className="text-gold hover:underline text-sm font-cinzel">
                  Go to Simulator →
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}