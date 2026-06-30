"use client";

import { useState } from "react";
import type { SessionConfig } from "@/types/auction";

interface SessionTabProps {
  locked: boolean;
  session: SessionConfig;
  onSessionChange: (session: SessionConfig) => void;
}

function LockBanner() {
  return (
    <div
      className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
      style={{ background: "var(--color-warning-container)", border: "1px solid var(--color-warning-outline)" }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-warning)", flexShrink: 0 }}>lock</span>
      <p style={{ fontSize: "12px", color: "var(--color-warning)", fontFamily: "var(--font-body-md)" }}>
        Session config is <strong>locked</strong> while the auction is live. Stop or re-auction to make changes.
      </p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
      {children}
    </label>
  );
}

const inputBase: React.CSSProperties = {
  background: "var(--color-surface-container-low)",
  border: "1px solid var(--color-border-overlay)",
  color: "var(--color-on-surface)",
  fontFamily: "var(--font-body-md)",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "14px",
  width: "100%",
  outline: "none",
};

function TextInput({
  value, onChange, placeholder, disabled, mono,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{ ...inputBase, fontFamily: mono ? "var(--font-label-mono)" : "var(--font-body-md)", cursor: disabled ? "not-allowed" : "auto", opacity: disabled ? 0.5 : 1 }}
      onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = "var(--color-theme-orange)"; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border-overlay)"; }}
    />
  );
}

