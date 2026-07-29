"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Shield, UserPlus, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  submitTeamRegistration,
  submitPlayerRegistration,
  getRegistrationCount,
  type RegistrationForm,
} from "@/lib/organization/registrations"
import type { PoolTeamInput, BankPlayerInput } from "@/lib/organization/organization"
import { pageStyles } from "@/data/site-data"

const ROLE_OPTIONS = ["Batter", "Bowler", "All-rounder", "WK-Batter", "Batsman", "Wicket Keeper"]
const TIER_OPTIONS = ["A", "B", "C", "Pro", "Elite", "Legend"]

type Mode = "team" | "player"

function GlobalStyle() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `${pageStyles}\nhtml, body { overflow-x: hidden; max-width: 100%; }`,
      }}
    />
  )
}

function Panel({ children, accent }: { children: React.ReactNode; accent: string | null }) {
  return (
    <div
      className="bg-black/50 border border-gold/20 rounded-lg p-6 md:p-8 shadow-lg shadow-black/40 max-w-xl w-full mx-auto"
      style={accent ? { borderColor: `${accent}66` } : undefined}
    >
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] uppercase tracking-widest text-gold/70 font-cinzel block mb-1.5">{children}</label>
}

/* ────────────────────────────────────────────────────────────────── */
/*  Shared by both /register/[slug] (single-form orgs) and               */
/*  /register/[slug]/[formSlug] (multi-form orgs) — the org and form     */
/*  are just handed in as props, so this component doesn't care which    */
/*  route rendered it.                                                    */
/*                                                                         */
/*  NOTE: teamAvailable/playerAvailable below are a UX convenience —      */
/*  they disable buttons and show "closed" without a round trip. The     */
/*  actual enforcement (open/active/cap) now lives server-side inside     */
/*  submitTeamRegistration/submitPlayerRegistration, which re-check the   */
/*  form fresh right before inserting. So if the counts here are stale    */
/*  (e.g. someone else just filled the last slot), the submit call will   */
/*  come back with `error` set instead of an id, and that's surfaced      */
/*  below rather than assumed to succeed.                                */
/* ────────────────────────────────────────────────────────────────── */

