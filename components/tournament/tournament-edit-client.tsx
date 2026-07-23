"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lock, Save, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SiteHeader } from "@/components/landing/site-header"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { useAuth } from "@/context/AuthContext"
import {
  getOrgIdForUser,
  updateTournament,
  type TournamentEditData,
} from "@/lib/tournament/tournament"

interface TournamentEditClientProps {
  tournament: TournamentEditData
}

type GateState = "checking" | "denied" | "allowed"

export default function TournamentEditClient({ tournament }: TournamentEditClientProps) {
  useScrollTop()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [gate, setGate] = useState<GateState>("checking")

  const [name, setName] = useState(tournament.name)
  const [format, setFormat] = useState(tournament.format)
  const [status, setStatus] = useState(tournament.status)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  // ── Auth + org-ownership gate ─────────────────────────────────────────
  // Not signed in -> /login. Signed in but a different (or no) org than
  // the tournament -> denied, with a link back to the public page rather
  // than a silent redirect, so it's clear *why* nothing shows.
  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    let cancelled = false
    getOrgIdForUser(user.id).then((orgId) => {
      if (cancelled) return
      setGate(orgId && orgId === tournament.orgId ? "allowed" : "denied")
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, user, router, tournament.orgId])

  const dirty =
    name !== tournament.name || format !== tournament.format || status !== tournament.status

  const handleSave = async () => {
    if (!dirty) return
    setIsSaving(true)
    setSaveError(null)
    const ok = await updateTournament(tournament.id, { name, format, status })
    setIsSaving(false)
    if (ok) {
      setSavedAt(Date.now())
    } else {
      setSaveError("Couldn't save — please try again.")
    }
  }

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-32 sm:pt-40 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-3xl">
          {gate === "checking" && (
            <p className="text-center text-gray-400">Checking access…</p>
          )}

          {gate === "denied" && (
            <div className="bg-black/50 border border-gold/20 rounded-lg p-8 text-center">
              <Lock className="h-6 w-6 text-gold mx-auto mb-3" />
              <h1 className="text-xl font-bold text-white font-cinzel mb-2">
                You can't edit this tournament
              </h1>
              <p className="text-gray-400 text-sm mb-6">
                This tournament belongs to a different organization than the one on your account.
              </p>
              <Link href={`/tournament/${tournament.id}`}>
                <Button className="bg-gold hover:bg-gold/90 text-black font-bold">
                  Back to tournament
                </Button>
              </Link>
            </div>
          )}

          {gate === "allowed" && (
            <>
              <h1 className="text-3xl font-bold text-white font-cinzel mb-2">Edit Tournament</h1>
              <p className="text-gray-400 text-sm mb-8">
                Changes to Details save immediately here. Other sections need a bit more setup
                before they can be edited — see notes below.
              </p>

              {/* DETAILS — the only section backed by real columns today */}
              <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-bold text-white font-cinzel mb-4">Details</h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Tournament name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-black/50 border-gold/30 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Format</label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value as typeof format)}
                      className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                    >
                      <option value="single_elimination">Single Elimination</option>
                      <option value="double_elimination">Double Elimination</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                    >
                      <option value="setup">Setup</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="live">Live</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <Button
                    onClick={handleSave}
                    disabled={!dirty || isSaving}
                    className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "Saving…" : "Save changes"}
                  </Button>
                  {savedAt && !dirty && (
                    <span className="flex items-center gap-1.5 text-green-500 text-sm">
                      <CheckCircle2 className="h-4 w-4" /> Saved
                    </span>
                  )}
                  {saveError && (
                    <span className="flex items-center gap-1.5 text-red-500 text-sm">
                      <AlertCircle className="h-4 w-4" /> {saveError}
                    </span>
                  )}
                </div>
              </div>

              {/* PLACEHOLDER SECTIONS — need schema before these can save */}
              <PlaceholderSection
                title="Description & Dates"
                note="Needs a description and start_date column on tournaments."
              />
              <PlaceholderSection
                title="Schedule (Fixtures)"
                note="Needs a fixtures table (team1, team2, date, time, venue, status)."
              />
              <PlaceholderSection
                title="Prizes"
                note="Needs a prize_pool column and a prizes table (place, reward)."
              />
              <PlaceholderSection
                title="Social Links"
                note="Needs website, twitter, and discord_url columns on tournaments."
              />

              <div className="bg-black/30 border border-gold/10 rounded-lg p-4 mb-8">
                <p className="text-gray-400 text-xs">
                  <span className="text-gold font-semibold">Squads</span> and{" "}
                  <span className="text-gold font-semibold">Bracket</span> aren't edited here —
                  squads come from your linked auction's results, and the bracket is generated
                  from match data. Update the auction or bracket_matches to change those.
                </p>
              </div>

              <div className="text-center">
                <Link href={`/tournament/${tournament.id}`}>
                  <Button className="bg-gold hover:bg-gold/90 text-black font-bold">
                    Back to tournament page
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

function PlaceholderSection({ title, note }: { title: string; note: string }) {
  return (
    <div className="bg-black/30 border border-gold/10 rounded-lg p-6 mb-6 opacity-60">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-white font-cinzel">{title}</h2>
        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-cinzel">
          Not available yet
        </span>
      </div>
      <p className="text-gray-500 text-sm">{note}</p>
    </div>
  )
}