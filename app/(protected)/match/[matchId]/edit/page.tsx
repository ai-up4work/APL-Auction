// app/(protected)/match/[matchId]/edit/page.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Pencil, Save, Plus, Trash2, Users, MapPin, Gavel, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TypeText } from "@/components/landing/type-text"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
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
  team2Name: string
  team2Short: string
  venue: string
  date: string
  time: string
  toss: string
  overs: number
  officials: Officials
  squads: Squad[]
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
    team2Name: "",
    team2Short: "",
    venue: "",
    date: "",
    time: "",
    toss: "",
    overs: 20,
    officials: { ...emptyOfficials },
    squads: [emptySquad("team1"), emptySquad("team2")],
  }
}

// Reads whatever shape currently exists in match_setup and maps it onto
// the editable form fields, filling in blanks rather than erroring —
// this page needs to work on a match_setup that's missing squads
// entirely just as well as one that's fully populated.
function fromRawSetup(raw: Record<string, any> | null): EditableSetup {
  if (!raw) return emptySetup()
  const rawSquads: any[] = Array.isArray(raw.squads) ? raw.squads : []
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

  return {
    tournamentName: raw.tournamentName ?? "",
    round: raw.round ?? "",
    team1Name: raw.team1?.name ?? "",
    team1Short: raw.team1?.short ?? "",
    team2Name: raw.team2?.name ?? "",
    team2Short: raw.team2?.short ?? "",
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
    squads: [squadFor("team1"), squadFor("team2")],
  }
}

// Merges the edited fields back into whatever the raw match_setup blob
// already contained, so runtime-only keys the simulator owns (target,
// currentInnings) survive a save untouched instead of being wiped.
// `playerId` is included on every player entry (as undefined if absent)
// so it round-trips through JSON without extra bookkeeping.
function toRawSetup(raw: Record<string, any> | null, form: EditableSetup): Record<string, any> {
  return {
    ...(raw ?? {}),
    tournamentName: form.tournamentName,
    round: form.round,
    team1: { name: form.team1Name, short: form.team1Short },
    team2: { name: form.team2Name, short: form.team2Short },
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
//  1. This match is genuinely tied to a real auction — `matches.auction_id`
//     already matches a row in `auctions`. Reuse that auction_id as-is,
//     so squads land alongside whatever auction data already exists.
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
// PLAYER IDENTITY — matched by id first, name only as a fallback:
// Each SquadPlayer may carry a `playerId` once it's been synced once.
// upsertPlayer() prefers that id for matching/updating; it only falls
// back to case-insensitive name matching (and then insert-as-new) when
// no id is present, or the id no longer resolves (row deleted
// elsewhere). This stops a rename in the editor from forking a
// duplicate `players` row, and keeps any `balls` rows already pointing
// at that player's id correctly anchored across edits.
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
    .select("auction_id")
    .eq("id", matchId)
    .maybeSingle()
  if (matchErr) throw new Error(`Couldn't read match: ${matchErr.message}`)

  const candidate = matchRow?.auction_id?.trim()
  if (candidate) {
    const { data: existingAuction } = await supabase.from("auctions").select("id").eq("id", candidate).maybeSingle()
    if (existingAuction) return candidate // already points at a real auction — reuse it
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

// Same card shell used on the simulate page and throughout the site.
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-10 shadow-lg shadow-black/40 ${className}`}
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
      className={`w-full bg-black/60 border border-gold/20 rounded-md px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gold/60 transition-colors ${className}`}
    />
  )
}

function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput type="number" {...props} />
}

type SaveState = "idle" | "loading" | "saving" | "saved" | "error"

export default function EditMatchPage() {
  useScrollTop()
  const router = useRouter()
  const params = useParams<{ matchId: string }>()
  const matchId = params?.matchId ?? ""

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [state, setState] = useState<SaveState>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null)
  const [form, setForm] = useState<EditableSetup>(emptySetup())
  const rawSetupRef = useRef<Record<string, any> | null>(null)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

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
      rawSetupRef.current = (data.match_setup as Record<string, any>) ?? null
      setForm(fromRawSetup(rawSetupRef.current))
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

    let savedForm = form

    try {
      const updated = toRawSetup(rawSetupRef.current, form)
      const { error } = await supabase.from("matches").update({ match_setup: updated }).eq("id", matchId)
      if (error) throw new Error(error.message)
      rawSetupRef.current = updated
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
          html, body {
            overflow-x: hidden;
            max-width: 100%;
          }`,
        }}
      />

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      {/* ═══════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════ */}
      <section className="relative pt-28 pb-12 section-pattern bg-black border-b border-gold/10">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 text-center fade-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-md mb-6 bg-gold/10 border border-gold shrink-0">
            <Pencil className="w-6 h-6 text-gold" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 font-cinzel tracking-wider section-title inline-block">
            <TypeText text="Match " speed={45} />
            <TypeText text="Editor" speed={45} delay={220} className="text-gold" />
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mt-4">
            Set teams, venue, officials, format, and squads for this match. Everything here writes directly into{" "}
            <code className="text-gold">match_setup</code> — the same field the simulator and live match page both
            read from.
          </p>
        </div>
      </section>

      <section className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-4xl space-y-8">
          {state === "loading" && (
            <Panel className="fade-in flex items-center justify-center gap-3 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
              Loading match data…
            </Panel>
          )}

          {state === "error" && errorMsg && (
            <Panel className="fade-in border-red-500/40">
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
              {/* ── MATCH DETAILS ── */}
              <Panel className="fade-in-up stagger-1">
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
                  <div className="grid grid-cols-[1fr_5.5rem] gap-2">
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
                  <div className="grid grid-cols-[1fr_5.5rem] gap-2">
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
              <Panel className="fade-in-up stagger-2">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {form.squads.map((squad, squadIndex) => {
                  const teamName = squadIndex === 0 ? form.team1Name || "Team 1" : form.team2Name || "Team 2"
                  const count = squad.players.length
                  const xi = xiCount(squadIndex)
                  return (
                    <Panel key={squad.teamId} className={`fade-in-up stagger-${squadIndex + 3}`}>
                      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Users className="h-4 w-4 text-gold shrink-0" />
                          <h2 className="text-gold text-xs uppercase tracking-widest font-cinzel truncate">{teamName} Squad</h2>
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
                        />
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
                              className="bg-transparent text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none min-w-0"
                            />
                            <select
                              className="select-input select-input-compact"
                              value={player.role}
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
                              title="Remove player"
                              onClick={() => removePlayer(squadIndex, playerIndex)}
                              className="h-8 w-8 rounded-md border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addPlayer(squadIndex)}
                        className="w-full border-gold/40 text-gold hover:bg-gold/10 bg-transparent font-bold font-cinzel uppercase tracking-wide text-xs"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Player
                      </Button>
                    </Panel>
                  )
                })}
              </div>

              {/* ── SAVE BAR ── */}
              <div className="sticky bottom-4 z-20 fade-in-up stagger-5">
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

              <div className="flex items-center justify-center gap-4 pt-4 fade-in">
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