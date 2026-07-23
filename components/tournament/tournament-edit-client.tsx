"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lock, Save, CheckCircle2, AlertCircle, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SiteHeader } from "@/components/landing/site-header"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { useAuth } from "@/context/AuthContext"
import {
  getOrgIdForUser,
  updateTournament,
  getPrizesForTournament,
  savePrizesForTournament,
  type TournamentEditData,
} from "@/lib/tournament/tournament"
import {
  hasBracketGenerated,
  generateBracketForTournament,
  deleteBracketForTournament,
  type SeedingMethod,
} from "@/lib/tournament/generateBracket"
import TeamsManager from "@/components/tournament/TeamsManager"

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
  const [category, setCategory] = useState(tournament.category ?? "")
  const [description, setDescription] = useState(tournament.description)
  const [startDate, setStartDate] = useState(tournament.startDate)
  const [imageUrl, setImageUrl] = useState(tournament.imageUrl)
  const [prizePool, setPrizePool] = useState(tournament.prizePool)
  const [website, setWebsite] = useState(tournament.website)
  const [twitter, setTwitter] = useState(tournament.twitter)
  const [discord, setDiscord] = useState(tournament.discord)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // ── Prizes — separate table, separate save flow ──────────────────────
  const [prizes, setPrizes] = useState<{ place: string; reward: string }[]>([])
  const [savedPrizes, setSavedPrizes] = useState<{ place: string; reward: string }[]>([])
  const [prizesLoaded, setPrizesLoaded] = useState(false)
  const [isSavingPrizes, setIsSavingPrizes] = useState(false)
  const [prizesSaveError, setPrizesSaveError] = useState<string | null>(null)
  const [prizesSavedAt, setPrizesSavedAt] = useState<number | null>(null)

  // ── Bracket — generated from the linked auction's teams, its own flow ─
  const [bracketExists, setBracketExists] = useState<boolean | null>(null)
  const [seedingMethod, setSeedingMethod] = useState<SeedingMethod>("random")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateSuccess, setGenerateSuccess] = useState(false)

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
      const allowed = !!orgId && orgId === tournament.orgId
      setGate(allowed ? "allowed" : "denied")
      if (allowed) {
        getPrizesForTournament(tournament.id).then((p) => {
          if (cancelled) return
          setPrizes(p)
          setSavedPrizes(p)
          setPrizesLoaded(true)
        })
        hasBracketGenerated(tournament.id).then((exists) => {
          if (cancelled) return
          setBracketExists(exists)
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, user, router, tournament.orgId, tournament.id])

  const dirty =
    name !== tournament.name ||
    format !== tournament.format ||
    status !== tournament.status ||
    category !== (tournament.category ?? "") ||
    description !== tournament.description ||
    startDate !== tournament.startDate ||
    imageUrl !== tournament.imageUrl ||
    prizePool !== tournament.prizePool ||
    website !== tournament.website ||
    twitter !== tournament.twitter ||
    discord !== tournament.discord

  const handleSave = async () => {
    if (!dirty) return
    setIsSaving(true)
    setSaveError(null)
    const ok = await updateTournament(tournament.id, {
      name,
      format,
      status,
      category: category ? (category as "Auction" | "Bracket" | "Overlay" | "League") : undefined,
      description,
      startDate,
      imageUrl,
      prizePool,
      website,
      twitter,
      discord,
    })
    setIsSaving(false)
    if (ok) {
      setSavedAt(Date.now())
    } else {
      setSaveError("Couldn't save — please try again.")
    }
  }

  const prizesDirty = JSON.stringify(prizes) !== JSON.stringify(savedPrizes)

  const addPrizeRow = () => setPrizes((prev) => [...prev, { place: "", reward: "" }])
  const removePrizeRow = (i: number) => setPrizes((prev) => prev.filter((_, idx) => idx !== i))
  const updatePrizeRow = (i: number, field: "place" | "reward", value: string) =>
    setPrizes((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)))

  const handleSavePrizes = async () => {
    if (!prizesDirty) return
    setIsSavingPrizes(true)
    setPrizesSaveError(null)
    // Drop fully-empty rows before saving rather than persisting blanks.
    const cleaned = prizes.filter((p) => p.place.trim() || p.reward.trim())
    const ok = await savePrizesForTournament(tournament.id, cleaned)
    setIsSavingPrizes(false)
    if (ok) {
      setPrizes(cleaned)
      setSavedPrizes(cleaned)
      setPrizesSavedAt(Date.now())
    } else {
      setPrizesSaveError("Couldn't save prizes — please try again.")
    }
  }

  const handleGenerateBracket = async () => {
    setIsGenerating(true)
    setGenerateError(null)
    setGenerateSuccess(false)
    const result = await generateBracketForTournament(tournament.id, seedingMethod)
    setIsGenerating(false)
    if (result.ok) {
      setBracketExists(true)
      setGenerateSuccess(true)
    } else {
      setGenerateError(result.error ?? "Couldn't generate the bracket.")
    }
  }

  const handleRegenerateBracket = async () => {
    setIsGenerating(true)
    setGenerateError(null)
    setGenerateSuccess(false)
    const del = await deleteBracketForTournament(tournament.id)
    if (!del.ok) {
      setIsGenerating(false)
      setGenerateError(del.error ?? "Couldn't clear the existing bracket.")
      return
    }
    const result = await generateBracketForTournament(tournament.id, seedingMethod)
    setIsGenerating(false)
    if (result.ok) {
      setGenerateSuccess(true)
    } else {
      setGenerateError(result.error ?? "Couldn't generate the bracket.")
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
              <Link href={`/tournaments/${tournament.id}`}>
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
                Details, Prizes, and Bracket save immediately. Schedule and Awards are read-only
                here for now — see notes below.
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
                      <option value="round_robin">Round Robin</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                    >
                      <option value="">Not set</option>
                      <option value="Auction">Auction</option>
                      <option value="Bracket">Bracket</option>
                      <option value="Overlay">Overlay</option>
                      <option value="League">League</option>
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

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Start date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-black/50 border-gold/30 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Description</label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What's this tournament about? Shown on the Overview tab."
                      rows={4}
                      className="bg-black/50 border-gold/30 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Banner image URL</label>
                    <Input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://…"
                      className="bg-black/50 border-gold/30 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Prize pool (total)</label>
                    <Input
                      value={prizePool}
                      onChange={(e) => setPrizePool(e.target.value)}
                      placeholder="e.g. $5,000"
                      className="bg-black/50 border-gold/30 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Website</label>
                      <Input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://…"
                        className="bg-black/50 border-gold/30 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Twitter</label>
                      <Input
                        value={twitter}
                        onChange={(e) => setTwitter(e.target.value)}
                        placeholder="https://x.com/…"
                        className="bg-black/50 border-gold/30 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Discord</label>
                      <Input
                        value={discord}
                        onChange={(e) => setDiscord(e.target.value)}
                        placeholder="https://discord.gg/…"
                        className="bg-black/50 border-gold/30 text-white"
                      />
                    </div>
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

              {/* PRIZES — its own table, saved separately from Details */}
              <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-bold text-white font-cinzel mb-4">Prizes</h2>

                {!prizesLoaded ? (
                  <p className="text-gray-500 text-sm">Loading…</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {prizes.length === 0 && (
                        <p className="text-gray-500 text-sm italic">No prizes added yet.</p>
                      )}
                      {prizes.map((p, i) => (
                        <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                          <Input
                            value={p.place}
                            onChange={(e) => updatePrizeRow(i, "place", e.target.value)}
                            placeholder="e.g. 1st Place"
                            className="bg-black/50 border-gold/30 text-white sm:w-1/3"
                          />
                          <Input
                            value={p.reward}
                            onChange={(e) => updatePrizeRow(i, "reward", e.target.value)}
                            placeholder="e.g. $2,500 + trophy"
                            className="bg-black/50 border-gold/30 text-white flex-1"
                          />
                          <Button
                            type="button"
                            onClick={() => removePrizeRow(i)}
                            className="bg-transparent hover:bg-red-600/20 text-red-500 border border-red-500/30 px-3"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      onClick={addPrizeRow}
                      className="mt-4 bg-transparent hover:bg-gold/10 text-gold border border-gold/30"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add prize
                    </Button>

                    <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gold/10">
                      <Button
                        onClick={handleSavePrizes}
                        disabled={!prizesDirty || isSavingPrizes}
                        className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingPrizes ? "Saving…" : "Save prizes"}
                      </Button>
                      {prizesSavedAt && !prizesDirty && (
                        <span className="flex items-center gap-1.5 text-green-500 text-sm">
                          <CheckCircle2 className="h-4 w-4" /> Saved
                        </span>
                      )}
                      {prizesSaveError && (
                        <span className="flex items-center gap-1.5 text-red-500 text-sm">
                          <AlertCircle className="h-4 w-4" /> {prizesSaveError}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* BRACKET — generates bracket_matches from the linked auction's teams */}
              <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-bold text-white font-cinzel mb-4">Bracket</h2>

                {format === "round_robin" ? (
                  <p className="text-gray-400 text-sm">
                    Round-robin tournaments don't use a bracket — check the Points Table on the
                    tournament page instead.
                  </p>
                ) : bracketExists === null ? (
                  <p className="text-gray-500 text-sm">Checking…</p>
                ) : bracketExists ? (
                  <>
                    <p className="text-gray-300 text-sm mb-4">
                      A bracket has already been generated for this tournament.
                    </p>
                    <div className="mb-4">
                      <label className="text-gray-400 text-sm block mb-1">Reseed using</label>
                      <select
                        value={seedingMethod}
                        onChange={(e) => setSeedingMethod(e.target.value as SeedingMethod)}
                        className="w-full sm:w-64 bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                      >
                        <option value="random">Random draw</option>
                        <option value="creation_order">Team creation order</option>
                      </select>
                    </div>
                    <Button
                      onClick={handleRegenerateBracket}
                      disabled={isGenerating}
                      className="bg-red-600/80 hover:bg-red-600 text-white font-bold disabled:opacity-50"
                    >
                      {isGenerating ? "Regenerating…" : "Delete & Regenerate Bracket"}
                    </Button>
                    <p className="text-gray-500 text-xs mt-2">
                      This deletes all existing matches and results for this tournament and
                      builds a fresh bracket.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-300 text-sm mb-4">
                      No bracket yet — this needs a completed auction with at least 2 teams
                      linked to this tournament.
                    </p>
                    <div className="mb-4">
                      <label className="text-gray-400 text-sm block mb-1">Seed teams using</label>
                      <select
                        value={seedingMethod}
                        onChange={(e) => setSeedingMethod(e.target.value as SeedingMethod)}
                        className="w-full sm:w-64 bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                      >
                        <option value="random">Random draw</option>
                        <option value="creation_order">Team creation order</option>
                      </select>
                    </div>
                    <Button
                      onClick={handleGenerateBracket}
                      disabled={isGenerating}
                      className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
                    >
                      {isGenerating ? "Generating…" : "Generate Bracket"}
                    </Button>
                  </>
                )}

                {generateSuccess && (
                  <span className="flex items-center gap-1.5 text-green-500 text-sm mt-3">
                    <CheckCircle2 className="h-4 w-4" /> Bracket generated
                  </span>
                )}
                {generateError && (
                  <span className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
                    <AlertCircle className="h-4 w-4" /> {generateError}
                  </span>
                )}
              </div>
              <TeamsManager
                tournamentId={tournament.id}
                orgId={tournament.orgId!}
                tournamentName={tournament.name}
              />

              {/* PLACEHOLDER SECTIONS — still need write support */}
              <PlaceholderSection
                title="Schedule (Fixtures)"
                note="Fixtures come from bracket_matches (venue, scheduled_at, status) — reading works, but there's no create/edit UI yet for scheduling a match."
              />
              <PlaceholderSection
                title="Awards"
                note="Backed by tournament_awards — reading works, but there's no write function or UI yet. Usually filled in after the tournament ends."
              />

              <div className="bg-black/30 border border-gold/10 rounded-lg p-4 mb-8">
                <p className="text-gray-400 text-xs">
                  <span className="text-gold font-semibold">Squads</span> aren't edited here —
                  they come from your linked auction's results. Update the auction to change
                  those.
                </p>
              </div>

              <div className="text-center">
                <Link href={`/tournaments/${tournament.id}`}>
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