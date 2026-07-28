"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"

/* ────────────────────────────────────────────────────────────────── */
/*  DESIGN TOKENS — every badge/status color in the organization        */
/*  dashboard reads from this one map instead of each tab inventing its  */
/*  own gold/warn/muted palette. Add a new tone here once; every tab     */
/*  that references it stays in sync automatically.                     */
/* ────────────────────────────────────────────────────────────────── */

export type Tone =
  | "linked" // this thing is connected to something (tournament, overlay configured…)
  | "none" // explicitly not connected — a real, visible state, not an absence
  | "warn" // needs attention (overlay not set, pending registration, setup status)
  | "neutral" // informational, low-emphasis tag
  | "success" // completed / approved / live
  | "danger" // rejected / failed

export const statusColors: Record<Tone, { border: string; text: string; bg: string; glyph: string }> = {
  linked: { border: "border-gold/40", text: "text-gold", bg: "bg-gold/[0.06]", glyph: "✓" },
  none: { border: "border-white/15", text: "text-gray-400", bg: "bg-white/[0.02]", glyph: "✗" },
  warn: { border: "border-yellow-500/40", text: "text-yellow-400", bg: "bg-yellow-500/[0.08]", glyph: "⚠" },
  neutral: { border: "border-white/15", text: "text-gray-300", bg: "bg-white/[0.02]", glyph: "" },
  success: { border: "border-green-500/40", text: "text-green-400", bg: "bg-green-500/[0.08]", glyph: "" },
  danger: { border: "border-red-500/40", text: "text-red-400", bg: "bg-red-500/[0.08]", glyph: "" },
}

/* ────────────────────────────────────────────────────────────────── */
/*  PANEL — the one gold-bordered card treatment used everywhere.        */
/*  `emphasis="primary"` gives the day-to-day working panel (the queue    */
/*  people actually use) a slightly stronger header bar so it doesn't     */
/*  compete visually with one-time setup panels on the same tab.          */
/* ────────────────────────────────────────────────────────────────── */

export function Panel({
  children,
  className = "",
  emphasis = "default",
}: {
  children: React.ReactNode
  className?: string
  emphasis?: "default" | "primary"
}) {
  return (
    <div
      className={`bg-black/50 border shine transition-all duration-300 rounded-lg shadow-lg shadow-black/40 ${
        emphasis === "primary"
          ? "border-gold/30 hover:border-gold/50"
          : "border-gold/20 hover:border-gold/40"
      } p-6 md:p-8 ${className}`}
    >
      {children}
    </div>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] uppercase tracking-widest text-gold/70 font-cinzel block mb-1.5">{children}</label>
}

export function StatusBadge({ tone, children, pulse = false }: { tone: Tone; children: React.ReactNode; pulse?: boolean }) {
  const s = statusColors[tone]
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded-full border ${s.border} ${s.text} ${s.bg}`}
    >
      {pulse && <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
      {!pulse && s.glyph && <span>{s.glyph}</span>}
      {children}
    </span>
  )
}

/** Auction lifecycle badge (setup/live/paused/completed) — a distinct
 *  vocabulary from the linked/warn/neutral tones above, but drawn from
 *  the same statusColors map so the palette never drifts apart. */
const AUCTION_STATUS_TONE: Record<string, Tone> = {
  setup: "warn",
  live: "success",
  paused: "warn",
  completed: "none",
}

export function AuctionStatusBadge({ status }: { status: string }) {
  const tone = AUCTION_STATUS_TONE[status] ?? "warn"
  return (
    <StatusBadge tone={tone} pulse={status === "live"}>
      {status}
    </StatusBadge>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  STYLED SELECT — gold border, custom chevron, disabled state.         */
/* ────────────────────────────────────────────────────────────────── */

export function StyledSelect({
  value,
  onChange,
  disabled,
  placeholder,
  children,
  className = "",
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  disabled?: boolean
  placeholder: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full appearance-none bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5 pr-9 outline-none focus:border-gold/70 focus:ring-1 focus:ring-gold/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="h-3.5 w-3.5 text-gold/50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  COLLAPSIBLE CREATE PANEL — demotes a one-time "create X" form out     */
/*  of the permanent scrolling flow. Closed by default for anyone who     */
/*  already has items in the list below (the common case for a           */
/*  returning user); open by default when the list is empty, since        */
/*  that's the very first thing a brand-new org needs to do.              */
/* ────────────────────────────────────────────────────────────────── */

export function CollapsibleCreatePanel({
  title,
  icon,
  children,
  defaultOpen = false,
  openSignal,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  /** bump this value (e.g. a counter) to force the panel open again, such as after a successful create so the user sees the list update, or to re-open on error */
  openSignal?: number
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Panel className="!p-0 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-6 md:px-8 py-5 text-left"
      >
        <span className="flex items-center gap-2 text-base font-bold text-white font-cinzel">
          {icon ?? <Plus className="h-4 w-4 text-gold" />}
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-gold/60 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gold/60 shrink-0" />
        )}
      </button>
      {open && <div className="px-6 md:px-8 pb-6 md:pb-8 pt-1 border-t border-white/5">{children}</div>}
    </Panel>
  )
}