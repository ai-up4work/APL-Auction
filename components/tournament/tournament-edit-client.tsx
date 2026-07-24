"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Settings2,
  Trophy,
  Swords,
  Users,
  CalendarClock,
  Award,
  ImageOff,
} from "lucide-react"
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

const JUMP_SECTIONS = [
  { id: "details", label: "Details" },
  { id: "prizes", label: "Prizes" },
  { id: "bracket", label: "Bracket" },
  { id: "teams", label: "Teams" },
  { id: "schedule", label: "Schedule" },
  { id: "awards", label: "Awards" },
]

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-md bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-gold" />
      </div>
      <h2 className="text-lg font-bold text-white font-cinzel">{title}</h2>
    </div>
  )
}

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
  const [imageBroken, setImageBroken] = useState(false)
  const [logoUrl, setLogoUrl] = useState(tournament.logoUrl)
  const [logoBroken, setLogoBroken] = useState(false)
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

  // ── Confirm modal — replaces window.confirm() so destructive actions
  // (format change wiping an existing bracket, delete & regenerate) match
  // the rest of the UI instead of popping the browser's native dialog.
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    confirmLabel: string
    destructive?: boolean
    onConfirm: () => void
  } | null>(null)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  // ── Auth + org-ownership gate ─────────────────────────────────────────
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

  useEffect(() => {
    setImageBroken(false)
  }, [imageUrl])

  useEffect(() => {
    setLogoBroken(false)
  }, [logoUrl])

  const dirty =
    name !== tournament.name ||
    format !== tournament.format ||
    status !== tournament.status ||
    category !== (tournament.category ?? "") ||
    description !== tournament.description ||
    startDate !== tournament.startDate ||
    imageUrl !== tournament.imageUrl ||
    logoUrl !== tournament.logoUrl ||
    prizePool !== tournament.prizePool ||
    website !== tournament.website ||
    twitter !== tournament.twitter ||
    discord !== tournament.discord

  const formatChanging = format !== tournament.format

  const saveDetails = async () => {
    setIsSaving(true)
    setSaveError(null)

    // Format changed while a bracket already exists — the old bracket no
    // longer matches (wrong round count, no losers bracket, etc), so clear
    // it out as part of this save rather than let it go stale. This mirrors
    // the Bracket edit page's behavior.
    if (formatChanging && bracketExists) {
      const del = await deleteBracketForTournament(tournament.id)
      if (!del.ok) {
        setIsSaving(false)
        setSaveError(del.error ?? "Couldn't clear the existing bracket.")
        return
      }
      setBracketExists(false)
      setGenerateSuccess(false)
      setGenerateError(null)
    }

    const ok = await updateTournament(tournament.id, {
      name,
      format,
      status,
      category: category ? (category as "Auction" | "Bracket" | "Overlay" | "League") : undefined,
      description,
      startDate,
      imageUrl,
      logoUrl,
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

  const handleSave = () => {
    if (!dirty) return

    if (formatChanging && bracketExists) {
      setConfirmDialog({
        title: "Change tournament format?",
        message: `This tournament already has a bracket built as ${
          tournament.format === "single_elimination"
            ? "Single Elimination"
            : tournament.format === "double_elimination"
              ? "Double Elimination"
              : "Round Robin"
        }. Switching to "${
          format === "single_elimination"
            ? "Single Elimination"
            : format === "double_elimination"
              ? "Double Elimination"
              : "Round Robin"
        }" will permanently delete all existing matches and results — including any that are already decided — so the bracket can be rebuilt from scratch in the new format. This can't be undone.`,
        confirmLabel: "Delete matches & save",
        destructive: true,
        onConfirm: saveDetails,
      })
      return
    }

    saveDetails()
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

  const regenerateBracket = async () => {
    setIsGenerating(true)
    setGenerateError(null)
    setGenerateSuccess(false)
    const del = await deleteBracketForTournament(tournament.id)
    if (!del.ok) {
      setIsGenerating(false)
      setGenerateError(del.error ?? "Couldn't clear the existing bracket.")
      return
    }

    setBracketExists(false)

    const result = await generateBracketForTournament(tournament.id, seedingMethod)
    setIsGenerating(false)
    if (result.ok) {
      setBracketExists(true)
      setGenerateSuccess(true)
    } else {
      setGenerateError(result.error ?? "Couldn't generate the bracket.")
    }
  }

  const handleRegenerateBracket = () => {
    setConfirmDialog({
      title: "Delete & regenerate bracket?",
      message:
        "This will permanently delete all existing matches and results for this tournament and build a fresh bracket. This can't be undone.",
      confirmLabel: "Delete & regenerate",
      destructive: true,
      onConfirm: regenerateBracket,
    })
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
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
                <Settings2 className="w-3.5 h-3.5" />
                Tournament Admin
              </span>
              <h1 className="text-3xl font-bold text-white font-cinzel mb-2">{tournament.name}</h1>
              <p className="text-gray-400 text-sm mb-6 max-w-xl">
                Details, Prizes, and Bracket save immediately. Schedule and Awards are read-only
                here for now — see notes below.
              </p>

              {/* JUMP NAV — turns the long stack of sections into something scannable */}
              <nav className="flex flex-wrap gap-x-1 gap-y-2 mb-8 pb-4 border-b border-gold/10">
                {JUMP_SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="text-[11px] font-cinzel uppercase tracking-widest text-gray-400 hover:text-gold px-3 py-1.5 rounded-full border border-transparent hover:border-gold/20 transition-colors"
                  >
                    {s.label}
                  </a>
                ))}
              </nav>

              {/* DETAILS — the only section backed by real columns today */}
              <div id="details" className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6 scroll-mt-28">
                <SectionHeading icon={Settings2} title="Details" />

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Tournament name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-black/50 border-gold/30 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                      {formatChanging && bracketExists && (
                        <p className="text-gray-500 text-xs mt-1">
                          Saving will delete the existing bracket's matches and results.
                        </p>
                      )}
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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <label className="text-gray-400 text-sm block mb-1">Prize pool (total)</label>
                      <Input
                        value={prizePool}
                        onChange={(e) => setPrizePool(e.target.value)}
                        placeholder="e.g. $5,000"
                        className="bg-black/50 border-gold/30 text-white"
                      />
                    </div>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Banner image URL</label>
                      <div className="flex gap-3 items-start">
                        <Input
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://…"
                          className="bg-black/50 border-gold/30 text-white flex-1"
                        />
                        <div className="w-20 h-12 shrink-0 rounded-md border border-gold/20 bg-black/60 flex items-center justify-center overflow-hidden">
                          {imageUrl && !imageBroken ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={() => setImageBroken(true)}
                            />
                          ) : (
                            <ImageOff className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        Wide banner shown at the top of the tournament page.
                      </p>
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Tournament logo URL</label>
                      <div className="flex gap-3 items-start">
                        <Input
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://…"
                          className="bg-black/50 border-gold/30 text-white flex-1"
                        />
                        <div className="w-12 h-12 shrink-0 rounded-full border border-gold/20 bg-black/60 flex items-center justify-center overflow-hidden">
                          {logoUrl && !logoBroken ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={logoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={() => setLogoBroken(true)}
                            />
                          ) : (
                            <ImageOff className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        Square badge — used as the watermark behind the Final on the bracket.
                        Falls back to your org's logo if left blank.
                      </p>
                    </div>
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

                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gold/10">
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
              <div id="prizes" className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6 scroll-mt-28">
                <SectionHeading icon={Trophy} title="Prizes" />

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
              <div id="bracket" className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6 scroll-mt-28">
                <SectionHeading icon={Swords} title="Bracket" />

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

              <div id="teams" className="scroll-mt-28 mb-6">
                <TeamsManager
                  tournamentId={tournament.id}
                  orgId={tournament.orgId!}
                  tournamentName={tournament.name}
                />
              </div>

              {/* PLACEHOLDER SECTIONS — still need write support */}
              <div id="schedule" className="scroll-mt-28">
                <PlaceholderSection
                  icon={CalendarClock}
                  title="Schedule (Fixtures)"
                  note="Fixtures come from bracket_matches (venue, scheduled_at, status) — reading works, but there's no create/edit UI yet for scheduling a match."
                />
              </div>
              <div id="awards" className="scroll-mt-28">
                <PlaceholderSection
                  icon={Award}
                  title="Awards"
                  note="Backed by tournament_awards — reading works, but there's no write function or UI yet. Usually filled in after the tournament ends."
                />
              </div>

              <div className="bg-black/30 border border-gold/10 rounded-lg p-4 mb-8">
                <p className="text-gray-400 text-xs flex items-start gap-2">
                  <Users className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                  <span>
                    <span className="text-gold font-semibold">Squads</span> aren't edited here —
                    they come from your linked auction's results. Update the auction to change
                    those.
                  </span>
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

      {/* CONFIRM MODAL — same styling as the Bracket edit page's version */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-gold/30 rounded-lg p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className={`h-5 w-5 ${confirmDialog.destructive ? "text-red-500" : "text-gold"}`} />
              <h3 className="text-lg font-bold text-white font-cinzel">{confirmDialog.title}</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setConfirmDialog(null)}
                className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  confirmDialog.onConfirm()
                  setConfirmDialog(null)
                }}
                className={
                  confirmDialog.destructive
                    ? "bg-red-600/80 hover:bg-red-600 text-white font-bold"
                    : "bg-gold hover:bg-gold/90 text-black font-bold"
                }
              >
                {confirmDialog.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function PlaceholderSection({
  icon: Icon,
  title,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  note: string
}) {
  return (
    <div className="bg-black/30 border border-gold/10 rounded-lg p-6 mb-6 opacity-60">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <h2 className="text-lg font-bold text-white font-cinzel">{title}</h2>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-cinzel">
          Not available yet
        </span>
      </div>
      <p className="text-gray-500 text-sm">{note}</p>
    </div>
  )
}