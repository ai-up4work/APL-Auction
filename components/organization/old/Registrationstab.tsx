"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Loader2,
  AlertCircle,
  Search,
  CheckSquare,
  Square,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  Shield,
  UserPlus,
  Inbox,
  Image as ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getRegistrationsForOrg,
  approveRegistration,
  rejectRegistration,
  bulkApproveRegistrations,
  subscribeToOrgRegistrations,
  getRegistrationSettingsForOrg,
  updateRegistrationSettings,
  getRegistrationCount,
  type PendingRegistration,
} from "@/lib/organization/registrations"
import { unsubscribe, type OrgSummary } from "@/lib/organization/organization"
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus"

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

type BadgeTone = "linked" | "none" | "warn" | "neutral"

function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const styles: Record<BadgeTone, string> = {
    linked: "border-gold/40 text-gold",
    none: "border-white/15 text-gray-400",
    warn: "border-yellow-500/40 text-yellow-400",
    neutral: "border-white/15 text-gray-300",
  }
  const glyph: Record<BadgeTone, string> = {
    linked: "✓",
    none: "✗",
    warn: "⚠",
    neutral: "",
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded border ${styles[tone]}`}
    >
      {glyph[tone] && <span>{glyph[tone]}</span>}
      {children}
    </span>
  )
}

type StatusFilter = "pending" | "approved" | "rejected" | "all"
type TypeFilter = "all" | "team" | "player"

/* ────────────────────────────────────────────────────────────────── */
/*  REGISTRATION CARD — approve is one click; reject expands an inline    */
/*  reason field in place, same "edit-in-place" pattern used elsewhere    */
/*  in this app rather than a separate modal.                            */
/* ────────────────────────────────────────────────────────────────── */

function RegistrationCard({
  reg,
  selected,
  onToggleSelect,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  reg: PendingRegistration
  selected: boolean
  onToggleSelect: () => void
  onApprove: () => void
  onReject: (reason: string) => void
  approving: boolean
  rejecting: boolean
}) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState("")

  const isTeam = reg.type === "team"
  const payload = reg.payload as any
  const image = isTeam ? payload.logo : payload.img

  return (
    <div className="bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-lg p-4 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {reg.status === "pending" && (
            <button onClick={onToggleSelect} className="text-gray-500 hover:text-gold mt-0.5 shrink-0" aria-label="Select registration">
              {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </button>
          )}
          <div
            className="h-11 w-11 rounded-full flex-shrink-0 border border-white/10 overflow-hidden flex items-center justify-center bg-black/60"
            style={isTeam ? { backgroundColor: payload.color || "#e45d35" } : undefined}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : isTeam ? (
              <Shield className="h-4 w-4 text-white/70" />
            ) : (
              <UserPlus className="h-4 w-4 text-white/40" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{payload.name}</p>
            <p className="text-gray-500 text-xs mt-0.5 truncate">
              {isTeam
                ? `${payload.code}${payload.tier ? ` · ${payload.tier}` : ""}${payload.owner ? ` · ${payload.owner}` : ""}`
                : `${payload.role} · ${payload.origin}${payload.country ? ` · ${payload.country}` : ""}`}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <StatusBadge tone="neutral">{isTeam ? "Team" : "Player"}</StatusBadge>
              <StatusBadge tone={reg.status === "approved" ? "linked" : reg.status === "rejected" ? "warn" : "neutral"}>
                {reg.status}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap text-gray-500 text-xs">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> {reg.contactEmail}
              </span>
              {reg.contactPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {reg.contactPhone}
                </span>
              )}
            </div>
            {reg.rejectionReason && (
              <p className="text-red-400/80 text-xs italic mt-1.5">Rejected: {reg.rejectionReason}</p>
            )}
          </div>
        </div>

        {reg.status === "pending" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onApprove}
              disabled={approving || rejecting}
              title="Approve"
              className="text-gray-500 hover:text-green-400 transition-colors disabled:opacity-50"
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowReject((v) => !v)}
              disabled={approving || rejecting}
              title="Reject"
              className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {showReject && (
        <div className="mt-3 pt-3 border-t border-white/5 flex flex-col sm:flex-row gap-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (visible to the applicant)…"
            className="bg-black/50 border-gold/30 text-white flex-1 text-sm"
          />
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={() => onReject(reason)}
              disabled={rejecting}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs whitespace-nowrap"
            >
              {rejecting ? "Rejecting…" : "Confirm reject"}
            </Button>
            <Button
              onClick={() => setShowReject(false)}
              className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/15 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  REGISTRATION PAGE SETTINGS — banner, welcome message, accent color,   */
/*  and per-type open/closed + optional caps. Everything here writes to   */
/*  the organizations row (see 20260728b_registration_customization.sql)  */
/*  via updateRegistrationSettings, and is read back by the public page.  */
/* ────────────────────────────────────────────────────────────────── */

function CapacityCard({
  label,
  open,
  onToggleOpen,
  cap,
  onCapChange,
  count,
}: {
  label: string
  open: boolean
  onToggleOpen: () => void
  cap: string
  onCapChange: (v: string) => void
  count: number
}) {
  return (
    <div className="bg-white/[0.02] border border-gold/10 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-cinzel uppercase tracking-wide text-gray-300">{label}</p>
        <button
          onClick={onToggleOpen}
          className={`text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded border transition-colors ${
            open ? "border-gold/40 text-gold" : "border-white/15 text-gray-500"
          }`}
        >
          {open ? "Open" : "Closed"}
        </button>
      </div>
      <FieldLabel>Cap (optional)</FieldLabel>
      <Input
        type="number"
        min={0}
        value={cap}
        onChange={(e) => onCapChange(e.target.value)}
        placeholder="No limit"
        className="bg-black/50 border-gold/30 text-white"
      />
      <p className="text-gray-600 text-[11px] mt-1.5">
        {count} pending/approved so far{cap.trim() ? ` of ${cap}` : ""}.
      </p>
    </div>
  )
}

function RegistrationSettingsPanel({ org }: { org: OrgSummary }) {
  const [loaded, setLoaded] = useState(false)
  const [bannerUrl, setBannerUrl] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [accentColor, setAccentColor] = useState("")
  const [teamCap, setTeamCap] = useState("")
  const [playerCap, setPlayerCap] = useState("")
  const [teamOpen, setTeamOpen] = useState(true)
  const [playerOpen, setPlayerOpen] = useState(true)
  const [teamCount, setTeamCount] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      getRegistrationSettingsForOrg(org.id),
      getRegistrationCount(org.id, "team"),
      getRegistrationCount(org.id, "player"),
    ]).then(([settings, tCount, pCount]) => {
      if (settings) {
        setBannerUrl(settings.bannerUrl ?? "")
        setWelcomeMessage(settings.welcomeMessage ?? "")
        setAccentColor(settings.accentColor ?? "")
        setTeamCap(settings.teamCap != null ? String(settings.teamCap) : "")
        setPlayerCap(settings.playerCap != null ? String(settings.playerCap) : "")
        setTeamOpen(settings.teamOpen)
        setPlayerOpen(settings.playerOpen)
      }
      setTeamCount(tCount)
      setPlayerCount(pCount)
      setLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaved(false)
    const result = await updateRegistrationSettings(org.id, {
      bannerUrl,
      welcomeMessage,
      accentColor,
      teamCap: teamCap.trim() ? Number(teamCap) : null,
      playerCap: playerCap.trim() ? Number(playerCap) : null,
      teamOpen,
      playerOpen,
    })
    setIsSaving(false)
    if (!result.ok) {
      setSaveError(result.error ?? "Couldn't save changes.")
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (!loaded) {
    return (
      <Panel>
        <p className="text-gray-500 text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading page settings…
        </p>
      </Panel>
    )
  }

  return (
    <Panel>
      <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-gold" /> Registration Page
      </h2>
      <p className="text-gray-500 text-xs mb-4">
        Customize what applicants see at <span className="text-gold">/register/{org.slug}</span> — a banner image
        (like a Google Form header), a welcome message, an accent color, and optional caps that close each
        registration type once full.
      </p>

      <div className="mb-4">
        <FieldLabel>Banner image URL</FieldLabel>
        <div className="h-28 rounded-md overflow-hidden border border-gold/20 bg-black/60 mb-2 flex items-center justify-center">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <p className="text-gray-600 text-xs italic">No banner set — a plain header is used instead</p>
          )}
        </div>
        <Input
          value={bannerUrl}
          onChange={(e) => setBannerUrl(e.target.value)}
          placeholder="https://…  (wide image works best, ~1200×300)"
          className="bg-black/50 border-gold/30 text-white"
        />
      </div>

      <div className="mb-4">
        <FieldLabel>Welcome message (optional)</FieldLabel>
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          rows={3}
          placeholder="e.g. Registration closes August 15th. Entry fee: LKR 5,000 per team."
          className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5 resize-none focus-visible:ring-1 focus-visible:ring-gold/40 outline-none"
        />
      </div>

      <div className="mb-4">
        <FieldLabel>Accent color (optional)</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={accentColor || "#d4af37"}
            onChange={(e) => setAccentColor(e.target.value)}
            className="h-10 w-14 rounded-md border border-gold/30 bg-black/50 cursor-pointer"
          />
          <Input
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            placeholder="Default gold"
            className="bg-black/50 border-gold/30 text-white flex-1"
          />
        </div>
        <p className="text-gray-600 text-[11px] mt-1.5">Replaces the gold accents on the registration page only — nothing else in your dashboard changes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CapacityCard label="Team registration" open={teamOpen} onToggleOpen={() => setTeamOpen((v) => !v)} cap={teamCap} onCapChange={setTeamCap} count={teamCount} />
        <CapacityCard label="Player registration" open={playerOpen} onToggleOpen={() => setPlayerOpen((v) => !v)} cap={playerCap} onCapChange={setPlayerCap} count={playerCount} />
      </div>

      {saveError && (
        <p className="flex items-center gap-1.5 text-red-500 text-sm mt-4">
          <AlertCircle className="h-4 w-4" /> {saveError}
        </p>
      )}
      <Button onClick={handleSave} disabled={isSaving} className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 mt-4">
        {isSaving ? "Saving…" : saved ? "Saved ✓" : "Save page settings"}
      </Button>
    </Panel>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  REGISTRATIONS TAB                                                    */
/* ────────────────────────────────────────────────────────────────── */

export function RegistrationsTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [regs, setRegs] = useState<PendingRegistration[]>([])
  const [loaded, setLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [query, setQuery] = useState("")

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)

  const reload = () => {
    setSyncing(true)
    return getRegistrationsForOrg(org.id).then((r) => {
      setRegs(r)
      setLoaded(true)
      setSyncing(false)
    })
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  useEffect(() => {
    const channel = subscribeToOrgRegistrations(org.id, () => reload())
    return () => unsubscribe(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  useRefetchOnFocus(reload)

  const registrationLink =
    typeof window !== "undefined" ? `${window.location.origin}/register/${org.slug}` : `/register/${org.slug}`

  const copyLink = () => {
    navigator.clipboard.writeText(registrationLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return regs.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (typeFilter !== "all" && r.type !== typeFilter) return false
      if (!q) return true
      const payload = r.payload as any
      return (
        (payload.name ?? "").toLowerCase().includes(q) ||
        r.contactEmail.toLowerCase().includes(q) ||
        r.contactName.toLowerCase().includes(q)
      )
    })
  }, [regs, statusFilter, typeFilter, query])

  const pendingCount = useMemo(() => regs.filter((r) => r.status === "pending").length, [regs])
  const selectableIds = useMemo(() => filtered.filter((r) => r.status === "pending").map((r) => r.id), [filtered])
  const allSelectableChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))

  const toggleSelectAll = () => {
    setSelected((prev) => (allSelectableChecked ? new Set() : new Set(selectableIds)))
  }
  const toggleSelectOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApprove = async (reg: PendingRegistration) => {
    setBusyId(reg.id)
    setBusyAction("approve")
    setActionError(null)
    const result = await approveRegistration(reg, org.id, userId)
    setBusyId(null)
    setBusyAction(null)
    if (!result.ok) {
      setActionError(result.error ?? "Couldn't approve that registration.")
      return
    }
    setRegs((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: "approved" } : r)))
  }

  const handleReject = async (reg: PendingRegistration, reason: string) => {
    setBusyId(reg.id)
    setBusyAction("reject")
    setActionError(null)
    const result = await rejectRegistration(reg.id, userId, reason)
    setBusyId(null)
    setBusyAction(null)
    if (!result.ok) {
      setActionError(result.error ?? "Couldn't reject that registration.")
      return
    }
    setRegs((prev) =>
      prev.map((r) => (r.id === reg.id ? { ...r, status: "rejected", rejectionReason: reason.trim() || "Not accepted." } : r))
    )
  }

  const handleBulkApprove = async () => {
    if (selected.size === 0) return
    const ok = await confirm({
      title: `Approve ${selected.size} registration${selected.size === 1 ? "" : "s"}?`,
      description: "Each one is copied into the Team Pool or Player Bank, exactly like adding it by hand.",
      confirmText: `Approve ${selected.size}`,
      tone: "default",
    })
    if (!ok) return

    setBulkApproving(true)
    setActionError(null)
    const toApprove = regs.filter((r) => selected.has(r.id))
    const { okIds, failedIds } = await bulkApproveRegistrations(toApprove, org.id, userId)
    setBulkApproving(false)
    setRegs((prev) => prev.map((r) => (okIds.includes(r.id) ? { ...r, status: "approved" } : r)))
    setSelected(new Set())
    if (failedIds.length > 0) {
      setActionError(
        `${failedIds.length} registration${failedIds.length === 1 ? "" : "s"} couldn't be approved — please retry ${failedIds.length === 1 ? "it" : "them"} individually.`
      )
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
          <Inbox className="h-4 w-4 text-gold" /> Registration Link
        </h2>
        <p className="text-gray-500 text-xs mb-4">
          Share this link with team owners and players — they fill in their own details, and submissions land here
          as pending until you approve or reject them. Approved teams go straight into the Team Pool; approved
          players go into the Player Bank.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            readOnly
            value={registrationLink}
            onFocus={(e) => e.target.select()}
            className="bg-black/50 border-gold/30 text-white flex-1 font-mono text-xs sm:text-sm"
          />
          <Button onClick={copyLink} className="bg-gold hover:bg-gold/90 text-black font-bold whitespace-nowrap">
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-bold text-white font-cinzel flex items-center gap-2 flex-wrap">
            Registrations
            {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />}
            {pendingCount > 0 && <StatusBadge tone="warn">{pendingCount} pending</StatusBadge>}
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email…"
              className="bg-black/50 border-gold/30 text-white pl-8 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(["pending", "approved", "rejected", "all"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-xs font-cinzel uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors ${
                statusFilter === f ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
              }`}
            >
              {f}
            </button>
          ))}
          <span className="w-px h-5 bg-white/10 mx-1" />
          {(["all", "team", "player"] as TypeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`text-xs font-cinzel uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors ${
                typeFilter === f ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
              }`}
            >
              {f === "all" ? "All types" : f === "team" ? "Teams" : "Players"}
            </button>
          ))}
        </div>

        {actionError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3">
            <AlertCircle className="h-4 w-4" /> {actionError}
          </p>
        )}

        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm italic">
            No {statusFilter === "all" ? "" : `${statusFilter} `}registrations{query ? ` match "${query}"` : ""}.
          </p>
        ) : (
          <div className="space-y-2">
            {selectableIds.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-1 pb-1 flex-wrap">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold"
                >
                  {allSelectableChecked ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                  {allSelectableChecked ? "Deselect all" : "Select all pending"}
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkApproving}
                    className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-green-400 hover:text-green-300 disabled:opacity-50"
                  >
                    {bulkApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Approve {selected.size} selected
                  </button>
                )}
              </div>
            )}

            {filtered.map((r) => (
              <RegistrationCard
                key={r.id}
                reg={r}
                selected={selected.has(r.id)}
                onToggleSelect={() => toggleSelectOne(r.id)}
                onApprove={() => handleApprove(r)}
                onReject={(reason) => handleReject(r, reason)}
                approving={busyId === r.id && busyAction === "approve"}
                rejecting={busyId === r.id && busyAction === "reject"}
              />
            ))}
          </div>
        )}
      </Panel>

      {ConfirmDialogElement}
    </div>
  )
}