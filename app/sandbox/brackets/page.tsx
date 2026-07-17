// File: app/sandbox/brackets/page.tsx
"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Shuffle,
  Sparkles,
  RotateCcw,
  Trophy,
  X,
  PartyPopper,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Pause,
  Play,
  MousePointerClick,
} from "lucide-react";

import TournamentBracket from "@/components/demo/TournamentBracketEditable";
import DoubleElimBoard from "@/components/demo/DoubleElimBoard";

import {
  bracketDemoModel,
  getBracketSnapshot,
  countProgress,
  type FormatType,
} from "@/lib/demo/tournament/bracketDemoModel";
import { bracketOrchestrator } from "@/lib/demo/tournament/bracketOrchestrator";
import { bracketInteractiveController } from "@/lib/demo/tournament/bracketInteractiveController";

const FORMAT_LABELS: Record<FormatType, string> = {
  single_elimination: "Single Elim",
  double_elimination: "Double Elim",
};

const FONT_BODY = "var(--font-body, 'Inter', ui-sans-serif, system-ui, sans-serif)";
const DEFAULT_LOGO_SRC = "/valiant-league-logo.png";

const TEAM_COUNT_PRESETS = [4, 8, 16, 32] as const;
const MIN_TEAMS = 2;
const MAX_TEAMS = 64;

function clampTeamCount(n: number): number {
  if (Number.isNaN(n)) return MIN_TEAMS;
  return Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.round(n)));
}

/* ------------------------------------------------------------------ */
/*  Shared control-cluster atoms                                       */
/* ------------------------------------------------------------------ */

