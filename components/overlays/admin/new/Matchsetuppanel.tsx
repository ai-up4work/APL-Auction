"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MatchSetup, SquadPlayer, TeamInfo } from "@/lib/overlayBus";
import { ImageUploader } from "../ImageUploader";
import { LocationAutocompleteInput } from "../LocationAutocomplete";
import type { GeocodeMatch } from "@/lib/fetchVenueWeather";

/* ─────────────────────────────────────────────────────────────
   DESIGN CONSISTENCY PASS (this update):
   The previous pass matched fonts/colors/glass-panel usage to
   WeatherPanel & ScoringSection, but left a few controls using
   their own one-off styling instead of the app's established
   button/chip language. Fixed here:

   1) PRIMARY CTA — PrimaryButton now uses the exact same recipe
      as every other gold CTA in the app ("Push Weather", "Push
      Live State"): py-2, text-[10px], tracking-[0.14em]. It was
      previously py-2.5 / text-[11px] / tracking-[0.16em], which
      read as a slightly different (larger/looser) button style
      next to its siblings.

   2) "RELOAD" / "CLEAR" CONTROLS — were bare text links (no
      border, no background, bg-transparent). Every other
      clickable control in this app (TogglePill, SmallButton,
      MomentButton) is a bordered chip. Converted these to the
      same bordered-chip treatment so they read as buttons, not
      stray inline links.

   3) "EDIT" ON THE LOCKED BAR — was text-only. WeatherPanel's
      equivalent affordance (its edit toggle) is an icon-only
      square chip. Added the edit icon here too so the two
      "unlock to edit" affordances in the same right column look
      like the same control.

   4) DEAD LINK PROPS — matchEditorHref / auctionAdminHref were
      accepted but never rendered, so the "Match Editor" /
      "Auctions" mentions in the empty-roster note were inert
      plain text instead of the theme-orange links the copy
      implies. Now rendered as real links when provided.

   5) SCROLLBAR CONSISTENCY (this pass) — the left roster rail on
      the admin page (`app/(protected)/overlay/[auctionId]/admin/
      page.tsx`) hides its scrollbar via
      `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`
      alongside `overflow-y-auto`, so it scrolls but never shows a
      track/thumb. This panel's two scrollable containers — the
      outer wrapper when expanded (`isExpanded` → `lg:overflow-y-
      auto`) and the inner drawer-content scroller — previously had
      plain `overflow-y-auto` with no scrollbar suppression, so they
      showed the browser's default scrollbar while the sibling rail
      didn't. Both now carry the same suppression classes so every
      scrollable region in the shell reads as one consistent,
      scrollbar-less system.

   6) MOBILE PASS (this update) —
      a) This panel's outer wrapper now carries `p-4` on mobile
         (`lg:p-0` on desktop), since on mobile it sits directly in
         its own tab body with no surrounding chrome supplying
         inset, whereas on desktop the surrounding column/grid
         already provides spacing.
      b) The Setup drawer no longer collapses on mobile — it has
         its own dedicated tab there, so there's nothing to reveal
         by closing it. Desktop keeps the collapse/expand behavior
         (DrawerSection gained a `mobileAlwaysOpen` flag; the
         Collapse chip is now desktop-only via `hidden lg:inline-
         flex`).
      c) Added an optional `mobileWeatherSlot` prop so the parent
         page can pass the Weather panel in here. When provided, it
         renders inside this Setup drawer's content — visible only
         on mobile (`lg:hidden`) — so Weather lives in the Setup tab
         instead of a separate Overlay tab on small screens, while
         desktop is unaffected (parent should keep rendering
         WeatherPanel in its normal desktop spot and simply not pass
         this prop there, or gate it the same way).
   ───────────────────────────────────────────────────────────── */

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";

// Shared class fragment: scroll works, scrollbar never renders
// (Firefox via scrollbar-width, WebKit via the pseudo-element).
// Keep this in sync with the left roster rail in the admin page.
const HIDE_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// ════════════════════════════════════════════════════════════════
// Inlined UI primitives (formerly "../ui")
// ════════════════════════════════════════════════════════════════

function Icon({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

function Dot({ color, pulse, title }: { color: "orange" | "amber" | string; pulse?: boolean; title?: string }) {
  const bg = color === "orange" ? "#c9971f" : color === "amber" ? "#f59e0b" : color;
  return (
    <span
      title={title}
      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ background: bg, boxShadow: `0 0 6px ${bg}` }}
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] mb-1.5 text-on-surface-variant">
      {children}
    </span>
  );
}

function Eyebrow({ children, color, className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`font-mono-geist text-[9px] font-bold uppercase tracking-[0.2em] ${className ?? ""}`}
      style={{ color: color ?? "rgba(255,255,255,0.4)" }}
    >
      {children}
    </span>
  );
}

