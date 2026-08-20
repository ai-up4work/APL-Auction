// components/overlays/admin/ui.tsx
"use client";

import React, { useState } from "react";
import { ChevronRight } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────
   DESIGN NOTES — this file now speaks the same visual language as the
   rest of the site (match-detail, tournament-detail, match-graphs):

     • black glass cards, gold borders at low opacity, backdrop-blur
     • font-cinzel for anything eyebrow/label/numeric — no more
       "font-label-mono" custom property; Cinzel + tracking-widest is
       the app's mono-esque data face
     • gold (#F5A623-ish, `text-gold` / `bg-gold` / `border-gold`) is
       the ONE accent; red/emerald only ever mean danger/positive
     • pill-shaped controls, hover lifts, subtle glow shadows — same
       as PointsTableRow / FilterBar / graph tabs elsewhere in the app

   All exports keep their original names/props so existing imports in
   page.tsx and LiveStatePanel.tsx don't need to change — only the
   rendering underneath does.
   ──────────────────────────────────────────────────────────────────── */

// ── Section — the glass card every tab in this app builds on ──────────
export function Section({
  title,
  description,
  children,
  accent,
  right,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  accent?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl p-6 bg-black/50 backdrop-blur-xl ${
        accent ? "border border-gold/30" : "border border-gold/10"
      }`}
    >
      <div className="mb-5 pb-4 border-b border-gold/10 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-cinzel text-lg font-bold text-white">{title}</h3>
          {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── Collapsible glass panel ─────────────────────────────────────────
export function DrawerSection({
  step,
  title,
  description,
  done,
  dirty,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  headerExtra,
  children,
}: {
  step?: string;
  title: string;
  description?: string;
  done?: boolean;
  dirty?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className="rounded-xl overflow-hidden bg-black/50 backdrop-blur-xl border border-gold/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-3 px-6 py-4 text-left ${
          open ? "border-b border-gold/10" : "border-b border-transparent"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {step && (
            <span className="text-[9px] font-black uppercase tracking-widest font-cinzel px-2 py-1 rounded-md flex-shrink-0 text-gold bg-gold/10 border border-gold/25">
              {step}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-cinzel text-[15px] font-bold text-white">{title}</h3>
            {description && <p className="truncate text-[11px] text-gray-400">{description}</p>}
          </div>
          {done && <Dot color="gold" title="Pushed" />}
          {dirty && <Dot color="amber" pulse title="Unpushed changes" />}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {headerExtra}
          <ChevronRight
            className="h-4 w-4 text-gray-500 transition-transform duration-200"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>
      {open && <div className="p-6 flex flex-col gap-5">{children}</div>}
    </div>
  );
}

export function Dot({
  color,
  pulse,
  title,
}: {
  color: "gold" | "amber" | string;
  pulse?: boolean;
  title?: string;
}) {
  const bg = color === "gold" ? "#F5A623" : color === "amber" ? "#F59E0B" : color;
  return (
    <span
      title={title}
      className={`w-2 h-2 rounded-full flex-shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ background: bg, boxShadow: `0 0 6px ${bg}` }}
    />
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[9px] font-bold uppercase tracking-widest font-cinzel mb-1.5 text-gray-400">
      {children}
    </span>
  );
}

export function Eyebrow({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`text-[9px] font-black uppercase tracking-widest font-cinzel ${className ?? ""}`}
      style={{ color: color ?? "#6b7280" }}
    >
      {children}
    </span>
  );
}

// ── Bare input ──────────────────────────────────────────────────────
const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-gold/10 text-gray-100 placeholder:text-gray-600 transition-colors focus:border-gold/50";