function ControlCluster({
  label,
  children,
  dimmed,
}: {
  label: string;
  children: React.ReactNode;
  /** When true, cluster is faded + inert (used while auto-pilot is driving). */
  dimmed?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 transition-opacity"
      style={{ opacity: dimmed ? 0.4 : 1, pointerEvents: dimmed ? "none" : "auto" }}
    >
      <span
        className="text-[9px] font-semibold uppercase"
        style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.13em", color: "var(--color-outline)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase whitespace-nowrap transition-colors"
      style={{
        fontFamily: "var(--font-label-mono)",
        letterSpacing: "0.09em",
        background: active ? "color-mix(in srgb, var(--color-theme-orange) 16%, transparent)" : "rgba(255,255,255,0.03)",
        boxShadow: active
          ? "inset 0 0 0 1px color-mix(in srgb, var(--color-theme-orange) 50%, transparent)"
          : "inset 0 0 0 1px var(--color-border-overlay)",
        color: active ? "var(--color-theme-orange)" : "var(--color-outline)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  disabled,
  solid,
  icon,
  children,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  solid?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        fontFamily: "var(--font-label-mono)",
        letterSpacing: "0.08em",
        background: solid ? "linear-gradient(135deg,#A87815,#E8C468)" : "rgba(255,255,255,0.03)",
        boxShadow: solid ? "none" : "inset 0 0 0 1px var(--color-border-overlay)",
        color: solid ? "#1a1304" : "var(--color-on-surface)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Bot cursor — same visual job as the auction sandbox's simulated    */
/*  pointer: a colored dot + label bubble that glides to whatever the  */
/*  orchestrator is about to act on. Rendered inside the data-demo-    */
/*  panel wrapper, positioned via plain left/top so CSS can transition */
/*  between positions on every model update instead of teleporting.   */
/* ------------------------------------------------------------------ */

function BotCursor({
  cursor,
}: {
  cursor: { visible: boolean; x: number; y: number; label: string; color: string; clicking: boolean };
}) {
  if (!cursor.visible) return null;
  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: cursor.x,
        top: cursor.y,
        transform: "translate(-50%, -50%)",
        transition: "left 700ms cubic-bezier(0.22,1,0.36,1), top 700ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div
        className="rounded-full"
        style={{
          width: 16,
          height: 16,
          background: cursor.color,
          boxShadow: `0 0 14px 3px color-mix(in srgb, ${cursor.color} 60%, transparent)`,
          transform: cursor.clicking ? "scale(0.65)" : "scale(1)",
          transition: "transform 150ms ease",
        }}
      />
      <span
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] uppercase font-bold"
        style={{
          top: 20,
          fontFamily: "var(--font-label-mono)",
          letterSpacing: "0.08em",
          background: "rgba(0,0,0,0.85)",
          color: cursor.color,
        }}
      >
        {cursor.label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Narrator chyron — same visual family as the auction sandbox's      */
/*  CommentaryOverlay: pinned, centered, replays its entrance whenever */
/*  narratorText changes (keyed by the text itself).                  */
/* ------------------------------------------------------------------ */

function StatusChyron({ text }: { text: string }) {
  if (!text) return null;
  const isChampion = text.includes("🏆");
  const accent = isChampion ? "var(--color-theme-orange)" : "#8b8bf5";
  return (
    <div className="pointer-events-none fixed top-56 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center max-w-[560px] w-[92%]">
      <div
        key={text}
        className="chyron-in flex items-stretch overflow-hidden rounded-[3px]"
        style={{
          background: "rgba(8,8,8,0.88)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 12px 30px -10px rgba(0,0,0,0.6)",
        }}
      >
        <span className="shrink-0" style={{ width: 3, background: accent }} />
        <div className="flex items-center gap-3 pl-3.5 pr-4 py-2.5">
          {isChampion && <PartyPopper size={14} color={accent} />}
          <span
            className="text-[13px] leading-snug"
            style={{
              fontFamily: "var(--font-headline-lg)",
              fontStyle: "italic",
              fontWeight: 700,
              color: "var(--color-on-surface)",
            }}
          >
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Completion overlay — same job as the auction sandbox's: offers a   */
/*  hand-off to interactive mode (demo only) and a restart, without    */
/*  unmounting the finished bracket underneath.                       */
/* ------------------------------------------------------------------ */

function BracketCompletionOverlay({
  mode,
  championName,
  onTryItYourself,
  onRestart,
}: {
  mode: "demo" | "interactive";
  championName: string | null;
  onTryItYourself: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{ background: "rgba(6,6,8,0.72)", backdropFilter: "blur(6px)" }} />
      <div
        className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-8 flex flex-col gap-6"
        style={{
          background: "rgba(13,17,23,0.96)",
          border: "1px solid color-mix(in srgb, var(--color-theme-orange) 30%, transparent)",
          boxShadow:
            "0 0 80px color-mix(in srgb, var(--color-theme-orange) 12%, transparent), 0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-center justify-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "color-mix(in srgb, var(--color-theme-orange) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-theme-orange) 30%, transparent)",
            }}
          >
            <Trophy size={32} color="var(--color-theme-orange)" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2
            className="font-bold italic uppercase tracking-tight text-2xl"
            style={{ fontFamily: "var(--font-headline-lg)", color: "var(--color-on-surface)" }}
          >
            Tournament Complete
          </h2>
          <p
            className="text-[11px] uppercase tracking-[0.12em] leading-relaxed"
            style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}
          >
            {championName ? `${championName} takes the title.` : "Every match has been decided."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {mode === "demo" && (
            <button
              onClick={onTryItYourself}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95"
              style={{
                fontFamily: "var(--font-label-mono)",
                background: "linear-gradient(135deg,#A87815,#E8C468)",
                color: "#1a1304",
              }}
            >
              <MousePointerClick size={14} />
              Try It Yourself
            </button>
          )}
          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95"
            style={{
              fontFamily: "var(--font-label-mono)",
              background: mode === "demo" ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#A87815,#E8C468)",
              border: mode === "demo" ? "1px solid rgba(255,255,255,0.1)" : "none",
              color: mode === "demo" ? "var(--color-on-surface)" : "#1a1304",
            }}
          >
            <RotateCcw size={14} />
            {mode === "demo" ? "Restart Demo" : "Restart Tournament"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function BracketSandboxPage() {
  const snap = useSyncExternalStore(bracketDemoModel.subscribe, getBracketSnapshot, getBracketSnapshot);

  const [customCountInput, setCustomCountInput] = useState<string>("");
  const [showAdminOverlay, setShowAdminOverlay] = useState(false);
  const [rosterExpanded, setRosterExpanded] = useState(false);

  // Starts in demo (bot-driven) mode. Switching modes tears down whichever
  // driver was running so the two never fight over the shared model.
  useEffect(() => {
    bracketOrchestrator.start();
    return () => {
      bracketOrchestrator.stop();
      bracketInteractiveController.stop();
    };
  }, []);

  function applyCustomCount() {
    if (customCountInput.trim() === "") return;
    const parsed = clampTeamCount(Number(customCountInput));
    bracketDemoModel.setTeamCount(parsed);
    setCustomCountInput(parsed.toString());
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => bracketDemoModel.setLogoSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleToggleMode() {
    if (snap.mode === "demo") {
      bracketOrchestrator.stop();
      bracketInteractiveController.start();
    } else {
      bracketInteractiveController.stop();
      bracketOrchestrator.start();
    }
  }

  function handleTogglePause() {
    if (snap.status === "paused") bracketOrchestrator.resume();
    else bracketOrchestrator.pause();
  }

  function handleTryItYourself() {
    bracketOrchestrator.stop();
    bracketInteractiveController.start();
  }

  function handleRestart() {
    if (snap.mode === "demo") bracketOrchestrator.restartAfterCompletion();
    else bracketDemoModel.startNewCycle();
  }

  function handleSingleResult(matchId: string, winner: "A" | "B", a: number, b: number) {
    bracketDemoModel.recordResult(matchId, winner, a, b);
  }

  function handleDoubleResult(matchId: string, winner: "A" | "B", a: number, b: number) {
    bracketDemoModel.recordResult(matchId, winner, a, b);
  }

  const champion = bracketDemoModel.getChampionName();
  const { completed, total } = countProgress(snap.format, snap.singleRounds, snap.doubleData);
  const hasResults = completed > 0;
  const isDemo = snap.mode === "demo";

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col">
      <style jsx global>{`
        @keyframes bracketFeedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes chyronIn {
          0% { opacity: 0; transform: translateY(-16px) scale(0.97); }
          55% { opacity: 1; transform: translateY(2px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chyron-in {
          animation: chyronIn 380ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .bracket-scanlines {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.012) 0px,
            rgba(255, 255, 255, 0.012) 1px,
            transparent 1px,
            transparent 3px
          );
        }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 z-0 bracket-scanlines"
        style={{
          background:
            "radial-gradient(900px 380px at 50% 0%, color-mix(in srgb, var(--color-theme-orange) 7%, transparent), transparent 65%), " +
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "auto, 48px 48px, 48px 48px",
        }}
      />

      {/* ── Console header ─────────────────────────────────────────── */}
      <div
        className="shrink-0 h-11 flex items-center justify-between px-4 relative z-20"
        style={{
          background: "linear-gradient(180deg, var(--color-surface-container-low), var(--color-surface-dim))",
          borderBottom: "1px solid var(--color-border-overlay)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-[3px]"
            style={{
              background: "color-mix(in srgb, var(--color-theme-orange) 14%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-theme-orange) 45%, transparent)",
            }}
          >
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{
                background: "var(--color-theme-orange)",
                animation: "bracketFeedPulse 1.6s ease-in-out infinite",
                boxShadow: "0 0 6px 1px color-mix(in srgb, var(--color-theme-orange) 60%, transparent)",
              }}
            />
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.11em", color: "var(--color-theme-orange)" }}
            >
              Sandbox
            </span>
          </div>

          <span className="w-px h-5" style={{ background: "var(--color-border-overlay)" }} />

          <div className="flex items-center gap-2">
            <Trophy className="w-3 h-3" style={{ color: "var(--color-outline)" }} />
            <span
              className="text-[12px] px-1.5 py-0.5 rounded-[2px]"
              style={{
                fontFamily: "var(--font-headline-lg)",
                fontStyle: "italic",
                fontWeight: 700,
                color: "var(--color-theme-orange)",
                letterSpacing: "0.03em",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid var(--color-border-overlay)",
              }}
            >
              {FORMAT_LABELS[snap.format]}
            </span>
          </div>

          {total > 0 && (
            <div
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-[3px]"
              style={{
                background: "rgba(0,0,0,0.22)",
                border: `1px solid color-mix(in srgb, ${
                  completed === total ? "#3ddc84" : "var(--color-border-overlay)"
                } 45%, var(--color-border-overlay))`,
              }}
            >
              <span
                className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-[2px]"
                style={{
                  fontFamily: "var(--font-label-mono)",
                  letterSpacing: "0.06em",
                  color: completed === total ? "#08110c" : "var(--color-on-surface)",
                  background: completed === total ? "#3ddc84" : "transparent",
                }}
              >
                {completed === total ? "Decided" : "In Progress"}
              </span>
              <span className="text-[11px] tabular-nums" style={{ fontFamily: FONT_BODY, color: "var(--color-outline)" }}>
                {completed}/{total} matches
              </span>
            </div>
          )}
        </div>

        {/* ── Right: pause (autopilot only) + restart + mode toggle ── */}
        <div className="flex items-center gap-3">
          {isDemo && (
            <button
              onClick={handleTogglePause}
              disabled={snap.status === "completed"}
              className="flex items-center gap-1.5 px-2 py-1 rounded-[3px] transition-colors hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.08em",
                background:
                  snap.status === "paused"
                    ? "color-mix(in srgb, var(--color-theme-orange) 15%, transparent)"
                    : "rgba(255,255,255,0.03)",
                border: `1px solid ${
                  snap.status === "paused"
                    ? "color-mix(in srgb, var(--color-theme-orange) 45%, transparent)"
                    : "var(--color-border-overlay)"
                }`,
                color: snap.status === "paused" ? "var(--color-theme-orange)" : "var(--color-on-surface)",
                cursor: "pointer",
              }}
            >
              {snap.status === "paused" ? <Play size={11} /> : <Pause size={11} />}
              <span className="text-[8px] uppercase">{snap.status === "paused" ? "Resume" : "Pause"}</span>
            </button>
          )}

          <ActionButton onClick={handleRestart} icon={<RotateCcw className="w-2.5 h-2.5" />}>
            Restart
          </ActionButton>

          <span className="w-px h-5" style={{ background: "var(--color-border-overlay)" }} />

          <button
            onClick={handleToggleMode}
            className="group flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-colors"
            style={{
              background: isDemo ? "rgba(255,255,255,0.03)" : "color-mix(in srgb, var(--color-theme-orange) 14%, transparent)",
              border: `1px solid ${
                isDemo ? "var(--color-border-overlay)" : "color-mix(in srgb, var(--color-theme-orange) 45%, transparent)"
              }`,
              cursor: "pointer",
            }}
          >
            <span
              className="flex items-center justify-center rounded-full transition-transform"
              style={{ width: 16, height: 16, background: !isDemo ? "var(--color-theme-orange)" : "var(--color-outline)" }}
            >
              <span className="rounded-full bg-black/70" style={{ width: 6, height: 6 }} />
            </span>
            <span
              className="text-[8px] uppercase"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.1em",
                color: !isDemo ? "var(--color-theme-orange)" : "var(--color-on-surface)",
                fontWeight: 700,
              }}
            >
              {isDemo ? "Watching demo — Try it yourself" : "Playing — Watch demo"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Control deck — Bracket size / Format / Actions are dimmed + */}
      {/*    inert while auto-pilot is driving (each carries its own    */}
      {/*    `dimmed` flag now). Watermark stays interactive in either   */}
      {/*    mode and lives in the same row so it wraps naturally with  */}
      {/*    the rest instead of dropping to its own line.              */}
      <div
        className="shrink-0 relative z-10"
        style={{ background: "rgba(10,10,10,0.35)", borderBottom: "1px solid var(--color-border-overlay)" }}
      >
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-5 py-4">
          <ControlCluster label="Bracket size" dimmed={isDemo}>
            {TEAM_COUNT_PRESETS.map((count) => (
              <Pill
                key={count}
                active={snap.teamCount === count && customCountInput === ""}
                onClick={() => {
                  bracketDemoModel.setTeamCount(count);
                  setCustomCountInput("");
                }}
              >
                {count}
              </Pill>
            ))}
            <input
              type="number"
              min={MIN_TEAMS}
              max={MAX_TEAMS}
              placeholder="Custom"
              value={customCountInput}
              onChange={(e) => setCustomCountInput(e.target.value)}
              onBlur={applyCustomCount}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyCustomCount();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-16 px-2 py-1.5 rounded-full text-[10px] font-bold text-center focus:outline-none"
              style={{
                fontFamily: "var(--font-label-mono)",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            />
          </ControlCluster>

          <ControlCluster label="Format" dimmed={isDemo}>
            {(Object.keys(FORMAT_LABELS) as FormatType[]).map((f) => (
              <Pill key={f} active={snap.format === f} onClick={() => bracketDemoModel.setFormat(f)}>
                {FORMAT_LABELS[f]}
              </Pill>
            ))}
          </ControlCluster>

          <ControlCluster label="Actions" dimmed={isDemo}>
            <ActionButton
              onClick={() => bracketDemoModel.reshuffleSeeding()}
              title="Reshuffle seeding"
              icon={<Shuffle className="w-2.5 h-2.5" />}
            >
              Reshuffle
            </ActionButton>
            <ActionButton onClick={() => bracketDemoModel.simulateAll()} solid icon={<Sparkles className="w-2.5 h-2.5" />}>
              Simulate all
            </ActionButton>
            <ActionButton
              onClick={() => bracketDemoModel.resetResults()}
              disabled={!hasResults}
              icon={<RotateCcw className="w-2.5 h-2.5" />}
            >
              Reset
            </ActionButton>
          </ControlCluster>

          {/* Watermark stays editable in either mode — cosmetic, doesn't
              interfere with the bot's own actions. Not passed `dimmed`
              so it keeps full opacity + pointer events during demo mode. */}
          <ControlCluster label="Watermark">
            <input
              placeholder="Image URL"
              value={snap.logoSrc && !snap.logoSrc.startsWith("data:") ? snap.logoSrc : ""}
              onChange={(e) => bracketDemoModel.setLogoSrc(e.target.value || null)}
              className="px-2.5 py-1.5 rounded-full text-[11px] w-40 focus:outline-none"
              style={{
                fontFamily: FONT_BODY,
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            />
            <label
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase transition-all hover:brightness-110 active:scale-95 cursor-pointer"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.08em",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            >
              <ImagePlus className="w-2.5 h-2.5" />
              Upload
              <input type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
            </label>
            {snap.logoSrc && snap.logoSrc !== DEFAULT_LOGO_SRC && (
              <ActionButton
                onClick={() => bracketDemoModel.setLogoSrc(DEFAULT_LOGO_SRC)}
                title="Reset to default watermark"
                icon={<RotateCcw className="w-2.5 h-2.5" />}
              >
                Reset
              </ActionButton>
            )}
            {snap.logoSrc && (
              <ActionButton onClick={() => bracketDemoModel.setLogoSrc(null)} title="Remove watermark" icon={<X className="w-2.5 h-2.5" />}>
                Clear
              </ActionButton>
            )}
          </ControlCluster>
        </div>

        {/* Roster */}
        <div
          className="flex items-start gap-3 px-5 py-2.5"
          style={{ background: "rgba(0,0,0,0.22)", borderTop: "1px solid var(--color-border-overlay)" }}
        >
          <span
            className="text-[9px] font-semibold uppercase shrink-0 pt-1.5"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.1em", color: "var(--color-outline)" }}
          >
            Teams ({snap.seededTeams.length})
          </span>
          <div
            className="flex-1 flex flex-wrap items-center gap-1.5 overflow-hidden transition-[max-height] duration-200 ease-out"
            style={{ maxHeight: rosterExpanded ? 999 : 30 }}
          >
            {snap.seededTeams.map((t, i) => (
              <span
                key={t.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px]"
                style={{
                  fontFamily: FONT_BODY,
                  background: "rgba(255,255,255,0.03)",
                  boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                  color: "var(--color-on-surface)",
                }}
              >
                <span className="text-[10px] tabular-nums" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
                  #{i + 1}
                </span>
                {t.name}
                <span className="text-[10px] font-bold" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}>
                  {t.code}
                </span>
              </span>
            ))}
          </div>
          {snap.seededTeams.length > 0 && (
            <button
              type="button"
              onClick={() => setRosterExpanded((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold uppercase shrink-0 transition-colors hover:brightness-125"
              style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.06em", color: "var(--color-outline)" }}
            >
              {rosterExpanded ? (
                <>
                  Collapse <ChevronUp className="w-2.5 h-2.5" />
                </>
              ) : (
                <>
                  Show all <ChevronDown className="w-2.5 h-2.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <StatusChyron text={snap.narratorText} />

      {/* ── Bracket board — data-demo-panel is the coordinate space the */}
      {/*    bot cursor's positions are computed against.               */}
      <div data-demo-panel="bracket" className="flex-1 min-h-0 overflow-auto relative z-10">
        <BotCursor cursor={snap.cursor} />

        {snap.format === "single_elimination" && snap.singleRounds && (
          <TournamentBracket
            rounds={snap.singleRounds}
            onRecordResult={handleSingleResult}
            hideHeader
            className="!min-h-0"
            logoSrc={snap.logoSrc ?? undefined}
          />
        )}

        {snap.format === "double_elimination" && snap.doubleData && (
          <DoubleElimBoard
            data={snap.doubleData}
            onRecordResult={handleDoubleResult}
            hideHeader
            className="!min-h-0"
            logoSrc={snap.logoSrc ?? undefined}
          />
        )}
      </div>

      {snap.status === "completed" && (
        <BracketCompletionOverlay
          mode={snap.mode}
          championName={champion}
          onTryItYourself={handleTryItYourself}
          onRestart={handleRestart}
        />
      )}

      {showAdminOverlay && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <button
            type="button"
            onClick={() => setShowAdminOverlay(false)}
            className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors hover:brightness-110"
            style={{
              fontFamily: "var(--font-label-mono)",
              background: "rgba(13,17,23,0.96)",
              border: "1px solid var(--color-border-overlay)",
              color: "var(--color-on-surface)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            }}
          >
            <X className="w-3.5 h-3.5" />
            Close admin panel
          </button>
        </div>
      )}
    </div>
  );
}