// app/components/tournament/tournament-edit-client.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
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
// import { SiteHeader } from "@/components/landing/site-header"
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
import MatchesManager from "@/components/tournament/MatchesManager"
import { AppHeader } from "@/components/app-header"

interface TournamentEditClientProps {
  tournament: TournamentEditData
}

type GateState = "checking" | "denied" | "allowed"

type SectionId = "details" | "prizes" | "bracket" | "teams" | "schedule" | "awards"

const JUMP_SECTIONS: { id: SectionId; label: string }[] = [
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

  // ── Which section is open. Only one renders in the middle column at a
  // time — clicking a nav item swaps it, rather than everything being
  // stacked and scrolled past. The middle column now scrolls internally,
  // independently of the sticky right rail. ──────────────────────────────
  const [activeSection, setActiveSection] = useState<SectionId>("details")

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

  // ── Auto-advance: after a save/generate succeeds, move to the next tab
  // in JUMP_SECTIONS. Delay defaults to 800ms so the "Saved ✓" state is
  // still visible for a beat before the view swaps out from under it.
  // No-ops on the last tab (Awards). ──────────────────────────────────────
  const goToNextSection = (delayMs = 800) => {
    const idx = JUMP_SECTIONS.findIndex((s) => s.id === activeSection)
    if (idx === -1 || idx === JUMP_SECTIONS.length - 1) return
    const nextId = JUMP_SECTIONS[idx + 1].id
    if (delayMs <= 0) {
      setActiveSection(nextId)
      return
    }
    setTimeout(() => {
      setActiveSection(nextId)
    }, delayMs)
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
      goToNextSection()
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
      goToNextSection()
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
      goToNextSection()
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
      goToNextSection()
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

  // ── Tab button — shared by the top pill nav on every breakpoint. Just
  // flips `activeSection`; nothing here scrolls the page anymore. ────────
  const isActive = (id: SectionId) => activeSection === id

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <AppHeader title="Tournament Editor" />

      <section className="pt-32 sm:pt-40 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-8xl">
          {gate === "checking" && (
            <p className="text-center text-gray-400">Checking access…</p>
          )}

          {gate === "denied" && (
            <div className="bg-black/50 border border-gold/20 rounded-lg p-8 text-center max-w-md mx-auto">
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
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
                    <Settings2 className="w-3.5 h-3.5" />
                    Tournament Admin
                  </span>
                  <h1 className="text-3xl font-bold text-white font-cinzel">{tournament.name}</h1>
                </div>
                <Link href={`/tournaments/${tournament.id}`} className="hidden sm:block shrink-0">
                  <Button className="bg-transparent hover:bg-gold/10 text-gold border border-gold/30 text-xs">
                    Back to tournament
                  </Button>
                </Link>
              </div>

              <p className="text-gray-400 text-sm mb-6 max-w-2xl">
                Details, Prizes, Bracket, and Matches save immediately. Awards is read-only here
                for now — see note below.
              </p>

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

              <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-12 xl:items-stretch">
                <div className="min-w-0 xl:sticky xl:top-28 xl:min-h-0 xl:overflow-y-auto xl:pr-2">
                  {/* DETAILS */}
                  {activeSection === "details" && (
                    <div className="bg-black/50 border border-gold/20 rounded-lg p-5 sm:p-6">
                      <SectionHeading icon={Settings2} title="Details" />

                      <div className="space-y-5">
                        <div>
                          <label className="text-gray-400 text-sm block mb-1">Tournament name</label>
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-black/50 border-gold/30 text-white"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="lg:col-span-1">
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

                          <div className="lg:col-span-1">
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

                          <div className="lg:col-span-1">
                            <label className="text-gray-400 text-sm block mb-1">Start date</label>
                            <Input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="bg-black/50 border-gold/30 text-white"
                            />
                          </div>

                          <div className="lg:col-span-1">
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
                            <label className="text-gray-400 text-sm block mb-1">Tournament Banner</label>
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
                                  <Image
                                    src={logoUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={() => setLogoBroken(true)}
                                    width={48}
                                    height={48}
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
                        {!dirty && (
                          <button
                            type="button"
                            onClick={() => goToNextSection(0)}
                            className="ml-auto text-gold text-xs underline underline-offset-4 hover:text-gold/80"
                          >
                            Edit Prizes →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PRIZES */}
                  {activeSection === "prizes" && (
                    <div className="bg-black/50 border border-gold/20 rounded-lg p-5 sm:p-6">
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
                            {!prizesDirty && (
                              <button
                                type="button"
                                onClick={() => goToNextSection(0)}
                                className="ml-auto text-gold text-xs underline underline-offset-4 hover:text-gold/80"
                              >
                                Edit Bracket →
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* BRACKET */}
                  {activeSection === "bracket" && (
                    <div className="bg-black/50 border border-gold/20 rounded-lg p-5 sm:p-6">
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
                              className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
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
                              className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
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

                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gold/10">
                        {bracketExists && (
                          <Link href={`/tournaments/${tournament.id}/bracket/edit`}>
                            <Button className="bg-transparent hover:bg-gold/10 text-gold border border-gold/30">
                              <Swords className="mr-2 h-4 w-4" />
                              Edit bracket
                            </Button>
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => goToNextSection(0)}
                          className="ml-auto text-gold text-xs underline underline-offset-4 hover:text-gold/80"
                        >
                          Edit Teams →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TEAMS */}
                  {activeSection === "teams" && (
                    <div className="space-y-5">
                      <TeamsManager
                        tournamentId={tournament.id}
                        orgId={tournament.orgId!}
                        tournamentName={tournament.name}
                        sourceType={tournament.sourceType}
                        sourceId={tournament.sourceId}
                      />
                      <div className="bg-black/30 border border-gold/10 rounded-lg p-4">
                        <p className="text-gray-400 text-xs flex items-start gap-2">
                          <Users className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                          <span>
                            <span className="text-gold font-semibold">Squads</span> aren't edited here
                            — they come from your linked auction's results. Update the auction to
                            change those.
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => goToNextSection(0)}
                          className="text-gold text-xs underline underline-offset-4 hover:text-gold/80"
                        >
                          Edit Schedule →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MATCHES / SCHEDULE */}
                  {activeSection === "schedule" && (
                    <div className="bg-black/50 border border-gold/20 rounded-lg p-5 sm:p-6">
                      <SectionHeading icon={CalendarClock} title="Matches" />
                      <MatchesManager
                        tournamentId={tournament.id}
                        tournamentName={tournament.name}
                        orgId={tournament.orgId!}
                      />
                      <div className="text-right mt-4 pt-4 border-t border-gold/10">
                        <button
                          type="button"
                          onClick={() => goToNextSection(0)}
                          className="text-gold text-xs underline underline-offset-4 hover:text-gold/80"
                        >
                          Edit Awards →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* AWARDS */}
                  {activeSection === "awards" && (
                    <PlaceholderSection
                      icon={Award}
                      title="Awards"
                      note="Backed by tournament_awards — reading works, but there's no write function or UI yet. Usually filled in after the tournament ends."
                    />
                  )}

                  <div className="text-center xl:hidden mt-8">
                    <Link href={`/tournaments/${tournament.id}`}>
                      <Button className="bg-gold hover:bg-gold/90 text-black font-bold">
                        Back to tournament page
                      </Button>
                    </Link>
                  </div>
                </div>

                <aside className="hidden xl:flex xl:sticky xl:top-28">
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 font-cinzel block">
                        Live Preview
                      </span>
                      <div className="bg-black/50 border border-gold/20 rounded-lg overflow-hidden">
                        <div className="relative h-28 bg-black/60 border-b border-gold/10">
                          {imageUrl && !imageBroken ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageOff className="h-5 w-5 text-gray-700" />
                            </div>
                          )}
                          <div className="absolute -bottom-6 left-4 w-14 h-14 rounded-full border-2 border-gold/40 bg-black overflow-hidden flex items-center justify-center shadow-lg">
                            {logoUrl && !logoBroken ? (
                              <Image
                                src={logoUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                width={56}
                                height={56}
                              />
                            ) : (
                              <ImageOff className="h-3.5 w-3.5 text-gray-600" />
                            )}
                          </div>
                        </div>

                        <div className="pt-9 pb-4 px-4">
                          <h3 className="text-white font-cinzel font-bold text-sm leading-snug mb-2">
                            {name || "Untitled tournament"}
                          </h3>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            <span className="text-[9px] uppercase tracking-wider font-cinzel px-2 py-0.5 rounded-full border border-gold/30 text-gold bg-gold/5">
                              {format === "single_elimination"
                                ? "Single Elim"
                                : format === "double_elimination"
                                  ? "Double Elim"
                                  : "Round Robin"}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider font-cinzel px-2 py-0.5 rounded-full border border-white/15 text-gray-300">
                              {status}
                            </span>
                          </div>
                          <dl className="space-y-1.5 text-xs">
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500">Starts</dt>
                              <dd className="text-gray-300">{startDate || "—"}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500">Prize pool</dt>
                              <dd className="text-gray-300">{prizePool || "—"}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/50 border border-gold/20 rounded-lg p-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 font-cinzel block">
                        Setup checklist
                      </span>
                      <ul className="space-y-2 text-xs">
                        <li className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              imageUrl ? "bg-green-500" : "bg-gray-600"
                            }`}
                          />
                          <span className={imageUrl ? "text-gray-300" : "text-gray-500"}>
                            Banner &amp; logo set
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              prizes.length ? "bg-green-500" : "bg-gray-600"
                            }`}
                          />
                          <span className={prizes.length ? "text-gray-300" : "text-gray-500"}>
                            Prizes configured
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              bracketExists ? "bg-green-500" : "bg-gray-600"
                            }`}
                          />
                          <span className={bracketExists ? "text-gray-300" : "text-gray-500"}>
                            Bracket generated
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              website || twitter || discord ? "bg-green-500" : "bg-gray-600"
                            }`}
                          />
                          <span
                            className={
                              website || twitter || discord ? "text-gray-300" : "text-gray-500"
                            }
                          >
                            Social links added
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-black/50 border border-gold/20 rounded-lg p-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 font-cinzel block">
                        Links
                      </span>
                      {website || twitter || discord ? (
                        <ul className="space-y-1.5 text-xs text-gray-400 break-all">
                          {website && <li>{website}</li>}
                          {twitter && <li>{twitter}</li>}
                          {discord && <li>{discord}</li>}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-600 italic">No links added yet</p>
                      )}
                    </div>

                    <div className="bg-black/50 border border-gold/20 rounded-lg p-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 font-cinzel block">
                        Prizes
                      </span>
                      {prizesLoaded && prizes.length > 0 ? (
                        <ul className="space-y-1.5 text-xs">
                          {prizes.slice(0, 5).map((p, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span className="text-gray-500 shrink-0">{p.place || "—"}</span>
                              <span className="text-gray-300 text-right">{p.reward || "—"}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-600 italic">No prizes added yet</p>
                      )}
                    </div>

                    <div className="bg-black/50 border border-gold/20 rounded-lg p-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 font-cinzel block">
                        Bracket
                      </span>
                      <p className="text-xs text-gray-400">
                        {bracketExists === null
                          ? "Checking…"
                          : bracketExists
                            ? "Generated ✓"
                            : "Not generated yet"}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </section>

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
    <div className="bg-black/30 border border-gold/10 rounded-lg p-6 opacity-60">
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