export default function RegistrationFormView({
  org,
  form,
}: {
  org: { id: string; name: string; slug: string }
  form: RegistrationForm
}) {
  const accent = form.accentColor || null

  // ?type=team or ?type=player lets one form be shared as two separate
  // links (e.g. a "team signup" link and a "player signup" link) without
  // creating a second registration_forms row. Only honored if that type
  // is actually open on this form — an invalid or closed request is
  // ignored rather than trusted, and falls back to the normal behavior.
  const searchParams = useSearchParams()
  const requestedType = searchParams.get("type")
  const lockedMode: Mode | null =
    requestedType === "team" && form.teamOpen
      ? "team"
      : requestedType === "player" && form.playerOpen
        ? "player"
        : null

  const [countsLoaded, setCountsLoaded] = useState(false)
  const [teamCount, setTeamCount] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)

  const [mode, setMode] = useState<Mode>(lockedMode ?? (form.teamOpen ? "team" : "player"))

  // If the query param changes after mount (unlikely, but covers
  // client-side navigation between the two link variants), keep mode in
  // sync with the lock rather than stranding it on the old value.
  useEffect(() => {
    if (lockedMode) setMode(lockedMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedMode])
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")

  const [teamName, setTeamName] = useState("")
  const [teamCode, setTeamCode] = useState("")
  const [teamOwner, setTeamOwner] = useState("")
  const [teamTier, setTeamTier] = useState("Pro")
  const [teamColor, setTeamColor] = useState("#e45d35")
  const [teamLogo, setTeamLogo] = useState("")

  const [playerName, setPlayerName] = useState("")
  const [playerRole, setPlayerRole] = useState("Batter")
  const [playerOrigin, setPlayerOrigin] = useState("Local")
  const [playerCountry, setPlayerCountry] = useState("")
  const [playerImg, setPlayerImg] = useState("")
  const [playerCapped, setPlayerCapped] = useState(false)

  useEffect(() => {
    Promise.all([getRegistrationCount(form.id, "team"), getRegistrationCount(form.id, "player")]).then(
      ([t, p]) => {
        setTeamCount(t)
        setPlayerCount(p)
        setCountsLoaded(true)
      }
    )
  }, [form.id])

  const teamFull = form.teamCap != null && teamCount >= form.teamCap
  const playerFull = form.playerCap != null && playerCount >= form.playerCap
  const teamAvailable = form.teamOpen && !teamFull
  const playerAvailable = form.playerOpen && !playerFull

  const canSubmit =
    Boolean(contactName.trim() && contactEmail.trim()) &&
    (mode === "team"
      ? Boolean(teamAvailable && teamName.trim() && teamCode.trim())
      : Boolean(playerAvailable && playerName.trim()))

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError(null)

    const contact = {
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim() || undefined,
    }

    const result =
      mode === "team"
        ? await submitTeamRegistration(
            form.id,
            org.id,
            {
              name: teamName.trim(),
              code: teamCode.trim().toUpperCase(),
              owner: teamOwner.trim() || undefined,
              color: teamColor,
              logo: teamLogo.trim() || undefined,
              tier: teamTier as PoolTeamInput["tier"],
            },
            contact
          )
        : await submitPlayerRegistration(
            form.id,
            org.id,
            {
              name: playerName.trim(),
              role: playerRole as BankPlayerInput["role"],
              origin: playerOrigin,
              country: playerCountry.trim() || undefined,
              img: playerImg.trim() || undefined,
              capped: playerCapped,
            },
            contact
          )

    setIsSubmitting(false)
    if (!result.id) {
      setError(result.error ?? "Couldn't submit your registration — please try again.")
      // The server just told us the real current state (e.g. it filled up
      // or closed since this page loaded) — refresh counts so the UI
      // (disabled buttons, "closed" labels) catches up instead of staying
      // stale and inviting another failed attempt.
      const [t, p] = await Promise.all([getRegistrationCount(form.id, "team"), getRegistrationCount(form.id, "player")])
      setTeamCount(t)
      setPlayerCount(p)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <Panel accent={accent}>
          <div className="text-center">
            <CheckCircle2 className="h-8 w-8 text-gold mx-auto mb-3" />
            <h1 className="text-xl font-bold text-white font-cinzel mb-2">Registration submitted</h1>
            <p className="text-gray-400 text-sm">
              {org.name} will review your {mode === "team" ? "team" : "player"} registration and reach out at{" "}
              <span className="text-gold">{contactEmail}</span> once it's decided.
            </p>
          </div>
        </Panel>
      </main>
    )
  }

  if (countsLoaded && !teamAvailable && !playerAvailable) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <Panel accent={accent}>
          <div className="text-center">
            <AlertCircle className="h-6 w-6 text-gold mx-auto mb-3" />
            <h1 className="text-xl font-bold text-white font-cinzel mb-2">Registration closed</h1>
            <p className="text-gray-400 text-sm">{form.name} isn't accepting new submissions right now.</p>
          </div>
        </Panel>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black px-4 py-12">
      <GlobalStyle />

      {form.bannerUrl ? (
        <div className="max-w-xl mx-auto mb-6 relative h-64 md:h-80 rounded-lg overflow-hidden border border-gold/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {/* Fade the image to black behind the text instead of blurring it —
              a taller, stronger gradient does the legibility work so the
              banner just darkens smoothly into the text rather than
              looking like a frosted panel was dropped on top of it. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-5 pt-16 text-center">
            <span className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
              <Trophy className="w-3.5 h-3.5" /> {org.name}
            </span>
            <h1 className="text-2xl font-bold text-white font-cinzel drop-shadow-md">{form.name}</h1>
            {form.welcomeMessage && (
              <p className="text-gray-200 text-sm mt-2 whitespace-pre-line drop-shadow-md">{form.welcomeMessage}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-xl mx-auto mb-6 text-center">
          <span className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
            <Trophy className="w-3.5 h-3.5" /> {org.name}
          </span>
          <h1 className="text-2xl font-bold text-white font-cinzel">{form.name}</h1>
          {form.welcomeMessage && (
            <p className="text-gray-400 text-sm mt-2 whitespace-pre-line">{form.welcomeMessage}</p>
          )}
        </div>
      )}

      <Panel accent={accent}>
        {/* A form configured for only one type (e.g. a dedicated "Team
            Registration" link with playerOpen permanently false), or one
            visited via a ?type= link that locks it, has no real choice to
            offer — showing a switcher with one button forever disabled
            just looks broken. Only show the toggle when there's no lock
            and the form's settings actually intend to collect both. */}
        {!lockedMode && form.teamOpen && form.playerOpen && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => teamAvailable && setMode("team")}
              disabled={!teamAvailable}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-cinzel uppercase tracking-wide px-3 py-2.5 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === "team" ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
              }`}
            >
              <Shield className="h-3.5 w-3.5" /> {teamAvailable ? "Register a team" : "Team registration full"}
            </button>
            <button
              onClick={() => playerAvailable && setMode("player")}
              disabled={!playerAvailable}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-cinzel uppercase tracking-wide px-3 py-2.5 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === "player" ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" /> {playerAvailable ? "Register as a player" : "Player registration full"}
            </button>
          </div>
        )}

        {(lockedMode || !(form.teamOpen && form.playerOpen)) && (
          <div className="flex items-center gap-2 mb-6 text-xs font-cinzel uppercase tracking-wide text-gold/80">
            {mode === "team" ? <Shield className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            {mode === "team" ? "Team registration" : "Player registration"}
          </div>
        )}

        {mode === "team" ? (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <FieldLabel>Team name</FieldLabel>
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Emberfall Paladins" className="bg-black/50 border-gold/30 text-white" />
              </div>
              <div>
                <FieldLabel>Code</FieldLabel>
                <Input value={teamCode} onChange={(e) => setTeamCode(e.target.value)} placeholder="EFP" maxLength={4} className="bg-black/50 border-gold/30 text-white uppercase" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Owner / captain (optional)</FieldLabel>
                <Input value={teamOwner} onChange={(e) => setTeamOwner(e.target.value)} className="bg-black/50 border-gold/30 text-white" />
              </div>
              <div>
                <FieldLabel>Tier</FieldLabel>
                <select
                  value={teamTier}
                  onChange={(e) => setTeamTier(e.target.value)}
                  className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Team color</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={teamColor}
                    onChange={(e) => setTeamColor(e.target.value)}
                    className="h-10 w-14 rounded-md border border-gold/30 bg-black/50 cursor-pointer"
                  />
                  <Input value={teamColor} onChange={(e) => setTeamColor(e.target.value)} className="bg-black/50 border-gold/30 text-white flex-1" />
                </div>
              </div>
              <div>
                <FieldLabel>Logo URL (optional)</FieldLabel>
                <Input value={teamLogo} onChange={(e) => setTeamLogo(e.target.value)} placeholder="https://…" className="bg-black/50 border-gold/30 text-white" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <FieldLabel>Player name</FieldLabel>
                <Input value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="bg-black/50 border-gold/30 text-white" />
              </div>
              <div>
                <FieldLabel>Role</FieldLabel>
                <select
                  value={playerRole}
                  onChange={(e) => setPlayerRole(e.target.value)}
                  className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FieldLabel>Origin</FieldLabel>
                <select
                  value={playerOrigin}
                  onChange={(e) => setPlayerOrigin(e.target.value)}
                  className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
                >
                  <option value="Local">Local</option>
                  <option value="Overseas">Overseas</option>
                </select>
              </div>
              <div>
                <FieldLabel>Country (optional)</FieldLabel>
                <Input value={playerCountry} onChange={(e) => setPlayerCountry(e.target.value)} className="bg-black/50 border-gold/30 text-white" />
              </div>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={playerCapped} onChange={(e) => setPlayerCapped(e.target.checked)} />
                  Capped (international)
                </label>
              </div>
            </div>
            <div>
              <FieldLabel>Photo URL (optional)</FieldLabel>
              <Input value={playerImg} onChange={(e) => setPlayerImg(e.target.value)} placeholder="https://…" className="bg-black/50 border-gold/30 text-white" />
            </div>
          </div>
        )}

        <div className="border-t border-white/10 pt-4 mb-4">
          <p className="text-[10px] uppercase tracking-widest text-gold/70 font-cinzel mb-3">Your contact details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <FieldLabel>Your name</FieldLabel>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="bg-black/50 border-gold/30 text-white" />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="bg-black/50 border-gold/30 text-white" />
            </div>
          </div>
          <FieldLabel>Phone (optional)</FieldLabel>
          <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="bg-black/50 border-gold/30 text-white" />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="w-full bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
          style={accent ? { backgroundColor: accent } : undefined}
        >
          {isSubmitting ? "Submitting…" : `Submit ${mode === "team" ? "team" : "player"} registration`}
        </Button>
        <p className="text-gray-600 text-xs text-center mt-3">
          Submissions are reviewed by {org.name} before appearing anywhere — you'll hear back by email.
        </p>
      </Panel>
    </main>
  )
}