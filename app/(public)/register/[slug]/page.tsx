"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2, AlertCircle, CheckCircle2, Shield, UserPlus, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getOrgBySlugForRegistration,
  submitTeamRegistration,
  submitPlayerRegistration,
} from "@/lib/organization/registrations"
import type { OrgSummary, PoolTeamInput, BankPlayerInput } from "@/lib/organization/organization"
import { pageStyles } from "@/data/site-data"

const ROLE_OPTIONS = ["Batter", "Bowler", "All-rounder", "WK-Batter", "Batsman", "Wicket Keeper"]
const TIER_OPTIONS = ["A", "B", "C", "Pro", "Elite", "Legend"]

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 md:p-8 shadow-lg shadow-black/40 max-w-xl w-full mx-auto">
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] uppercase tracking-widest text-gold/70 font-cinzel block mb-1.5">{children}</label>
}

type Mode = "team" | "player"

export default function RegisterPage() {
  const params = useParams<{ slug: string }>()

  const [org, setOrg] = useState<OrgSummary | null>(null)
  const [orgState, setOrgState] = useState<"checking" | "found" | "missing">("checking")

  const [mode, setMode] = useState<Mode>("team")
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Contact
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")

  // Team fields — same shape as PoolTeamInput
  const [teamName, setTeamName] = useState("")
  const [teamCode, setTeamCode] = useState("")
  const [teamOwner, setTeamOwner] = useState("")
  const [teamTier, setTeamTier] = useState("Pro")
  const [teamColor, setTeamColor] = useState("#e45d35")
  const [teamLogo, setTeamLogo] = useState("")

  // Player fields — same shape as BankPlayerInput
  const [playerName, setPlayerName] = useState("")
  const [playerRole, setPlayerRole] = useState("Batter")
  const [playerOrigin, setPlayerOrigin] = useState("Local")
  const [playerCountry, setPlayerCountry] = useState("")
  const [playerImg, setPlayerImg] = useState("")
  const [playerCapped, setPlayerCapped] = useState(false)

  useEffect(() => {
    if (!params?.slug) return
    getOrgBySlugForRegistration(params.slug).then((o) => {
      setOrg(o)
      setOrgState(o ? "found" : "missing")
    })
  }, [params?.slug])

  const canSubmit =
    Boolean(contactName.trim() && contactEmail.trim()) &&
    (mode === "team" ? Boolean(teamName.trim() && teamCode.trim()) : Boolean(playerName.trim()))

  const handleSubmit = async () => {
    if (!org || !canSubmit) return
    setIsSubmitting(true)
    setError(null)

    const contact = {
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim() || undefined,
    }

    const id =
      mode === "team"
        ? await submitTeamRegistration(
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
    if (!id) {
      setError("Couldn't submit your registration — please try again.")
      return
    }
    setSubmitted(true)
  }

  const GlobalStyle = () => (
    <style dangerouslySetInnerHTML={{ __html: `${pageStyles}
html, body { overflow-x: hidden; max-width: 100%; }` }} />
  )

  if (orgState === "checking") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <p className="text-gray-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      </main>
    )
  }

  if (orgState === "missing" || !org) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <Panel>
          <div className="text-center">
            <AlertCircle className="h-6 w-6 text-gold mx-auto mb-3" />
            <h1 className="text-xl font-bold text-white font-cinzel mb-2">Registration link not found</h1>
            <p className="text-gray-400 text-sm">
              Double-check the link with the organizer — this one doesn't match any active tournament.
            </p>
          </div>
        </Panel>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <Panel>
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

  return (
    <main className="min-h-screen bg-black px-4 py-12">
      <GlobalStyle />
      <div className="max-w-xl mx-auto mb-6 text-center">
        <span className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
          <Trophy className="w-3.5 h-3.5" /> {org.name}
        </span>
        <h1 className="text-2xl font-bold text-white font-cinzel">Tournament Registration</h1>
      </div>

      <Panel>
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("team")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-cinzel uppercase tracking-wide px-3 py-2.5 rounded-md border transition-colors ${
              mode === "team" ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
            }`}
          >
            <Shield className="h-3.5 w-3.5" /> Register a team
          </button>
          <button
            onClick={() => setMode("player")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-cinzel uppercase tracking-wide px-3 py-2.5 rounded-md border transition-colors ${
              mode === "player" ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" /> Register as a player
          </button>
        </div>

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