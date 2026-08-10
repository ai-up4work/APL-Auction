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
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Check,
  ImageIcon,
  Palette,
  Link2,
  Users2,
  Pencil,
  ChevronUp,
} from "lucide-react"
import ImageUploadField from "@/components/Admin/ImageUploadField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getRegistrationsForOrg,
  getRegistrationFormsForOrg,
  createRegistrationForm,
  updateRegistrationForm,
  deleteRegistrationForm,
  getRegistrationCount,
  approveRegistration,
  rejectRegistration,
  bulkApproveRegistrations,
  subscribeToOrgRegistrations,
  type PendingRegistration,
  type RegistrationForm,
} from "@/lib/organization/registrations"
import { unsubscribe, type OrgSummary } from "@/lib/organization/organization"
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus"
import { Panel, FieldLabel, StatusBadge, StyledSelect, CollapsibleCreatePanel } from "@/components/organization/shared"
import Image from "next/image"

type StatusFilter = "all" | "approved" | "rejected" | "pending"
type TypeFilter = "all" | "team" | "player"

const DEFAULT_ACCENT = "#d4af37"

// How long the "Saved ✓" confirmation stays visible before the editor
// auto-collapses back to its summary card. Long enough to register as
// feedback, short enough not to feel like a stall.
const SAVE_COLLAPSE_DELAY_MS = 900

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
  const selectable = reg.status === "pending"

  return (
    <div
      onClick={() => selectable && onToggleSelect()}
      className={`h-full flex flex-col bg-white/[0.02] border rounded-lg p-4 transition-colors ${
        selectable ? "cursor-pointer" : ""
      } ${selected ? "border-gold/60 bg-gold/[0.04]" : "border-gold/10 hover:border-gold/40"}`}
    >
      <div className="flex items-start justify-between gap-3 flex-1">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {selectable && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect()
              }}
              className="text-gray-500 hover:text-gold mt-0.5 shrink-0"
              aria-label="Select registration"
            >
              {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </button>
          )}
          <div
            className="h-11 w-11 rounded-full flex-shrink-0 border border-white/10 overflow-hidden flex items-center justify-center bg-black/60"
            style={isTeam ? { backgroundColor: payload.color || "#e45d35" } : undefined}
          >
            {image ? (
              <Image src={image} alt="" className="h-full w-full object-cover" width={44} height={44} />
            ) : isTeam ? (
              <Shield className="h-4 w-4 text-white/70" />
            ) : (
              <UserPlus className="h-4 w-4 text-white/40" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate">{payload.name}</p>
            <p className="text-gray-500 text-xs mt-0.5 truncate">
              {isTeam
                ? `${payload.code}${payload.tier ? ` · ${payload.tier}` : ""}${payload.owner ? ` · ${payload.owner}` : ""}`
                : `${payload.role} · ${payload.origin}${payload.country ? ` · ${payload.country}` : ""}`}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <StatusBadge tone="neutral">{isTeam ? "Team" : "Player"}</StatusBadge>
              <StatusBadge tone={reg.status === "approved" ? "success" : reg.status === "rejected" ? "danger" : "warn"}>
                {reg.status}
              </StatusBadge>
              {reg.formName && <StatusBadge tone="neutral">{reg.formName}</StatusBadge>}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap text-gray-500 text-xs">
              <span className="flex items-center gap-1 truncate">
                <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{reg.contactEmail}</span>
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
      </div>

      {reg.status === "pending" && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
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

      {showReject && (
        <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (visible to the applicant)…"
            className="bg-black/50 border-gold/30 text-white flex-1 text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => onReject(reason)}
              disabled={rejecting}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs whitespace-nowrap flex-1"
            >
              {rejecting ? "Rejecting…" : "Confirm reject"}
            </Button>
            <Button
              onClick={() => setShowReject(false)}
              className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/15 text-xs flex-1"
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
/*  SECTION LABEL — small eyebrow used to group the form editor into      */
/*  clear zones (link, branding, capacity) instead of one long stack.     */
/* ────────────────────────────────────────────────────────────────── */

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span className="text-gold/70">{icon}</span>
      <p className="text-[10px] font-cinzel uppercase tracking-[0.18em] text-gray-500">{children}</p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  FORM SUMMARY CARD — the default, collapsed view of a form: a small    */
/*  thumbnail, its name, active/pending status, a copyable link, and an   */
/*  "Edit form" button. This is what's shown until the user asks to       */
/*  edit a specific form, at which point FormEditorCard takes its place.  */
/* ────────────────────────────────────────────────────────────────── */

function FormSummaryCard({
  form,
  org,
  pendingCount,
  onEdit,
}: {
  form: RegistrationForm
  org: OrgSummary
  pendingCount: number
  onEdit: () => void
}) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const baseLink = `${origin}/register/${org.slug}/${form.slug}`

  const copyLink = () => {
    navigator.clipboard.writeText(baseLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="h-full flex flex-col bg-white/[0.02] border border-gold/10 rounded-lg p-4 transition-all duration-200 hover:border-gold/40 hover:bg-white/[0.03] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-md flex-shrink-0 border border-white/10 overflow-hidden flex items-center justify-center bg-black/60">
          {form.bannerUrl ? (
            <Image src={form.bannerUrl} alt="" className="h-full w-full object-cover" width={40} height={40} />
          ) : (
            <ImageIcon className="h-4 w-4 text-white/30" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-cinzel font-bold truncate">{form.name}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span
              className={`flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded-full border ${
                form.isActive ? "border-gold/40 text-gold" : "border-white/15 text-gray-500"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${form.isActive ? "bg-gold" : "bg-gray-600"}`} aria-hidden />
              {form.isActive ? "Active" : "Inactive"}
            </span>
            {pendingCount > 0 && <StatusBadge tone="warn">{pendingCount} pending</StatusBadge>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5">
        <Input
          readOnly
          value={baseLink}
          onFocus={(e) => e.target.select()}
          className="bg-black/50 border-gold/30 text-white flex-1 min-w-0 font-mono text-[11px] h-8"
        />
        <button
          onClick={copyLink}
          title="Copy link"
          className={`shrink-0 h-8 w-8 flex items-center justify-center rounded-md border transition-colors ${
            copied ? "border-green-500/40 text-green-400" : "border-gold/30 text-gray-300 hover:text-gold hover:border-gold/50"
          }`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      <Button
        onClick={onEdit}
        className="bg-transparent hover:bg-gold/10 text-gold border border-gold/30 font-bold text-xs mt-3 w-full flex items-center justify-center gap-1.5"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit form
      </Button>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  CAPACITY CARD — open/closed + optional cap, now with a type icon and   */
/*  a filled progress bar so "37 of 40" reads at a glance instead of       */
/*  needing to be parsed as text. The bar tints with the form's own        */
/*  accent color so it feels like part of that form, not a generic stat.  */
/* ────────────────────────────────────────────────────────────────── */

function CapacityCard({
  label,
  icon,
  open,
  onToggleOpen,
  cap,
  onCapChange,
  count,
  accentColor,
}: {
  label: string
  icon: React.ReactNode
  open: boolean
  onToggleOpen: () => void
  cap: string
  onCapChange: (v: string) => void
  count: number
  accentColor: string
}) {
  const capNum = cap.trim() ? Number(cap) : null
  const hasCap = capNum != null && capNum > 0
  const pct = hasCap ? Math.min(100, Math.round((count / capNum) * 100)) : 0
  const isFull = hasCap && count >= capNum

  return (
    <div className="bg-white/[0.02] border border-gold/10 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-cinzel uppercase tracking-wide text-gray-300 flex items-center gap-1.5">
          <span className="text-gray-500">{icon}</span>
          {label}
        </p>
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

      <div className="mt-3">
        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
          {hasCap && (
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                backgroundColor: isFull ? "#f87171" : accentColor,
              }}
            />
          )}
        </div>
        <p className="text-gray-600 text-[11px] mt-1.5">
          {isFull ? (
            <span className="text-red-400/80">{count} of {capNum} — full</span>
          ) : (
            <>
              {count} pending/approved{hasCap ? ` of ${capNum}` : " so far"}
            </>
          )}
        </p>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  LINK ROW — a single shareable link: readonly field, an "open in new   */
/*  tab" icon button, and a copy icon button. Icon-only actions (instead   */
/*  of full labeled buttons) so this fits comfortably in a narrower grid   */
/*  card without wrapping.                                                */
/* ────────────────────────────────────────────────────────────────── */

function LinkRow({ label, url, copied, onCopy }: { label: string; url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-1.5">
        <Input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="bg-black/50 border-gold/30 text-white flex-1 min-w-0 font-mono text-xs"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open link"
          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-md border border-gold/30 text-gray-300 hover:text-gold hover:border-gold/50 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={onCopy}
          title="Copy link"
          className={`shrink-0 h-9 w-9 flex items-center justify-center rounded-md border transition-colors ${
            copied ? "border-green-500/40 text-green-400" : "border-gold/30 text-gray-300 hover:text-gold hover:border-gold/50"
          }`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  FORM EDITOR — one registration form's settings, rendered as TWO       */
/*  sibling panels (not one long card) so they can sit in their own       */
/*  grid columns:                                                        */
/*    Column 1 → FormCapsAndLinksPanel  (League Setup & Caps, Share)      */
/*    Column 2 → FormDetailsPanel       (name, banner, branding, save)    */
/*  All state lives in the parent FormEditorCard and is passed down, so    */
/*  the two panels stay in sync exactly as the single card used to be.    */
/*  The whole thing only renders when the user clicks "Edit form" on the  */
/*  matching FormSummaryCard, and auto-collapses back to it a moment      */
/*  after a successful save — see RegistrationsTab.                       */
/* ────────────────────────────────────────────────────────────────── */

function FormCapsAndLinksPanel({
  teamOpen,
  setTeamOpen,
  playerOpen,
  setPlayerOpen,
  teamCap,
  setTeamCap,
  playerCap,
  setPlayerCap,
  teamCount,
  playerCount,
  countsLoaded,
  liveAccent,
  isActive,
  baseLink,
  teamLink,
  playerLink,
  showSplitLinks,
  copiedKey,
  copyLink,
}: {
  teamOpen: boolean
  setTeamOpen: (fn: (v: boolean) => boolean) => void
  playerOpen: boolean
  setPlayerOpen: (fn: (v: boolean) => boolean) => void
  teamCap: string
  setTeamCap: (v: string) => void
  playerCap: string
  setPlayerCap: (v: string) => void
  teamCount: number
  playerCount: number
  countsLoaded: boolean
  liveAccent: string
  isActive: boolean
  baseLink: string
  teamLink: string
  playerLink: string
  showSplitLinks: boolean
  copiedKey: "" | "base" | "team" | "player"
  copyLink: (key: "base" | "team" | "player", value: string) => void
}) {
  return (
    <div className="space-y-4">
      <Panel>
        <SectionLabel icon={<Users2 className="h-3 w-3" />}>League Setup &amp; Caps</SectionLabel>
        <div className="grid grid-cols-1 gap-4">
          <CapacityCard
            label="Team registration"
            icon={<Shield className="h-3.5 w-3.5" />}
            open={teamOpen}
            onToggleOpen={() => setTeamOpen((v) => !v)}
            cap={teamCap}
            onCapChange={setTeamCap}
            count={countsLoaded ? teamCount : 0}
            accentColor={liveAccent}
          />
          <CapacityCard
            label="Player registration"
            icon={<UserPlus className="h-3.5 w-3.5" />}
            open={playerOpen}
            onToggleOpen={() => setPlayerOpen((v) => !v)}
            cap={playerCap}
            onCapChange={setPlayerCap}
            count={countsLoaded ? playerCount : 0}
            accentColor={liveAccent}
          />
        </div>
      </Panel>

      <Panel>
        <SectionLabel icon={<Link2 className="h-3 w-3" />}>Shareable Links</SectionLabel>
        <div className="space-y-3">
          <LinkRow
            label={showSplitLinks ? "General link (shows both options)" : "Shareable link"}
            url={baseLink}
            copied={copiedKey === "base"}
            onCopy={() => copyLink("base", baseLink)}
          />

          {showSplitLinks && (
            <>
              <LinkRow label="Team-only link" url={teamLink} copied={copiedKey === "team"} onCopy={() => copyLink("team", teamLink)} />
              <LinkRow
                label="Player-only link"
                url={playerLink}
                copied={copiedKey === "player"}
                onCopy={() => copyLink("player", playerLink)}
              />
            </>
          )}

          {!isActive && (
            <p className="text-yellow-400/80 text-[11px] flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Inactive forms 404 on these links — flip it back to Active to accept submissions again.
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}

function FormDetailsPanel({
  form,
  org,
  pendingCount,
  name,
  setName,
  bannerUrl,
  setBannerUrl,
  welcomeMessage,
  setWelcomeMessage,
  accentColor,
  setAccentColor,
  liveAccent,
  isActive,
  setIsActive,
  isSaving,
  saved,
  saveError,
  isDeleting,
  onSave,
  onDelete,
}: {
  form: RegistrationForm
  org: OrgSummary
  pendingCount: number
  name: string
  setName: (v: string) => void
  bannerUrl: string
  setBannerUrl: (v: string) => void
  welcomeMessage: string
  setWelcomeMessage: (v: string) => void
  accentColor: string
  setAccentColor: (v: string) => void
  liveAccent: string
  isActive: boolean
  setIsActive: (fn: (v: boolean) => boolean) => void
  isSaving: boolean
  saved: boolean
  saveError: string | null
  isDeleting: boolean
  onSave: () => void
  onDelete: () => void
}) {
  return (
    <Panel>
      {/* Header — name, live status, delete */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <FieldLabel>Form name</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-black/50 border-gold/30 text-white font-cinzel font-bold"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-5">
          {pendingCount > 0 && <StatusBadge tone="warn">{pendingCount} pending</StatusBadge>}
          <button
            onClick={() => setIsActive((v) => !v)}
            className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-cinzel px-2.5 py-1 rounded-full border transition-colors ${
              isActive ? "border-gold/40 text-gold" : "border-white/15 text-gray-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-gold" : "bg-gray-600"}`}
              aria-hidden
            />
            {isActive ? "Active" : "Inactive"}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete form"
            className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Banner — doubles as a live preview of the form's hero, with the
          name overlaid so it's obvious this is "what applicants will see"
          rather than just an image field. */}
      <div className="mb-5">
        <SectionLabel icon={<ImageIcon className="h-3 w-3" />}>Banner preview</SectionLabel>
        <div
          className="relative h-32 rounded-lg overflow-hidden border bg-black/60 mb-2 flex items-center justify-center"
          style={{ borderColor: `${liveAccent}40` }}
        >
          {bannerUrl ? (
            <>
              <Image src={bannerUrl} alt="" className="h-full w-full object-cover" width={1200} height={300} />
              <div
                className="absolute inset-x-0 bottom-0 h-16 flex items-end px-4 pb-2.5"
                style={{ background: `linear-gradient(to top, ${liveAccent}33, transparent)` }}
              >
                <p className="text-white text-sm font-cinzel font-bold drop-shadow-md truncate">{name || form.name}</p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-gray-600">
              <ImageIcon className="h-5 w-5" />
              <p className="text-xs italic">No banner set — a plain header is used instead</p>
            </div>
          )}
        </div>
        <div className="mt-2">
          <ImageUploadField
            auctionId={org.id}
            kind="organization"
            value={bannerUrl}
            onChange={setBannerUrl}
            label="Upload Banner"
            accentColor={liveAccent}
          />
        </div>
      </div>

      {/* Branding — welcome message + accent color, with a live swatch that
          shows the accent as it'll actually appear on a button. */}
      <div className="mb-5 pt-5 border-t border-white/5">
        <SectionLabel icon={<Palette className="h-3 w-3" />}>Branding</SectionLabel>
        <div className="mb-3">
          <FieldLabel>Welcome message (optional)</FieldLabel>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={3}
            placeholder="e.g. Registration closes August 15th. Entry fee: LKR 5,000 per team."
            className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5 resize-none focus-visible:ring-1 focus-visible:ring-gold/40 outline-none"
          />
        </div>
        <div>
          <FieldLabel>Accent color (optional)</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={liveAccent}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-10 w-14 rounded-md border border-gold/30 bg-black/50 cursor-pointer shrink-0"
            />
            <Input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder="Default gold"
              className="bg-black/50 border-gold/30 text-white flex-1"
            />
            <span
              className="hidden sm:flex shrink-0 h-10 px-3 items-center rounded-md text-xs font-bold font-cinzel"
              style={{ backgroundColor: liveAccent, color: "#0a0a0a" }}
            >
              <Button
                onClick={onSave}
                disabled={isSaving || saved}
                className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-70 mt-5 flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                  </>
                ) : saved ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Saved — closing…
                  </>
                ) : (
                  "Save form"
                )}
              </Button>
            </span>
          </div>
          <p className="text-gray-600 text-[11px] mt-1.5">
            Replaces the gold accents on this registration page only — nothing else in your dashboard changes.
          </p>
        </div>
      </div>

      {saveError && (
        <p className="flex items-center gap-1.5 text-red-500 text-sm mt-5">
          <AlertCircle className="h-4 w-4" /> {saveError}
        </p>
      )}
    </Panel>
  )
}

function FormEditorCard({
  form,
  org,
  pendingCount,
  onSaved,
  onDeleted,
  onDone,
}: {
  form: RegistrationForm
  org: OrgSummary
  pendingCount: number
  onSaved: (updated: RegistrationForm) => void
  onDeleted: () => void
  onDone: () => void
}) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const [name, setName] = useState(form.name)
  const [bannerUrl, setBannerUrl] = useState(form.bannerUrl ?? "")
  const [welcomeMessage, setWelcomeMessage] = useState(form.welcomeMessage ?? "")
  const [accentColor, setAccentColor] = useState(form.accentColor ?? "")
  const [teamOpen, setTeamOpen] = useState(form.teamOpen)
  const [playerOpen, setPlayerOpen] = useState(form.playerOpen)
  const [teamCap, setTeamCap] = useState(form.teamCap != null ? String(form.teamCap) : "")
  const [playerCap, setPlayerCap] = useState(form.playerCap != null ? String(form.playerCap) : "")
  const [isActive, setIsActive] = useState(form.isActive)

  const [teamCount, setTeamCount] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [countsLoaded, setCountsLoaded] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copiedKey, setCopiedKey] = useState<"" | "base" | "team" | "player">("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    Promise.all([getRegistrationCount(form.id, "team"), getRegistrationCount(form.id, "player")]).then(
      ([tCount, pCount]) => {
        setTeamCount(tCount)
        setPlayerCount(pCount)
        setCountsLoaded(true)
      }
    )
  }, [form.id])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const baseLink = `${origin}/register/${org.slug}/${form.slug}`
  const teamLink = `${baseLink}?type=team`
  const playerLink = `${baseLink}?type=player`

  // The accent color drives every live-preview surface in this editor
  // (banner overlay, accent swatch, capacity bars) so a form's identity
  // is visible while editing it, not just after visiting its live link.
  const liveAccent = accentColor || DEFAULT_ACCENT

  // The team/player split only means anything when a form actually has
  // both types open — on a form where only one is open, the base link
  // already goes straight to that type, so a separate ?type= link would
  // just be a redundant duplicate of the same URL.
  const showSplitLinks = teamOpen && playerOpen

  const copyLink = (key: "base" | "team" | "player", value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 1500)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaved(false)
    const result = await updateRegistrationForm(form.id, {
      name,
      bannerUrl,
      welcomeMessage,
      accentColor,
      teamCap: teamCap.trim() ? Number(teamCap) : null,
      playerCap: playerCap.trim() ? Number(playerCap) : null,
      teamOpen,
      playerOpen,
      isActive,
    })
    setIsSaving(false)
    if (!result.ok) {
      setSaveError(result.error ?? "Couldn't save changes.")
      return
    }
    onSaved({
      ...form,
      name,
      bannerUrl: bannerUrl || null,
      welcomeMessage: welcomeMessage || null,
      accentColor: accentColor || null,
      teamCap: teamCap.trim() ? Number(teamCap) : null,
      playerCap: playerCap.trim() ? Number(playerCap) : null,
      teamOpen,
      playerOpen,
      isActive,
    })
    // Show a brief "Saved ✓" confirmation, then collapse back to the
    // summary card automatically — saving is the signal that the user
    // is done editing, so there's no need to make them collapse by hand.
    setSaved(true)
    setTimeout(() => {
      onDone()
    }, SAVE_COLLAPSE_DELAY_MS)
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete "${form.name}"?`,
      description: "This can't be undone. If registrations have already been submitted through this form, deactivate it instead.",
      confirmText: "Delete",
      tone: "danger",
    })
    if (!ok) return
    setIsDeleting(true)
    const result = await deleteRegistrationForm(form.id)
    setIsDeleting(false)
    if (!result.ok) {
      setSaveError(result.error ?? "Couldn't delete this form.")
      return
    }
    onDeleted()
  }

  // Spans the full width of the parent grid (all breakpoints) and lays
  // out its own two panels side by side, so exactly one form's full
  // editor can be open at a time while the rest of the forms stay
  // collapsed as summary cards.
  return (
    <div className="col-span-1 md:col-span-2 lg:col-span-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-cinzel uppercase tracking-widest text-gray-500">
          Editing <span className="text-gold">{form.name}</span>
        </p>
        <button
          onClick={onDone}
          className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-widest text-gray-400 hover:text-gold transition-colors"
        >
          <ChevronUp className="h-3.5 w-3.5" /> Collapse
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <FormCapsAndLinksPanel
          teamOpen={teamOpen}
          setTeamOpen={setTeamOpen}
          playerOpen={playerOpen}
          setPlayerOpen={setPlayerOpen}
          teamCap={teamCap}
          setTeamCap={setTeamCap}
          playerCap={playerCap}
          setPlayerCap={setPlayerCap}
          teamCount={teamCount}
          playerCount={playerCount}
          countsLoaded={countsLoaded}
          liveAccent={liveAccent}
          isActive={isActive}
          baseLink={baseLink}
          teamLink={teamLink}
          playerLink={playerLink}
          showSplitLinks={showSplitLinks}
          copiedKey={copiedKey}
          copyLink={copyLink}
        />
        <FormDetailsPanel
          form={form}
          org={org}
          pendingCount={pendingCount}
          name={name}
          setName={setName}
          bannerUrl={bannerUrl}
          setBannerUrl={setBannerUrl}
          welcomeMessage={welcomeMessage}
          setWelcomeMessage={setWelcomeMessage}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          liveAccent={liveAccent}
          isActive={isActive}
          setIsActive={setIsActive}
          isSaving={isSaving}
          saved={saved}
          saveError={saveError}
          isDeleting={isDeleting}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </div>
      {ConfirmDialogElement}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  CREATE FORM PANEL — collapsed by default once the org has at least    */
/*  one form; open by default for a brand-new org with none yet.          */
/* ────────────────────────────────────────────────────────────────── */

function CreateFormPanel({
  org,
  userId,
  hasForms,
  onCreated,
}: {
  org: OrgSummary
  userId: string
  hasForms: boolean
  onCreated: (newFormId?: string) => void
}) {
  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openSignal, setOpenSignal] = useState(0)

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    setError(null)
    const result = await createRegistrationForm(org.id, userId, { name })
    setIsCreating(false)
    if (result.error || !result.id) {
      setError(result.error ?? "Couldn't create the form.")
      setOpenSignal((s) => s + 1)
      return
    }
    setName("")
    onCreated(result.id)
  }

  return (
    <CollapsibleCreatePanel title="New registration form" icon={<Plus className="h-4 w-4 text-gold" />} defaultOpen={!hasForms} openSignal={openSignal}>
      <p className="text-gray-500 text-xs mb-4">
        Each form gets its own link, banner, welcome message, and open/closed status — but every approved submission
        still lands in the same org-wide Team Pool and Player Bank.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summer Cup 2026 Registration"
          className="bg-black/50 border-gold/30 text-white flex-1"
        />
        <Button onClick={handleCreate} disabled={isCreating || !name.trim()} className="bg-gold hover:bg-gold/90 text-black font-bold whitespace-nowrap">
          {isCreating ? "Creating…" : "Create form"}
        </Button>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
    </CollapsibleCreatePanel>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  REGISTRATIONS TAB                                                    */
/*                                                                        */
/*  Layout: create-form panel, then a grid of form cards — collapsed as   */
/*  compact FormSummaryCards by default (1 col on mobile, 2 on tablet,    */
/*  3 on laptop and up), with at most one expanded into the full          */
/*  FormEditorCard (spanning the full row) at a time — then the           */
/*  registrations list as its own full-width panel underneath.            */
/* ────────────────────────────────────────────────────────────────── */

export function RegistrationsTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const [forms, setForms] = useState<RegistrationForm[]>([])
  const [formsLoaded, setFormsLoaded] = useState(false)
  const [editingFormId, setEditingFormId] = useState<string | null>(null)

  const [regs, setRegs] = useState<PendingRegistration[]>([])
  const [loaded, setLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [formFilter, setFormFilter] = useState<string>("")
  const [query, setQuery] = useState("")

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const reloadForms = () => getRegistrationFormsForOrg(org.id).then((f) => {
    setForms(f)
    setFormsLoaded(true)
  })

  const reloadRegs = () => {
    setSyncing(true)
    return getRegistrationsForOrg(org.id).then((r) => {
      setRegs(r)
      setLoaded(true)
      setSyncing(false)
    })
  }

  useEffect(() => {
    reloadForms()
    reloadRegs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  useEffect(() => {
    const channel = subscribeToOrgRegistrations(org.id, () => reloadRegs())
    return () => unsubscribe(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  useRefetchOnFocus(reloadRegs)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return regs.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (typeFilter !== "all" && r.type !== typeFilter) return false
      if (formFilter && r.formId !== formFilter) return false
      if (!q) return true
      const payload = r.payload as any
      return (
        (payload.name ?? "").toLowerCase().includes(q) ||
        r.contactEmail.toLowerCase().includes(q) ||
        r.contactName.toLowerCase().includes(q)
      )
    })
  }, [regs, statusFilter, typeFilter, formFilter, query])

  const pendingCount = useMemo(() => regs.filter((r) => r.status === "pending").length, [regs])
  const pendingCountByForm = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of regs) {
      if (r.status === "pending" && r.formId) map[r.formId] = (map[r.formId] ?? 0) + 1
    }
    return map
  }, [regs])
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

  const registrationsPanel = (
    <Panel>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-white font-cinzel flex items-center gap-2 flex-wrap">
          <Inbox className="h-4 w-4 text-gold" /> Registrations
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
        {(["all", "pending", "rejected", "approved"] as StatusFilter[]).map((f) => (
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
        {forms.length > 1 && (
          <StyledSelect
            value={formFilter}
            onChange={(e) => setFormFilter(e.target.value)}
            placeholder="All forms"
            className="w-44 ml-auto"
          >
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </StyledSelect>
        )}
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

          {/* Full-width row now that this panel sits below the form editors
              instead of squeezed into a third column, so cards can run up
              to four across instead of three. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
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
        </div>
      )}
    </Panel>
  )

  return (
    <div className="space-y-6">
      <CreateFormPanel
        org={org}
        userId={userId}
        hasForms={forms.length > 0}
        onCreated={(newFormId) => {
          reloadForms()
          if (newFormId) setEditingFormId(newFormId)
        }}
      />

      {!formsLoaded ? (
        <Panel>
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading registration forms…
          </p>
        </Panel>
      ) : forms.length > 0 ? (
        // 1 column on mobile, 2 on tablet, 3 on laptop+ — a single open
        // FormEditorCard spans the full row at every breakpoint so it
        // never gets squeezed beside a summary card.
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {forms.map((form) =>
            editingFormId === form.id ? (
              <FormEditorCard
                key={form.id}
                form={form}
                org={org}
                pendingCount={pendingCountByForm[form.id] ?? 0}
                onSaved={(updated) => setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))}
                onDeleted={() => {
                  setForms((prev) => prev.filter((f) => f.id !== form.id))
                  if (formFilter === form.id) setFormFilter("")
                  setEditingFormId(null)
                }}
                onDone={() => setEditingFormId(null)}
              />
            ) : (
              <FormSummaryCard
                key={form.id}
                form={form}
                org={org}
                pendingCount={pendingCountByForm[form.id] ?? 0}
                onEdit={() => setEditingFormId(form.id)}
              />
            )
          )}
        </div>
      ) : null}

      {/* Registrations list now sits below the form editor(s) as its own
          full-width row, instead of being pinned alongside them in a
          third column. */}
      {registrationsPanel}

      {ConfirmDialogElement}
    </div>
  )
}