const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant transition-colors focus:border-white/25";

function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  maxLength,
  span,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  maxLength?: number;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} ${mono ? "font-mono-geist tabular-nums" : ""}`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  span,
  wrapperClassName,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  span?: 1 | 2;
  wrapperClassName?: string;
}) {
  return (
    <div className={[span === 2 ? "col-span-2" : "", wrapperClassName ?? ""].filter(Boolean).join(" ")}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
        {children}
      </select>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg cursor-pointer border border-white/10 bg-transparent p-0.5"
          style={{ width: 34, height: 34 }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} flex-1 min-w-0 text-xs font-mono-geist`}
        />
      </div>
    </div>
  );
}

// Bordered chip — the app-wide baseline for every clickable control
// (TogglePill / MomentButton in the page shell use the same shape:
// border + subtle background + mono uppercase label). `tone` picks
// the accent color for text/border/background instead of always
// defaulting to the neutral on-surface-variant treatment, so actions
// like "Reload" (orange) and "Clear" (red) read at a glance without
// falling back to unstyled text links.
function SmallButton({
  children,
  onClick,
  icon,
  tone = "neutral",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: string;
  tone?: "neutral" | "orange" | "danger";
  disabled?: boolean;
}) {
  const toneStyles: Record<string, { color: string; border: string; bg: string }> = {
    neutral: { color: "rgba(255,255,255,0.65)", border: "rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.02)" },
    orange: { color: "#e8c468", border: "rgba(201,151,31,0.4)", bg: "rgba(201,151,31,0.1)" },
    danger: { color: "#f87171", border: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.08)" },
  };
  const t = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ color: t.color, borderColor: t.border, background: t.bg }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] transition-all border flex-shrink-0 ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:brightness-125 active:scale-95"
      }`}
    >
      {icon && <Icon name={icon} style={{ fontSize: 12 }} />}
      {children}
    </button>
  );
}

// Matches the exact recipe used by every other gold CTA in the app
// ("Push Weather" in WeatherPanel, "Push Live State" in
// ScoringSection): py-2, text-[10px], tracking-[0.14em].
function PrimaryButton({
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth,
        ...(disabled ? {} : { background: GOLD_GRADIENT, color: "#1a1304" }),
      }}
      className={`py-2 px-6 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95 ${
        disabled ? "bg-white/5 text-on-surface-variant cursor-not-allowed" : ""
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({
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
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#f87171",
    orange: "#c9971f",
  };
  const c = toneColor[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono-geist text-[9px] font-bold uppercase tracking-[0.16em] px-3 py-1.5 rounded-full border"
      style={{ color: c, background: `${c}1a`, borderColor: `${c}40` }}
    >
      {pulse && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />}
      {label}
    </span>
  );
}

// Collapsible glass panel — tight padding/gap since this always renders
// inside a narrow rail, not a full-width form. `headerExtra` carries an
// explicit Collapse button from the parent whenever the drawer is open.
//
// `mobileAlwaysOpen` — when true, the section's content always renders
// visible on mobile (regardless of `open`/`onOpenChange`), and the
// chevron toggle affordance is hidden on mobile too, since there is
// nothing to collapse there. Desktop behavior is unchanged either way.
function DrawerSection({
  step,
  title,
  description,
  done,
  dirty,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  headerExtra,
  mobileAlwaysOpen = false,
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
  mobileAlwaysOpen?: boolean;
  children: React.ReactNode;
}) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Content visibility: mobile ignores `open` entirely when
  // `mobileAlwaysOpen` is set (always mounted + visible); desktop
  // (`lg:`) always respects `open`. Kept as static class strings so
  // Tailwind's compiler can see them.
  const contentVisibilityClass = mobileAlwaysOpen
    ? open
      ? "flex lg:flex"
      : "flex lg:hidden"
    : open
    ? "flex"
    : "hidden";

  const showBottomBorderMobile = mobileAlwaysOpen ? true : open;

  return (
    <div className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-3 px-4 sm:px-0 py-3.5 text-left border-b ${
          showBottomBorderMobile ? "border-white/10" : "border-transparent"
        } ${open ? "lg:border-white/10" : "lg:border-transparent"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {step && (
            <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-md flex-shrink-0 text-theme-orange bg-theme-orange/10 border border-theme-orange/20">
              {step}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-archivo text-sm font-bold italic uppercase text-on-surface">{title}</h3>
            {description && (
              <p className="truncate font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.08em] mt-0.5">{description}</p>
            )}
          </div>
          {done && <Dot color="orange" title="Pushed" />}
          {dirty && <Dot color="amber" pulse title="Unpushed changes" />}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {headerExtra}
          {/* Nothing to toggle on mobile when mobileAlwaysOpen — hide the
              chevron there so it doesn't read as a dead affordance. */}
          <Icon
            name="chevron_right"
            className={`text-on-surface-variant transition-transform duration-200 ${mobileAlwaysOpen ? "hidden lg:inline-flex" : ""}`}
            style={{ fontSize: 16, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>
      <div className={`flex-col p-4 gap-4 ${contentVisibilityClass}`}>{children}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Roster source
// ════════════════════════════════════════════════════════════════

interface RosterRow {
  id: string;
  name: string;
  image_url: string | null;
  role: string | null;
  team_id: string | null;
}

type RosterState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; byTeamId: Map<string, RosterRow[]> };

// Guards against undefined / null / the literal string "null" — any of
// these reaching supabase.eq("auction_id", ...) blows up with
// `invalid input syntax for type uuid` since PostgREST sends it as text.
function isValidAuctionId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id !== "null" && id !== "undefined";
}

function useAuctionRoster(auctionId: string | null | undefined): RosterState {
  const [state, setState] = useState<RosterState>({ status: "loading" });

  useEffect(() => {
    if (!isValidAuctionId(auctionId)) {
      setState({ status: "empty" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    supabase
      .from("players")
      .select("id,name,img,role,sold_to_team_id,status")
      .eq("auction_id", auctionId)
      .eq("status", "sold")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          // eslint-disable-next-line no-console
          console.error("[useAuctionRoster] players query failed:", JSON.stringify(error, null, 2));
          setState({ status: "error" });
          return;
        }
        if (data.length === 0) {
          setState({ status: "empty" });
          return;
        }
        const byTeamId = new Map<string, RosterRow[]>();
        for (const row of data as any[]) {
          const key = row.sold_to_team_id ?? "unassigned";
          if (!byTeamId.has(key)) byTeamId.set(key, []);
          byTeamId.get(key)!.push({
            id: row.id,
            name: row.name ?? "Unnamed",
            image_url: row.img || null,
            role: row.role,
            team_id: row.sold_to_team_id,
          });
        }
        setState({ status: "ready", byTeamId });
      });

    return () => {
      cancelled = true;
    };
  }, [auctionId]);

  return state;
}

// ════════════════════════════════════════════════════════════════
// Teams source
// ════════════════════════════════════════════════════════════════

interface DbTeamRow {
  id: string;
  code: string;
  name: string;
  color: string;
  logo: string | null;
  tier: string;
  owner: string;
  remaining_purse: number | null;
}

type TeamsDbState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; teams: DbTeamRow[] };

function useAuctionTeams(auctionId: string | null | undefined): TeamsDbState {
  const [state, setState] = useState<TeamsDbState>({ status: "loading" });

  useEffect(() => {
    if (!isValidAuctionId(auctionId)) {
      setState({ status: "empty" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    supabase
      .from("teams")
      .select("id,code,name,color,logo,tier,owner,remaining_purse")
      .eq("auction_id", auctionId)
      .order("code")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          // eslint-disable-next-line no-console
          console.error("[useAuctionTeams] teams query failed:", JSON.stringify(error, null, 2));
          setState({ status: "error" });
          return;
        }
        if (data.length === 0) {
          setState({ status: "empty" });
          return;
        }
        setState({ status: "ready", teams: data as DbTeamRow[] });
      });

    return () => {
      cancelled = true;
    };
  }, [auctionId]);

  return state;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function rosterPlayersForTeamId(roster: RosterState, teamId: string): SquadPlayer[] {
  if (roster.status !== "ready") return [];
  const rows = roster.byTeamId.get(teamId) ?? [];
  return rows.map((r) => ({ id: r.id, name: r.name, imageUrl: r.image_url ?? undefined }));
}

// ── resolve a missing teamId from name/shortCode ────────────────
function resolveTeamId(team: TeamInfo, teamsState: TeamsDbState): string | undefined {
  if (team.teamId) return team.teamId;
  if (teamsState.status !== "ready") return undefined;
  if (!team.shortCode && !team.name) return undefined;

  const match = teamsState.teams.find(
    (t) => (team.shortCode && t.code === team.shortCode) || (team.name && t.name === team.name)
  );
  return match?.id;
}

function MutedNote({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: React.ReactNode }) {
  return (
    <p className="font-mono-geist text-[10px]" style={{ color: tone === "warning" ? "#f59e0b" : "rgba(255,255,255,0.4)" }}>
      {children}
    </p>
  );
}

// Theme-orange inline link — used for "Match Editor" / "Auctions" tab
// references so they're actually navigable instead of inert colored
// text, matching how every other cross-reference in this app is a
// real, styled affordance rather than decoration.
function InlineLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <span className="text-theme-orange">{children}</span>;
  return (
    <a href={href} className="text-theme-orange underline decoration-theme-orange/30 underline-offset-2 hover:decoration-theme-orange">
      {children}
    </a>
  );
}

// ════════════════════════════════════════════════════════════════
// Team roster picker
// ════════════════════════════════════════════════════════════════

function TeamRosterPicker({
  team,
  onChange,
  roster,
  matchEditorHref,
  auctionAdminHref,
}: {
  team: TeamInfo;
  onChange: (patch: Partial<TeamInfo>) => void;
  roster: RosterState;
  matchEditorHref?: string;
  auctionAdminHref?: string;
}) {
  const selectedIds = useMemo(() => new Set((team.squadPlayers ?? []).map((p) => p.id)), [team.squadPlayers]);

  const teamRosterRows = useMemo(() => {
    if (roster.status !== "ready" || !team.teamId) return [];
    return roster.byTeamId.get(team.teamId) ?? [];
  }, [roster, team.teamId]);

  useEffect(() => {
    if (roster.status !== "ready" || !team.teamId) return;
    const rows = roster.byTeamId.get(team.teamId) ?? [];
    if (rows.length === 0) return;

    const current = team.squadPlayers ?? [];
    let changed = false;

    const reconciled = current.map((p) => {
      if (!p.id.startsWith("manual:")) return p;
      const match = rows.find((r) => r.name.trim().toLowerCase() === p.name.trim().toLowerCase());
      if (!match) return p;
      changed = true;
      return { id: match.id, name: match.name, imageUrl: match.image_url ?? undefined };
    });

    if (!changed) return;

    const seen = new Set<string>();
    const deduped = reconciled.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    onChange({ squadPlayers: deduped, squad: deduped.map((p) => p.name) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.status, team.teamId]);

  const manualPlayers = (team.squadPlayers ?? []).filter((p) => p.id.startsWith("manual:"));

  function reloadFromBoundTeam() {
    if (!team.teamId) return;
    const players = rosterPlayersForTeamId(roster, team.teamId);
    if (!players.length) return;
    onChange({ squadPlayers: players, squad: players.map((p) => p.name) });
  }

  function togglePlayer(player: SquadPlayer) {
    const current = team.squadPlayers ?? [];
    const isIn = current.some((p) => p.id === player.id);
    const next = isIn ? current.filter((p) => p.id !== player.id) : [...current, player];
    onChange({ squadPlayers: next, squad: next.map((p) => p.name) });
  }

  function removeManual(id: string) {
    const next = (team.squadPlayers ?? []).filter((p) => p.id !== id);
    onChange({ squadPlayers: next, squad: next.map((p) => p.name) });
  }

  function clearSquad() {
    onChange({ squadPlayers: [], squad: [] });
  }

  const hasAnyChips = teamRosterRows.length > 0 || manualPlayers.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <FieldLabel>Squad ({selectedIds.size})</FieldLabel>
        <div className="flex items-center gap-2">
          {team.teamId && roster.status === "ready" && (
            <SmallButton icon="refresh" tone="orange" onClick={reloadFromBoundTeam}>
              Reload
            </SmallButton>
          )}
          {selectedIds.size > 0 && (
            <SmallButton icon="close" tone="danger" onClick={clearSquad}>
              Clear
            </SmallButton>
          )}
        </div>
      </div>

      {roster.status === "loading" && <MutedNote>Loading roster…</MutedNote>}
      {roster.status === "error" && <MutedNote tone="warning">Couldn&apos;t reach the roster table — try again shortly.</MutedNote>}
      {roster.status === "ready" && !team.teamId && <MutedNote>Select a team above to load its roster.</MutedNote>}
      {roster.status === "ready" && team.teamId && teamRosterRows.length === 0 && manualPlayers.length === 0 && (
        <MutedNote>
          No sold players found for this team yet — add players from the <InlineLink href={matchEditorHref}>Match Editor</InlineLink> or the{" "}
          <InlineLink href={auctionAdminHref}>Auctions</InlineLink> tab.
        </MutedNote>
      )}

      {hasAnyChips && (
        <div className="flex flex-wrap gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10">
          {teamRosterRows.map((r) => {
            const checked = selectedIds.has(r.id);
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => togglePlayer({ id: r.id, name: r.name, imageUrl: r.image_url ?? undefined })}
                title={checked ? "Remove from today's squad" : "Add to today's squad"}
                className="relative flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-full border cursor-pointer transition-colors"
                style={{
                  background: checked ? "rgba(201,151,31,0.14)" : "rgba(255,255,255,0.03)",
                  borderColor: checked ? "rgba(201,151,31,0.55)" : "rgba(255,255,255,0.08)",
                }}
              >
                {checked && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center leading-none"
                    style={{ background: "#c9971f", color: "#1a1304" }}
                  >
                    ✓
                  </span>
                )}
                <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/[0.03]">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-mono-geist text-[9px] font-bold text-on-surface-variant">{initials(r.name) || "?"}</span>
                  )}
                </span>
                <span
                  className="font-archivo text-[11px] font-bold whitespace-nowrap"
                  style={{ color: checked ? "#e8c468" : "#e5e7eb" }}
                >
                  {r.name}
                </span>
              </button>
            );
          })}

          {manualPlayers.map((p) => (
            <div
              key={p.id}
              className="relative flex items-center gap-1.5 pl-1.5 pr-6 py-1.5 rounded-full border"
              style={{ background: "rgba(201,151,31,0.14)", borderColor: "rgba(201,151,31,0.55)" }}
            >
              <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center bg-white/[0.03]">
                <span className="font-mono-geist text-[9px] font-bold text-on-surface-variant">{initials(p.name) || "?"}</span>
              </span>
              <span className="font-archivo text-[11px] font-bold whitespace-nowrap" style={{ color: "#e8c468" }}>
                {p.name}
              </span>
              <button
                type="button"
                onClick={() => removeManual(p.id)}
                title="Remove from today's squad"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-none bg-red-500 text-white text-[11px] leading-none flex items-center justify-center cursor-pointer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Locked summary strip — replaces the full form once pushed
// ════════════════════════════════════════════════════════════════

function LockedSummaryBar({ matchSetup, onEdit }: { matchSetup: MatchSetup; onEdit: () => void }) {
  const tossLine =
    matchSetup.tossWinner && matchSetup.tossDecision
      ? `${matchSetup.tossWinner === "A" ? matchSetup.teamA.shortCode || "Team A" : matchSetup.teamB.shortCode || "Team B"} won the toss, elected to ${
          matchSetup.tossDecision === "bat" ? "bat" : "bowl"
        }`
      : null;

  return (
    <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
        <StatusPill label="Match Setup · Locked" tone="orange" />
        <span className="font-archivo text-[12px] font-bold truncate text-on-surface">
          {matchSetup.teamA.shortCode || matchSetup.teamA.name || "Team A"} vs {matchSetup.teamB.shortCode || matchSetup.teamB.name || "Team B"}
        </span>
        {matchSetup.venue && (
          <span className="font-mono-geist text-[10px] text-on-surface-variant truncate hidden lg:inline">· {matchSetup.venue}</span>
        )}
        {matchSetup.kickoffTime && (
          <span className="font-mono-geist text-[10px] text-on-surface-variant truncate hidden xl:inline">· {matchSetup.kickoffTime}</span>
        )}
        {tossLine && <span className="font-mono-geist text-[10px] text-on-surface-variant truncate hidden xl:inline">· {tossLine}</span>}
      </div>
      {/* Icon-labelled chip, matching WeatherPanel's edit-toggle affordance
          (h-7 w-7 square icon button) rather than a bare text link. */}
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit match setup"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] border border-white/10 bg-white/[0.02] text-on-surface-variant transition-all hover:brightness-125 hover:bg-white/5 active:scale-95 shrink-0"
      >
        <Icon name="edit" style={{ fontSize: 13 }} />
        Edit
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Quick-reference block for the locked state
// ════════════════════════════════════════════════════════════════

function LockedDetails({ matchSetup }: { matchSetup: MatchSetup }) {
  const tossLine =
    matchSetup.tossWinner && matchSetup.tossDecision
      ? `${matchSetup.tossWinner === "A" ? matchSetup.teamA.shortCode || "Team A" : matchSetup.teamB.shortCode || "Team B"} elected to ${
          matchSetup.tossDecision === "bat" ? "bat" : "bowl"
        }`
      : "—";

  const rows = [
    { label: "Venue", value: matchSetup.venue || "—" },
    { label: "Format", value: matchSetup.format || "—" },
    { label: "Kickoff", value: matchSetup.kickoffTime || "—" },
    { label: "Toss", value: tossLine },
  ];

  return (
    <div className="flex-1 min-h-0 mt-3 flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.label} className="glass-panel rounded-lg px-3 py-2">
          <p className="font-mono-geist text-[8.5px] font-bold uppercase tracking-[0.14em] mb-0.5 text-on-surface-variant">{row.label}</p>
          <p className="font-archivo text-sm font-bold truncate text-on-surface">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Main panel
// ════════════════════════════════════════════════════════════════

export interface MatchSetupPanelProps {
  auctionId: string | null | undefined;
  matchSetup: MatchSetup;
  setMatchSetup: React.Dispatch<React.SetStateAction<MatchSetup>>;
  onPush: () => void;
  pushLabel: string;
  completed: boolean;
  onVenueSelect?: (match: GeocodeMatch, displayName?: string) => void;
  /** Used to build the "Match Editor" link inside the roster panel — e.g. `/match/[matchId]/edit`. */
  matchId?: string | null;
  /** Full URL/path to the Auctions admin tab. Optional — falls back to plain text if not passed. */
  auctionAdminHref?: string;
  /** Fires whenever this panel flips between the locked summary bar and
      the full editable form, so the page can hide live scoring / other
      right-column panels (weather, moments, overlay toggles) while the
      operator is mid-edit on setup. */
  onEditingChange?: (editing: boolean) => void;
  /** Current mobile bottom-nav tab, e.g. 'scoring' | 'overlay' | 'setup'.
      When provided, this panel is only shown on mobile while
      `mobileTab === "setup"`, and — while editing — fills that tab's
      viewport instead of floating as a small card. Omit this prop to
      keep the panel always visible (e.g. when used on a full-width,
      non-tabbed page). */
  mobileTab?: string;
  /** Optional Weather panel (e.g. `<WeatherPanel ... />`) rendered by
      the parent. When provided, it's shown inside this Setup drawer —
      visible on mobile only (`lg:hidden`) — so Weather lives in the
      Setup tab instead of a separate Overlay tab on small screens.
      Desktop layout is untouched: don't pass this prop (or render
      WeatherPanel separately) for the desktop column. */
  mobileWeatherSlot?: React.ReactNode;
  tournamentLogoUrl?: string;
}

export default function MatchSetupPanel({
  auctionId,
  matchSetup,
  setMatchSetup,
  onPush,
  pushLabel,
  completed,
  onVenueSelect,
  matchId,
  auctionAdminHref,
  onEditingChange,
  mobileTab,
  mobileWeatherSlot,
}: MatchSetupPanelProps) {
  const roster = useAuctionRoster(auctionId);
  const teamsState = useAuctionTeams(auctionId);

  const matchEditorHref = matchId ? `/match/${matchId}/edit` : undefined;

  const [locked, setLocked] = useState(completed);
  useEffect(() => {
    if (completed) setLocked(true);
  }, [completed]);

  // Starts CLOSED: before the operator explicitly opens it to edit,
  // this panel should sit at its normal compact size and leave room
  // for Weather/Moments — not claim the whole column by default.
  // (Desktop-only concern now — on mobile the drawer content always
  // renders open via `mobileAlwaysOpen` on DrawerSection below, since
  // this panel already has its own dedicated tab there.)
  const [drawerOpen, setDrawerOpen] = useState(false);

  // "Expanded" = unlocked AND the drawer is actually open. This is the
  // only state that should take over the full column height and hide
  // siblings — being unlocked-but-collapsed (drawer closed, not yet
  // pushed) is still a normal-size state. This still only matters for
  // desktop (`lg:` classes below) since mobile has its own tab.
  const isExpanded = !locked && drawerOpen;

  // Tell the parent every time expansion flips, so it can hide
  // LiveStatePanel / Weather / Moments only while genuinely expanded.
  useEffect(() => {
    onEditingChange?.(isExpanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  function handlePush() {
    onPush();
    setLocked(true);
    // Reset the drawer's internal open state too, so it doesn't linger
    // "open" underneath the locked view and reappear stale on next edit.
    setDrawerOpen(false);
  }

  function handleEdit() {
    setLocked(false);
    setDrawerOpen(true);
  }

  function updateTeam(team: "teamA" | "teamB", patch: Partial<TeamInfo>) {
    setMatchSetup((prev) => ({ ...prev, [team]: { ...prev[team], ...patch } }));
  }

  useEffect(() => {
    if (teamsState.status !== "ready") return;

    (["teamA", "teamB"] as const).forEach((teamKey) => {
      const team = matchSetup[teamKey];
      if (team.teamId) return;

      const resolved = resolveTeamId(team, teamsState);
      if (!resolved) return;

      setMatchSetup((prev) => ({
        ...prev,
        [teamKey]: { ...prev[teamKey], teamId: resolved },
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsState.status, matchSetup.teamA.name, matchSetup.teamA.shortCode, matchSetup.teamB.name, matchSetup.teamB.shortCode]);

  useEffect(() => {
    if (roster.status !== "ready") return;
    if (locked) return;

    (["teamA", "teamB"] as const).forEach((teamKey) => {
      const team = matchSetup[teamKey];
      if (!team.teamId) return;
      if ((team.squadPlayers ?? []).length > 0) return;

      const players = rosterPlayersForTeamId(roster, team.teamId);
      if (players.length === 0) return;

      setMatchSetup((prev) => ({
        ...prev,
        [teamKey]: {
          ...prev[teamKey],
          squadPlayers: players,
          squad: players.map((p) => p.name),
        },
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.status, locked, matchSetup.teamA.teamId, matchSetup.teamB.teamId]);

  // ── Layout wrapper ────────────────────────────────────────────────
  // Mobile and desktop are DIFFERENT here on purpose:
  //
  // - Mobile: this panel lives in its own dedicated "Setup" tab, so
  //   there's nothing else sharing the screen with it and nothing to
  //   hide/reveal. It just renders at its natural height (locked
  //   summary + details, or the full form) and the tab area scrolls
  //   normally — no forced min-height, whether locked or editing. It
  //   also carries its own `p-4` inset on mobile (`lg:p-0` on desktop),
  //   since the tab body has no other chrome supplying spacing, unlike
  //   the desktop column.
  // - Desktop: the right column is shared with Weather/Moments below
  //   it. The panel starts (and stays) at its normal compact size —
  //   even while unlocked — until the drawer is actually opened. Only
  //   once truly EXPANDED (`isExpanded = !locked && drawerOpen`) does
  //   the wrapper grow to fill the entire available column height
  //   (`lg:flex-1 lg:h-full`) so — combined with the parent hiding
  //   siblings via `onEditingChange` — it visually takes over the whole
  //   right column. Collapsing the drawer again (without pushing, via
  //   the explicit Collapse button in the header) — or locking it via
  //   push — both revert it to natural height so Weather / Moments get
  //   their space back.
  //
  // `mobileTab`, when passed, still controls plain visibility on
  // mobile: hidden unless the "setup" tab is active. When omitted,
  // the panel is always visible (unchanged behavior for non-tabbed
  // pages).
  //
  // Scrollbar: when this wrapper grows to `lg:h-full` and scrolls
  // (`lg:overflow-y-auto`), it should scroll the same way the left
  // roster rail does — visible/scrollable, but with no rendered
  // scrollbar track/thumb (`HIDE_SCROLLBAR`).
  const outerClassName = mobileTab
    ? [
        "flex flex-col",
        "p-0 lg:p-0",
        mobileTab === "setup" ? "flex" : "hidden",
        "lg:flex lg:flex-col lg:min-h-0",
        isExpanded ? `lg:flex-1 lg:h-full lg:overflow-y-auto ${HIDE_SCROLLBAR}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : ["flex flex-col", "p-0 lg:p-0", isExpanded ? `lg:flex-1 lg:h-full lg:overflow-y-auto ${HIDE_SCROLLBAR}` : ""]
        .filter(Boolean)
        .join(" ");

  if (locked) {
    return (
      <div className={outerClassName}>
        <LockedSummaryBar matchSetup={matchSetup} onEdit={handleEdit} />
        <LockedDetails matchSetup={matchSetup} />
      </div>
    );
  }

  return (
    <div className={outerClassName}>
      {/* Same hidden-scrollbar treatment as the outer wrapper above —
          this is the actual inner scroller once the drawer content
          overflows the available height. */}
      <div className={`flex-1 px-0 sm:px-4 min-h-0 overflow-y-auto ${HIDE_SCROLLBAR}`}>
        <DrawerSection
          step="1"
          title="Match Setup"
          description="Teams & session — set once, then push"
          done={completed}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          // Mobile has its own dedicated tab for this panel, so there's
          // nothing gained by letting the operator collapse it there —
          // it always renders open on mobile. Desktop keeps the normal
          // collapse/expand behavior since it shares the column with
          // Weather/Moments.
          mobileAlwaysOpen
          // FIX: explicit, obvious way to close the drawer without
          // pushing, so Weather/Moments can reappear in the right
          // column any time — not just after a push. Previously the
          // only way to collapse was the small header chevron, which
          // people were missing entirely.
          // Desktop-only now — see `mobileAlwaysOpen` above.
        >
          {!isValidAuctionId(auctionId) && (
            <p className="font-mono-geist text-[10px] uppercase tracking-[0.1em]" style={{ color: "#fbbf24" }}>
              No auction linked yet — team/roster lookups are disabled until this match has a valid auction_id.
            </p>
          )}

          {/* FIX: fixed 2-col grid instead of `md:grid-cols-4` — this
              panel always renders in a narrow rail regardless of window
              width, so viewport breakpoints were cramming 4 fields into
              ~400px of real space. */}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Tournament"
              value={matchSetup.tournamentName}
              onChange={(v) => setMatchSetup((p) => ({ ...p, tournamentName: v }))}
              placeholder="e.g. Provincial T20 Cup"
            />
            <TextField
              label="Season"
              value={matchSetup.season}
              onChange={(v) => setMatchSetup((p) => ({ ...p, season: v }))}
              placeholder="e.g. 2026"
            />
            <div className="col-span-2">
              <ImageUploader
                auctionId={auctionId ?? ""}
                kind="tournament"
                value={matchSetup.tournamentLogoUrl}
                onChange={(url) => setMatchSetup((p) => ({ ...p, tournamentLogoUrl: url }))}
                label="Tournament Logo"
              />
            </div>

            <div className="col-span-2">
              <div className="mb-1.5 font-mono-geist text-[10px] uppercase tracking-[0.1em]" style={{ color: "#9ca3af" }}>
                Venue
              </div>
              <LocationAutocompleteInput
                value={matchSetup.venue}
                onChange={(v) => setMatchSetup((p) => ({ ...p, venue: v }))}
                onSelect={onVenueSelect}
                placeholder="Ground name"
              />
            </div>

            <SelectField label="Format" value={matchSetup.format} onChange={(v) => setMatchSetup((p) => ({ ...p, format: v as MatchSetup["format"] }))}>
              <option value="T20">T20</option>
              <option value="ODI">ODI</option>
              <option value="Test">Test</option>
            </SelectField>
            <TextField
              label="Match Number"
              value={matchSetup.matchNumber}
              onChange={(v) => setMatchSetup((p) => ({ ...p, matchNumber: v }))}
              placeholder="e.g. Match 14"
            />
            <TextField
              label="Kickoff Time"
              value={matchSetup.kickoffTime}
              onChange={(v) => setMatchSetup((p) => ({ ...p, kickoffTime: v }))}
              placeholder="e.g. 19:30 LOCAL"
            />
            <TextField
              label="Match Title"
              value={matchSetup.matchTitle}
              onChange={(v) => setMatchSetup((p) => ({ ...p, matchTitle: v }))}
              placeholder="e.g. Semi-Final"
            />
          </div>

          <div className="flex flex-col gap-4">
            {(["teamA", "teamB"] as const).map((teamKey) => {
              const team = matchSetup[teamKey];
              return (
                <div
                  key={teamKey}
                  className="relative isolate"
                  style={{ ["--team-color" as string]: team.color }}
                >
                  {team.logoUrl && (
                    <div
                      className="absolute inset-0 z-0 pointer-events-none"
                      style={{
                        backgroundImage: `url(${team.logoUrl})`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right center",
                        opacity: 0.1,
                      }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative z-10 rounded-xl p-3.5 bg-white/[0.02] border border-white/10 flex flex-col gap-3">
                    <Eyebrow color="#c9971f">{teamKey === "teamA" ? "Team A" : "Team B"}</Eyebrow>

                    {/* FIX: fixed 2-col grid, tighter gap — was
                        cramming Name/ShortCode/Color/Logo inside a
                        rail-width team card. */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <TextField label="Name" value={team.name} onChange={(v) => updateTeam(teamKey, { name: v })} placeholder="Team name" />
                      <TextField
                        label="Short Code"
                        mono
                        maxLength={4}
                        value={team.shortCode}
                        onChange={(v) => updateTeam(teamKey, { shortCode: v.toUpperCase() })}
                        placeholder="e.g. CSK"
                      />
                      <ColorField label="Color" value={team.color} onChange={(v) => updateTeam(teamKey, { color: v })} />
                      <div className="min-w-0">
                        <ImageUploader
                          auctionId={auctionId ?? ""}
                          kind="team"
                          value={team.logoUrl}
                          onChange={(url) => updateTeam(teamKey, { logoUrl: url })}
                          label="Logo"
                        />
                      </div>
                    </div>

                    <TeamRosterPicker
                      team={team}
                      roster={roster}
                      onChange={(patch) => updateTeam(teamKey, patch)}
                      matchEditorHref={matchEditorHref}
                      auctionAdminHref={auctionAdminHref}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <SelectField
              label="Toss Winner"
              value={matchSetup.tossWinner}
              onChange={(v) => setMatchSetup((p) => ({ ...p, tossWinner: v as MatchSetup["tossWinner"] }))}
            >
              <option value="">—</option>
              <option value="A">{matchSetup.teamA.shortCode || "Team A"}</option>
              <option value="B">{matchSetup.teamB.shortCode || "Team B"}</option>
            </SelectField>
            <SelectField
              label="Toss Decision"
              value={matchSetup.tossDecision}
              onChange={(v) => setMatchSetup((p) => ({ ...p, tossDecision: v as MatchSetup["tossDecision"] }))}
            >
              <option value="">—</option>
              <option value="bat">Elected to bat</option>
              <option value="bowl">Elected to bowl</option>
            </SelectField>
            <div className="flex-1" />
            <PrimaryButton onClick={handlePush} minWidth={180}>
              {pushLabel}
            </PrimaryButton>
          </div>

          {!completed && (
            <p className="font-mono-geist text-[9px] uppercase tracking-[0.12em] text-on-surface-variant">
              Push once to unlock the preview link and live scoring below.
            </p>
          )}

          {/* Weather, mobile-only: on small screens this Setup tab is
              where Weather now lives (instead of a separate Overlay
              tab). Desktop is untouched — the parent should keep
              rendering WeatherPanel in its normal desktop spot and only
              pass `mobileWeatherSlot` here for the mobile case. */}
          {mobileWeatherSlot && <div className="lg:hidden">{mobileWeatherSlot}</div>}
        </DrawerSection>
      </div>
    </div>
  );
}