function NumberInput({
  value, onChange, min, suffix, disabled,
}: {
  value: number; onChange: (v: number) => void; min?: number; suffix?: string; disabled?: boolean;
}) {
  return (
    <div
      className="flex items-center rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--color-border-overlay)", background: disabled ? "var(--color-surface-container-lowest)" : "var(--color-surface-container-low)" }}
    >
      <input
        type="number" min={min ?? 0} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        style={{ color: disabled ? "var(--color-surface-variant)" : "var(--color-on-surface)", fontFamily: "var(--font-label-mono)", cursor: disabled ? "not-allowed" : "auto" }}
        onFocus={(e) => { if (!disabled) e.currentTarget.parentElement!.style.borderColor = "var(--color-theme-orange)"; }}
        onBlur={(e)  => { e.currentTarget.parentElement!.style.borderColor = "var(--color-border-overlay)"; }}
      />
      {suffix && (
        <span className="px-3 text-xs border-l" style={{ color: "var(--color-on-surface-variant)", borderColor: "var(--color-border-overlay)", fontFamily: "var(--font-label-mono)" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch" aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{
        background: checked ? (disabled ? "rgba(201,151,31,0.3)" : "var(--color-theme-orange)") : "var(--color-surface-container-low)",
        border: "1px solid var(--color-border-overlay)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full shadow-md bg-white"
        style={{ left: checked ? "calc(100% - 22px)" : "2px", transition: "left 0.2s ease" }}
      />
    </button>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--color-surface-glass)", backdropFilter: "blur(24px)", border: "1px solid var(--color-border-overlay)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
    >
      <div className="mb-5 pb-4 border-b" style={{ borderColor: "var(--color-outline-variant)" }}>
        <h3 style={{ fontFamily: "var(--font-headline-md)", fontSize: "18px", fontWeight: 700, color: "var(--color-on-surface)" }}>{title}</h3>
        {description && <p className="mt-1 text-xs" style={{ color: "var(--color-on-surface-variant)", fontFamily: "var(--font-body-md)" }}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

const ACCESS_MODES: { value: SessionConfig["accessMode"]; label: string; desc: string }[] = [
  { value: "private",   label: "Private",           desc: "Owners only via PIN" },
  { value: "spectator", label: "Spectator Link",     desc: "Public read-only view" },
  { value: "broadcast", label: "Broadcast Display",  desc: "Fullscreen big-screen mode" },
];

export default function SessionTab({ locked, session, onSessionChange }: SessionTabProps) {
  const [saved, setSaved] = useState(false);

  function update<K extends keyof SessionConfig>(key: K, value: SessionConfig[K]) {
    if (locked) return;
    onSessionChange({ ...session, [key]: value });
  }

  function handleSave() {
    if (locked) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      {/* Save toast */}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-xl z-50"
        style={{
          background: "var(--color-surface-container)",
          border: "1px solid rgba(201,151,31,0.4)",
          opacity: saved ? 1 : 0,
          transform: saved ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(16px)",
          transition: "all 0.3s ease",
          pointerEvents: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--color-success)" }}>check_circle</span>
        <span style={{ fontFamily: "var(--font-label-mono)", fontSize: "12px", color: "var(--color-on-surface)" }}>Session config saved</span>
      </div>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 style={{ fontFamily: "var(--font-headline-lg)", fontSize: "32px", lineHeight: "40px", fontWeight: 700, color: "var(--color-on-surface)" }}>
            Session Configuration
          </h2>
          <p className="mt-1.5 max-w-xl" style={{ fontFamily: "var(--font-body-md)", fontSize: "14px", lineHeight: "22px", color: "var(--color-on-surface-variant)" }}>
            Set the auction's identity, timing, and access mode before launch.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={locked}
          className="px-5 py-2.5 font-bold flex items-center gap-1.5 rounded-xl transition-all whitespace-nowrap ml-6"
          style={{
            background: locked ? "var(--color-surface-container-high)" : "var(--color-theme-orange)",
            color: locked ? "var(--color-surface-variant)" : "var(--color-on-primary)",
            boxShadow: locked ? "none" : "0 0 20px rgba(201,151,31,0.25)",
            fontFamily: "var(--font-label-mono)", fontSize: "12px",
            cursor: locked ? "not-allowed" : "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>save</span>
          Save Session
        </button>
      </div>

      {locked && <LockBanner />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Identity */}
          <Section title="Auction Identity" description="Name and branding shown to all participants and on the broadcast display.">
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <FieldLabel>Auction Name *</FieldLabel>
                <TextInput value={session.auctionName} onChange={(v) => update("auctionName", v)} placeholder="e.g. APL Season 1 Auction" disabled={locked} />
              </div>
              <div>
                <FieldLabel>Auctioneer Name</FieldLabel>
                <TextInput value={session.auctioneer} onChange={(v) => update("auctioneer", v)} placeholder="e.g. Mr. K. Perera" disabled={locked} />
              </div>
              <div>
                <FieldLabel>Venue</FieldLabel>
                <TextInput value={session.venue} onChange={(v) => update("venue", v)} placeholder="e.g. Colombo Oval" disabled={locked} />
              </div>

              {/* NEW: Auction Logo — identifies WHO is conducting this auction, not a team logo */}
              <div className="col-span-2">
                <FieldLabel>Auction Logo (URL)</FieldLabel>
                <div className="flex items-center gap-3">
                  {session.auctionLogo && (
                    <img
                      src={session.auctionLogo}
                      alt="Auction logo preview"
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      style={{ border: "1px solid var(--color-border-overlay)" }}
                    />
                  )}
                  <div className="flex-1">
                    <TextInput
                      value={session.auctionLogo}
                      onChange={(v) => update("auctionLogo", v)}
                      placeholder="https://… logo image URL"
                      disabled={locked}
                      mono
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-[10px]" style={{ color: "var(--color-outline)" }}>
                  Shown on the broadcast display and spectator link header — represents the organizer, not any single team.
                </p>
              </div>
            </div>
          </Section>

          {/* Scheduling */}
          <Section title="Scheduling" description="Date and time shown on the broadcast screen and confirmation emails.">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Auction Date</FieldLabel>
                <input
                  type="date"
                  value={session.auctionDate}
                  onChange={(e) => update("auctionDate", e.target.value)}
                  disabled={locked}
                  style={{ ...inputBase, cursor: locked ? "not-allowed" : "auto", opacity: locked ? 0.5 : 1, colorScheme: "dark" }}
                  onFocus={(e) => { if (!locked) e.currentTarget.style.borderColor = "var(--color-theme-orange)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border-overlay)"; }}
                />
              </div>
              <div>
                <FieldLabel>Start Time</FieldLabel>
                <input
                  type="time"
                  value={session.auctionTime}
                  onChange={(e) => update("auctionTime", e.target.value)}
                  disabled={locked}
                  style={{ ...inputBase, cursor: locked ? "not-allowed" : "auto", opacity: locked ? 0.5 : 1, colorScheme: "dark" }}
                  onFocus={(e) => { if (!locked) e.currentTarget.style.borderColor = "var(--color-theme-orange)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border-overlay)"; }}
                />
              </div>
              <div>
                <FieldLabel>Bid Countdown Timer</FieldLabel>
                <NumberInput value={session.timerSeconds} min={5} onChange={(v) => update("timerSeconds", v)} suffix="sec" disabled={locked} />
                <p className="mt-1.5 text-[10px]" style={{ color: "var(--color-outline)" }}>Timer resets to this value on every new bid.</p>
              </div>
            </div>
          </Section>

          {/* Access Mode */}
          <Section title="Access Mode" description="Controls who can view and join the live auction environment.">
            <div className="grid grid-cols-3 gap-3 mb-5">
              {ACCESS_MODES.map((mode) => {
                const isActive = session.accessMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    onClick={() => !locked && update("accessMode", mode.value)}
                    disabled={locked}
                    className="flex flex-col gap-2 p-4 rounded-xl border transition-all text-left"
                    style={{
                      background: isActive ? "rgba(201,151,31,0.08)" : "var(--color-surface-container-low)",
                      borderColor: isActive ? "rgba(201,151,31,0.4)" : "var(--color-border-overlay)",
                      cursor: locked ? "not-allowed" : "pointer",
                      opacity: locked ? 0.6 : 1,
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: isActive ? "var(--color-theme-orange)" : "var(--color-surface-variant)", boxShadow: isActive ? "0 0 6px rgba(201,151,31,0.6)" : "none" }}
                    />
                    <p className="text-xs font-bold" style={{ color: isActive ? "var(--color-theme-orange)" : "var(--color-on-surface-variant)", fontFamily: "var(--font-label-mono)" }}>
                      {mode.label}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--color-outline)" }}>{mode.desc}</p>
                  </button>
                );
              })}
            </div>

            {session.accessMode !== "private" && (
              <div>
                <FieldLabel>Spectator / Broadcast Link</FieldLabel>
                <TextInput value={session.spectatorLink} onChange={(v) => update("spectatorLink", v)} placeholder="apl-auction.live/watch/s1" disabled={locked} mono />
                <p className="mt-1.5 text-[10px]" style={{ color: "var(--color-outline)" }}>Share this URL with spectators or display on a second screen.</p>
              </div>
            )}
          </Section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Toggles */}
          <Section title="Optional Rules">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-on-surface)" }}>Owner Participation</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--color-on-surface-variant)" }}>Owners play in their own squad.</p>
                </div>
                <Toggle checked={session.ownerParticipation} onChange={(v) => update("ownerParticipation", v)} disabled={locked} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-on-surface)" }}>Unsold Re-introduction</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--color-on-surface-variant)" }}>Unsold players re-enter at the end of the main auction.</p>
                </div>
                <Toggle checked={session.unsoldReintroduce} onChange={(v) => update("unsoldReintroduce", v)} disabled={locked} />
              </div>
            </div>
          </Section>

          {/* Session summary */}
          <div className="p-4 rounded-xl" style={{ background: "rgba(201,151,31,0.04)", border: "1px solid rgba(201,151,31,0.15)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}>
              Session Summary
            </p>
            <div className="flex flex-col gap-3">
              {[
                { label: "Name",        value: session.auctionName || "—" },
                { label: "Auctioneer",  value: session.auctioneer  || "—" },
                { label: "Date",        value: session.auctionDate  || "—" },
                { label: "Time",        value: session.auctionTime  || "—" },
                { label: "Venue",       value: session.venue        || "—" },
                { label: "Logo",        value: session.auctionLogo ? "Set" : "—" },
                { label: "Timer",       value: `${session.timerSeconds}s` },
                { label: "Access",      value: session.accessMode },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between text-[11px] pb-2.5 border-b last:border-b-0 last:pb-0"
                  style={{ borderColor: "var(--color-outline-variant)" }}
                >
                  <span style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}>{row.label}</span>
                  <span style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-label-mono)", fontWeight: 700, maxWidth: "120px", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}