export function Input({
  value,
  onChange,
  placeholder,
  mono,
  type = "text",
  onKeyDown,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: "text" | "number";
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`${inputClass} ${mono ? "font-cinzel tabular-nums" : ""}`}
    />
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  maxLength,
  span,
  onKeyDown,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  maxLength?: number;
  span?: 1 | 2;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`${inputClass} ${mono ? "font-cinzel tabular-nums" : ""}`}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  span,
  compact,
  wrapperClassName,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  span?: 1 | 2;
  compact?: boolean;
  wrapperClassName?: string;
}) {
  return (
    <div className={[span === 2 ? "col-span-2" : "", wrapperClassName ?? ""].filter(Boolean).join(" ")}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none cursor-pointer ${compact ? "py-1.5 text-xs" : ""}`}
      >
        {children}
      </select>
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg cursor-pointer border border-gold/10 bg-transparent p-0.5"
          style={{ width: 34, height: 34 }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} flex-1 min-w-0 text-xs font-cinzel`}
        />
      </div>
    </div>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center rounded-lg overflow-hidden border border-gold/10 bg-white/[0.03]">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-8 h-9 flex items-center justify-center flex-shrink-0 font-bold text-gray-400 hover:text-gold transition-colors"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          className="w-full text-center text-sm outline-none bg-transparent text-white font-cinzel tabular-nums"
        />
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="w-8 h-9 flex items-center justify-center flex-shrink-0 font-bold text-gold hover:text-white transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function IconBtn({
  icon,
  onClick,
  danger,
  title,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors border border-gold/10 bg-white/[0.02] text-gray-400 ${
        danger ? "hover:text-red-400 hover:border-red-400/40" : "hover:text-gold hover:border-gold/40"
      }`}
    >
      <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
    </button>
  );
}

export function LinkBtn({
  children,
  onClick,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`text-[9px] font-bold uppercase tracking-wider font-cinzel underline-offset-2 hover:underline ${
        danger ? "text-red-400" : "text-gold"
      }`}
    >
      {children}
    </button>
  );
}

// ── Small utility button ───────────────────────────────────────────
export function SmallButton({
  children,
  onClick,
  style,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider font-cinzel transition-all flex-shrink-0 border ${
        disabled
          ? "opacity-50 cursor-not-allowed border-gold/10 text-gray-500 bg-white/[0.02]"
          : "border-gold/10 text-gray-400 bg-white/[0.02] hover:text-gold hover:border-gold/40 hover:bg-gold/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

// ── The big gold CTA ──────────────────────────────────────────────
export function PrimaryButton({
  children,
  onClick,
  minWidth,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  minWidth?: number;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ minWidth }}
      className={`py-2.5 px-6 rounded-full text-[11px] font-black uppercase tracking-wider font-cinzel transition-all ${
        disabled
          ? "bg-white/5 text-gray-600 cursor-not-allowed"
          : "bg-gold text-black hover:-translate-y-0.5 shadow-[0_0_18px_rgba(245,166,35,0.35)] hover:shadow-[0_0_24px_rgba(245,166,35,0.5)]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Segmented control ───────────────────────────────────────────────
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider font-cinzel transition-all border ${
              active
                ? "bg-gold text-black border-gold"
                : "bg-white/[0.02] border-gold/10 text-gray-500 hover:text-gold hover:border-gold/30"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Sub-card ─────────────────────────────────────────────────────────
export function SubCard({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-4 flex flex-col gap-3 bg-white/[0.02] border border-gold/10">
      <Eyebrow color={accent}>{title}</Eyebrow>
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 border ${
        checked
          ? disabled
            ? "bg-gold/30 border-gold/40"
            : "bg-gold border-gold/60"
          : "bg-white/[0.03] border-gold/10"
      } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all"
        style={{ left: checked ? "calc(100% - 22px)" : "2px" }}
      />
    </button>
  );
}

// ── Status pill ──────────────────────────────────────────────────────
export function StatusPill({
  label,
  tone = "neutral",
  pulse,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "error" | "orange";
  pulse?: boolean;
}) {
  const toneColor: Record<string, string> = {
    neutral: "#9ca3af",
    success: "#34d399",
    warning: "#f59e0b",
    error: "#f87171",
    orange: "#F5A623",
  };
  const c = toneColor[tone];

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] font-cinzel px-3 py-1 rounded-full border"
      style={{ color: c, background: `${c}18`, borderColor: `${c}40` }}
    >
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
      )}
      {label}
    </span>
  );
}

// ── Icon action button (FOUR / SIX / WICKET style controls) ─────────
export function ActionButton({
  icon,
  label,
  onClick,
  active,
  danger,
  full,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  full?: boolean;
}) {
  const accentClass = danger ? "text-red-400" : "text-gold";
  const activeBg = danger ? "bg-red-500/15 border-red-500/40" : "bg-gold/15 border-gold/40";
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider font-cinzel transition-all border ${
        full ? "w-full" : ""
      } ${
        active
          ? `${activeBg} ${accentClass}`
          : `bg-white/[0.02] border-gold/10 text-gray-400 hover:${accentClass} hover:border-gold/30`
      }`}
    >
      {icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      {label}
    </button>
  );
}

// ── Channel toggle row — "On Air / Standby" strip ────────────────────
export function ChannelRow({
  label,
  on,
  onToggle,
  tone = "orange",
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  tone?: "orange" | "error" | "blue";
}) {
  const accent = tone === "error" ? "#f87171" : tone === "blue" ? "#60a5fa" : "#F5A623";
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition-all border"
      style={{
        background: on ? `${accent}14` : "rgba(255,255,255,0.02)",
        borderColor: on ? `${accent}55` : "rgba(245,166,35,0.1)",
      }}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: on ? accent : "#4b5563", boxShadow: on ? `0 0 6px ${accent}` : "none" }}
        />
        <span
          className="text-[10.5px] font-bold uppercase tracking-wide font-cinzel truncate"
          style={{ color: on ? accent : "#e5e7eb" }}
        >
          {label}
        </span>
      </span>
      <span
        className="text-[8.5px] font-bold uppercase tracking-widest font-cinzel flex-shrink-0"
        style={{ color: on ? accent : "#6b7280" }}
      >
        {on ? "On Air" : "Standby"}
      </span>
    </button>
  );
}