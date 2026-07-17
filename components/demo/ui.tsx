// components/demo/ui.tsx
"use client";

import React, { useState } from "react";

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
      className="rounded-xl p-6"
      style={{
        background: "var(--color-surface-glass)",
        backdropFilter: "blur(24px)",
        border: accent ? "1px solid rgba(201,151,31,0.2)" : "1px solid var(--color-border-overlay)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div className="mb-5 pb-4 border-b flex items-center justify-between gap-3" style={{ borderColor: "var(--color-outline-variant)" }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-headline-md)", fontSize: "18px", fontWeight: 700, color: "var(--color-on-surface)" }}>
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs" style={{ color: "var(--color-on-surface-variant)", fontFamily: "var(--font-body-md)" }}>
              {description}
            </p>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── Collapsible glass panel — replaces the old <details className="rack-panel drawer"> ──
// Can be used uncontrolled (defaultOpen manages its own state) or controlled
// (pass `open` + `onOpenChange` to drive it from the parent, e.g. auto-close on push).
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
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--color-surface-glass)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--color-border-overlay)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left"
        style={{ borderBottom: open ? "1px solid var(--color-outline-variant)" : "1px solid transparent" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {step && (
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md flex-shrink-0"
              style={{
                fontFamily: "var(--font-label-mono)",
                color: "var(--color-theme-orange)",
                background: "rgba(201,151,31,0.1)",
                border: "1px solid rgba(201,151,31,0.25)",
              }}
            >
              {step}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate" style={{ fontFamily: "var(--font-headline-md)", fontSize: "16px", fontWeight: 700, color: "var(--color-on-surface)" }}>
              {title}
            </h3>
            {description && (
              <p className="truncate text-[11px]" style={{ fontFamily: "var(--font-body-md)", color: "var(--color-on-surface-variant)" }}>
                {description}
              </p>
            )}
          </div>
          {done && <Dot color="var(--color-theme-orange)" title="Pushed" />}
          {dirty && <Dot color="var(--color-warning)" pulse title="Unpushed changes" />}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {headerExtra}
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "20px",
              color: "var(--color-outline)",
              transition: "transform 0.2s ease",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            chevron_right
          </span>
        </div>
      </button>
      {open && <div className="p-6 flex flex-col gap-5">{children}</div>}
    </div>
  );
}

export function Dot({ color, pulse, title }: { color: string; pulse?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`w-2 h-2 rounded-full flex-shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="block text-[9px] font-bold uppercase tracking-widest mb-1.5"
      style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}
    >
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
      className={`text-[9px] font-black uppercase tracking-widest ${className ?? ""}`}
      style={{ fontFamily: "var(--font-label-mono)", color: color ?? "var(--color-outline)" }}
    >
      {children}
    </span>
  );
}

// ── Bare input — matches TeamsTab / PlayersTab field styling exactly ──
function inputBase(): React.CSSProperties {
  return {
    background: "var(--color-surface-container-low)",
    border: "1px solid var(--color-border-overlay)",
    color: "var(--color-on-surface)",
    fontFamily: "var(--font-body-md)",
  };
}
function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--color-theme-orange)";
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--color-border-overlay)";
}

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
      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
      style={{ ...inputBase(), ...(mono ? { fontFamily: "var(--font-label-mono)" } : {}) }}
      onFocus={focusOn}
      onBlur={focusOff}
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
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        style={{ ...inputBase(), ...(mono ? { fontFamily: "var(--font-label-mono)" } : {}) }}
        onFocus={focusOn}
        onBlur={focusOff}
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
        className={compact ? "select-input select-input-compact" : "select-input"}
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
          className="rounded-lg cursor-pointer"
          style={{ width: 34, height: 34, background: "transparent", border: "1px solid var(--color-border-overlay)", padding: 2 }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 rounded-lg px-3 py-2 text-xs outline-none"
          style={{ ...inputBase(), fontFamily: "var(--font-label-mono)" }}
          onFocus={focusOn}
          onBlur={focusOff}
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
      <div
        className="flex items-center rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--color-border-overlay)", background: "var(--color-surface-container-low)" }}
      >
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-8 h-9 flex items-center justify-center flex-shrink-0 font-bold"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          className="w-full text-center text-sm outline-none bg-transparent"
          style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-label-mono)" }}
        />
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="w-8 h-9 flex items-center justify-center flex-shrink-0 font-bold"
          style={{ color: "var(--color-theme-orange)" }}
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
  icon: string;
  onClick: () => void;
  danger?: boolean;
  title?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
      style={{
        background: "var(--color-surface-container)",
        border: "1px solid var(--color-border-overlay)",
        color: hovered ? (danger ? "var(--color-error)" : "var(--color-theme-orange)") : "var(--color-on-surface-variant)",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
        {icon}
      </span>
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
      className="text-[9px] font-bold uppercase tracking-wider underline-offset-2 hover:underline"
      style={{ fontFamily: "var(--font-label-mono)", color: danger ? "var(--color-error)" : "var(--color-theme-orange)" }}
    >
      {children}
    </button>
  );
}

// ── Small utility button — replaces the old fx-btn / fx-toggle-off class ──
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
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0"
      style={{
        fontFamily: "var(--font-label-mono)",
        background: hovered ? "rgba(201,151,31,0.12)" : "var(--color-surface-container-low)",
        border: "1px solid var(--color-border-overlay)",
        color: hovered ? "var(--color-theme-orange)" : "var(--color-on-surface-variant)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── The big orange CTA — replaces talk-btn ──
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
      className="py-2.5 px-6 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all hover:-translate-y-0.5"
      style={{
        minWidth,
        fontFamily: "var(--font-label-mono)",
        background: disabled ? "var(--color-surface-container-high)" : "var(--color-theme-orange)",
        color: disabled ? "var(--color-surface-variant)" : "var(--color-on-primary)",
        boxShadow: disabled ? "none" : "0 0 18px rgba(201,151,31,0.25)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ── Segmented control — replaces segment-group / segment-btn ──
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
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
            style={{
              fontFamily: "var(--font-label-mono)",
              background: active ? "rgba(201,151,31,0.15)" : "var(--color-surface-container-low)",
              border: active ? "1px solid rgba(201,151,31,0.4)" : "1px solid var(--color-border-overlay)",
              color: active ? "var(--color-theme-orange)" : "var(--color-outline)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Sub-card — replaces batter-card / bowler-card ──
export function SubCard({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)" }}
    >
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
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{
        background: checked ? (disabled ? "rgba(201,151,31,0.3)" : "var(--color-theme-orange)") : "var(--color-surface-container-low)",
        border: checked ? "1px solid rgba(201,151,31,0.5)" : "1px solid var(--color-border-overlay)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full shadow-md"
        style={{ background: "#fff", left: checked ? "calc(100% - 22px)" : "2px", transition: "left 0.2s ease" }}
      />
    </button>
  );
}

// ── Status pill — same shape as AuctionCard's status badge ─────────────
export function StatusPill({
  label,
  tone = "neutral",
  pulse,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "error" | "orange";
  pulse?: boolean;
}) {
  const toneColor = {
    neutral: "var(--color-outline)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    error: "var(--color-error)",
    orange: "var(--color-theme-orange)",
  }[tone];

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full"
      style={{
        fontFamily: "var(--font-label-mono)",
        color: toneColor,
        background: `${toneColor}18`,
        border: `1px solid ${toneColor}33`,
      }}
    >
      {pulse && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: toneColor, boxShadow: `0 0 6px ${toneColor}` }}
        />
      )}
      {label}
    </span>
  );
}

// ── Icon action button — used for the FOUR/SIX/WICKET style controls, and
// also for things like the sandbox "Open Preview" button. Handles two
// distinct icon systems used across the app:
//   1. Material Symbols icon name as a string, e.g. icon="open_in_new"
//      (rendered via the material-symbols-outlined font)
//   2. A React node, e.g. icon={<ExternalLink size={13} />}
//      (an actual icon component, from lucide-react or similar)
// The `solid` prop is an alias for `active` — some call sites (e.g. the
// sandbox control room) use `solid` to mean "filled/emphasized style".
export function ActionButton({
  icon,
  label,
  onClick,
  active,
  danger,
  solid,
  full,
}: {
  icon?: string | React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  solid?: boolean;
  full?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = active || solid;
  const accent = danger ? "var(--color-error)" : "var(--color-theme-orange)";
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${full ? "w-full" : ""}`}
      style={{
        fontFamily: "var(--font-label-mono)",
        background: isActive ? `${accent}22` : hovered ? `${accent}10` : "var(--color-surface-container-low)",
        border: `1px solid ${isActive ? `${accent}66` : "var(--color-border-overlay)"}`,
        color: isActive || hovered ? accent : "var(--color-on-surface-variant)",
      }}
    >
      {icon &&
        (typeof icon === "string" ? (
          <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
            {icon}
          </span>
        ) : (
          <span className="inline-flex items-center" style={{ fontSize: "15px" }}>
            {icon}
          </span>
        ))}
      {label}
    </button>
  );
}

// ── Channel toggle row — "On Air / Standby" strip ──────────────────────
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
  const accent = tone === "error" ? "var(--color-error)" : tone === "blue" ? "#3b82f6" : "var(--color-theme-orange)";
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition-all"
      style={{
        background: on ? `${accent}14` : "var(--color-surface-container-low)",
        border: `1px solid ${on ? `${accent}55` : "var(--color-border-overlay)"}`,
      }}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: on ? accent : "var(--color-surface-variant)", boxShadow: on ? `0 0 6px ${accent}` : "none" }}
        />
        <span
          className="text-[10.5px] font-bold uppercase tracking-wide truncate"
          style={{ fontFamily: "var(--font-label-mono)", color: on ? accent : "var(--color-on-surface)" }}
        >
          {label}
        </span>
      </span>
      <span
        className="text-[8.5px] font-bold uppercase tracking-widest flex-shrink-0"
        style={{ fontFamily: "var(--font-label-mono)", color: on ? accent : "var(--color-outline)" }}
      >
        {on ? "On Air" : "Standby"}
      </span>
    </button>
  );
}