// File: components/demo/TournamentAdminPanel.tsx
"use client";
import { useState } from "react";
import { Trophy, Shuffle, Wand2, X, Plus, PartyPopper, Eraser, ImagePlus } from "lucide-react";
import TournamentBracket from "@/components/demo/TournamentBracket";
import type { Round } from "@/components/demo/TournamentBracket";
import DoubleElimBoard from "@/components/demo/DoubleElimBoard";
import MatchResultCard from "@/components/demo/MatchResultCard";
import FormatDescription from "@/components/demo/FormatDescription";
import { AdminTeam, makeTeamId, randomDraw } from "@/lib/tournament/seeding";
import { getDemoTeams } from "@/lib/tournament/demoTeams";
import { generateSingleElimination, recordSingleElimResult, championOf } from "@/lib/tournament/singleElim";
import {
  generateDoubleElimination,
  recordDoubleElimResult,
  championOfDoubleElim,
  DoubleElimData,
} from "@/lib/tournament/doubleElim";

type FormatType = "single_elimination" | "double_elimination";

const FORMAT_LABELS: Record<FormatType, string> = {
  single_elimination: "Single Elim",
  double_elimination: "Double Elim",
};
const FORMAT_LABELS_LONG: Record<FormatType, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
};

const DEFAULT_LOGO_SRC = "/trophy-watermark.svg";

// The mono/uppercase/wide-tracking face is a deliberate console-eyebrow
// device (badges, labels, codes) — keep it there. Anything meant to be
// *read* (typed team names, roster text) uses this instead. Falls back to
// the system UI stack if --font-body isn't defined in globals.css, so this
// is safe even if that token doesn't exist yet — swap the var name if your
// design system calls it something else.
const FONT_BODY = "var(--font-body, 'Inter', ui-sans-serif, system-ui, sans-serif)";

/* ------------------------------------------------------------------ */
/*  Same header-deck-board console structure as the sandbox page       */
/*  (app/sandbox/brackets/page.tsx) instead of a stack of form cards —  */
/*  this is the "build" console, that one is the "run" console, and     */
/*  they should read as two modes of one instrument, not two products. */
/*  Atoms below are intentionally identical in class/style shape to     */
/*  their counterparts there.                                          */
/* ------------------------------------------------------------------ */

function ControlCluster({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
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
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
/*  Props                                                               */
/*  logoSrc / onLogoSrcChange are optional so this panel keeps working  */
/*  standalone (e.g. mounted directly on an admin route) by falling     */
/*  back to its own internal state. When a parent DOES pass them (see   */
/*  app/sandbox/brackets/page.tsx), the panel becomes a controlled      */
/*  watermark picker and the parent's board can render the same logo.   */
/* ------------------------------------------------------------------ */

type TournamentAdminPanelProps = {
  logoSrc?: string | null;
  onLogoSrcChange?: (src: string | null) => void;
};

export default function TournamentAdminPanel({ logoSrc: logoSrcProp, onLogoSrcChange }: TournamentAdminPanelProps = {}) {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [format, setFormat] = useState<FormatType>("single_elimination");

  const [singleRounds, setSingleRounds] = useState<Round[] | null>(null);
  const [doubleData, setDoubleData] = useState<DoubleElimData | null>(null);

  // Uncontrolled fallback store — only used when the parent doesn't pass
  // logoSrc/onLogoSrcChange props.
  const [internalLogoSrc, setInternalLogoSrc] = useState<string | null>(DEFAULT_LOGO_SRC);
  const isControlled = logoSrcProp !== undefined;
  const logoSrc = isControlled ? logoSrcProp : internalLogoSrc;
  const setLogoSrc = (src: string | null) => {
    if (onLogoSrcChange) onLogoSrcChange(src);
    if (!isControlled) setInternalLogoSrc(src);
  };

  function addTeam() {
    if (!nameInput.trim() || !codeInput.trim()) return;
    setTeams((prev) => [
      ...prev,
      { id: makeTeamId(), name: nameInput.trim(), code: codeInput.trim().toUpperCase().slice(0, 4) },
    ]);
    setNameInput("");
    setCodeInput("");
  }

  function removeTeam(id: string) {
    setTeams((prev) => prev.filter((t) => t.id !== id));
  }

  function draw() {
    setTeams((prev) => randomDraw(prev));
  }

  function autofillDemoTeams() {
    setTeams(getDemoTeams());
  }

  function clearAll() {
    setTeams([]);
    setSingleRounds(null);
    setDoubleData(null);
  }

  function generate() {
    setSingleRounds(null);
    setDoubleData(null);
    if (teams.length < 2) return;
    if (format === "single_elimination") setSingleRounds(generateSingleElimination(teams));
    else if (format === "double_elimination") setDoubleData(generateDoubleElimination(teams));
  }

  function handleSingleResult(matchId: string, winner: "A" | "B", a: number, b: number) {
    if (!singleRounds) return;
    const next = singleRounds.map((r) => ({ ...r, matches: [...r.matches] }));
    recordSingleElimResult(next, matchId, winner, a, b);
    setSingleRounds(next);
  }

  function handleDoubleResult(matchId: string, winner: "A" | "B", a: number, b: number) {
    if (!doubleData) return;
    const next: DoubleElimData = { ...doubleData };
    recordDoubleElimResult(next, matchId, winner, a, b);
    setDoubleData({ ...next });
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selecting the same file later
  }

  const champion =
    format === "single_elimination"
      ? singleRounds ? championOf(singleRounds) : null
      : format === "double_elimination"
      ? doubleData ? championOfDoubleElim(doubleData) : null
      : null;

  const bracketGenerated = !!singleRounds || !!doubleData;
  const logoUrlInputValue = logoSrc && !logoSrc.startsWith("data:") ? logoSrc : "";

  return (
    <div className="min-h-screen w-full relative flex flex-col" style={{ background: "var(--color-background)", color: "var(--color-on-surface)" }}>
      <style jsx global>{`
        @keyframes adminFeedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

      {/* Same ambient texture as the run console. */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(900px 380px at 50% 0%, color-mix(in srgb, var(--color-theme-orange) 7%, transparent), transparent 65%), " +
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* ── Console header — same shape as the sandbox's: status badge, */}
      {/*    a big italic readout, a status chip. Close button lives     */}
      {/*    outside this component (rendered by the page that mounts    */}
      {/*    it as an overlay), so this header only carries panel-owned  */}
      {/*    info instead of duplicating it.                             */}
      <div
        className="shrink-0 h-11 flex items-center px-4 relative z-20"
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
                animation: "adminFeedPulse 1.6s ease-in-out infinite",
                boxShadow: "0 0 6px 1px color-mix(in srgb, var(--color-theme-orange) 60%, transparent)",
              }}
            />
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.11em", color: "var(--color-theme-orange)" }}
            >
              Admin
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
              Build a tournament
            </span>
          </div>

          <div
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-[3px]"
            style={{ background: "rgba(0,0,0,0.22)", border: "1px solid var(--color-border-overlay)" }}
          >
            <span
              className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-[2px]"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.06em",
                color: teams.length >= 2 ? "#08110c" : "var(--color-on-surface)",
                background: teams.length >= 2 ? "#3ddc84" : "transparent",
              }}
            >
              {teams.length >= 2 ? "Ready" : "Needs teams"}
            </span>
            <span
              className="text-[11px] tabular-nums"
              style={{ fontFamily: FONT_BODY, color: "var(--color-outline)" }}
            >
              {teams.length} teams
            </span>
          </div>
        </div>
      </div>

      {/* ── Control deck — same clusters-in-a-glass-strip layout as the */}
      {/*    sandbox: format, add-team, roster management, all in one    */}
      {/*    horizontal deck instead of stacked cards.                   */}
      <div
        className="shrink-0 relative z-10"
        style={{ background: "rgba(10,10,10,0.35)", borderBottom: "1px solid var(--color-border-overlay)" }}
      >
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-5 py-4">
          <ControlCluster label="Format">
            {(Object.keys(FORMAT_LABELS) as FormatType[]).map((f) => (
              <Pill key={f} active={format === f} onClick={() => setFormat(f)}>
                {FORMAT_LABELS[f]}
              </Pill>
            ))}
          </ControlCluster>

          <ControlCluster label="Add team">
            <input
              placeholder="Team name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTeam()}
              className="px-2.5 py-1.5 rounded-full text-[12px] w-36 focus:outline-none"
              style={{
                fontFamily: FONT_BODY,
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            />
            <input
              placeholder="Code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTeam()}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold w-16 uppercase text-center focus:outline-none"
              style={{
                fontFamily: "var(--font-label-mono)",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            />
            <ActionButton onClick={addTeam} disabled={!nameInput.trim() || !codeInput.trim()} solid icon={<Plus className="w-2.5 h-2.5" />}>
              Add
            </ActionButton>
          </ControlCluster>

          <ControlCluster label="Roster tools">
            <ActionButton onClick={draw} disabled={teams.length < 2} title="Randomize the current team order" icon={<Shuffle className="w-2.5 h-2.5" />}>
              Random draw
            </ActionButton>
            <ActionButton onClick={autofillDemoTeams} icon={<Wand2 className="w-2.5 h-2.5" />}>
              Autofill 32
            </ActionButton>
            <ActionButton onClick={clearAll} disabled={teams.length === 0} icon={<Eraser className="w-2.5 h-2.5" />}>
              Clear all
            </ActionButton>
          </ControlCluster>

          <ControlCluster label="Watermark">
            <input
              placeholder="Image URL"
              value={logoUrlInputValue}
              onChange={(e) => setLogoSrc(e.target.value || null)}
              className="px-2.5 py-1.5 rounded-full text-[11px] w-40 focus:outline-none"
              style={{
                fontFamily: FONT_BODY,
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            />
            <label
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase transition-all hover:brightness-110 active:scale-95 cursor-pointer"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.12em",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            >
              <ImagePlus className="w-2.5 h-2.5" />
              Upload
              <input type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
            </label>
            {logoSrc && logoSrc !== DEFAULT_LOGO_SRC && (
              <ActionButton onClick={() => setLogoSrc(DEFAULT_LOGO_SRC)} icon={<RotateIcon />} title="Reset to default watermark">
                Reset
              </ActionButton>
            )}
            {logoSrc && (
              <ActionButton onClick={() => setLogoSrc(null)} icon={<X className="w-2.5 h-2.5" />} title="Remove watermark">
                Clear
              </ActionButton>
            )}
          </ControlCluster>

          <ControlCluster label="Bracket">
            <ActionButton onClick={generate} disabled={teams.length < 2} solid icon={<Trophy className="w-2.5 h-2.5" />}>
              Generate {FORMAT_LABELS_LONG[format]}
            </ActionButton>
          </ControlCluster>

          {champion && (
            <div className="flex flex-col gap-1.5 ml-auto">
              <span className="text-[9px] font-semibold uppercase" style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.13em", color: "var(--color-outline)" }}>
                Champion
              </span>
              <span
                className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--color-theme-orange) 14%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--color-theme-orange) 45%, transparent)",
                }}
              >
                <PartyPopper className="w-3 h-3" style={{ color: "var(--color-theme-orange)" }} />
                <span
                  className="text-[12px] font-bold"
                  style={{ fontFamily: FONT_BODY, color: "var(--color-theme-orange)" }}
                >
                  {champion.name}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Roster — same glass strip treatment as the sandbox's team row,
            with per-team remove affordance since this console builds the
            roster instead of just displaying it. */}
        <div
          className="flex items-start gap-3 px-5 py-2.5"
          style={{ background: "rgba(0,0,0,0.22)", borderTop: "1px solid var(--color-border-overlay)" }}
        >
          <span
            className="text-[9px] font-semibold uppercase shrink-0 pt-1.5"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.1em", color: "var(--color-outline)" }}
          >
            Teams ({teams.length})
          </span>
          {teams.length === 0 ? (
            <span
              className="text-[12px]"
              style={{ fontFamily: FONT_BODY, color: "var(--color-outline)" }}
            >
              No teams yet — add one, or autofill 32 demo teams above.
            </span>
          ) : (
            <div className="flex-1 flex flex-wrap items-center gap-1.5">
              {teams.map((t, i) => (
                <span
                  key={t.id}
                  className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-[12px]"
                  style={{
                    fontFamily: FONT_BODY,
                    background: "rgba(255,255,255,0.03)",
                    boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                    color: "var(--color-on-surface)",
                  }}
                >
                  <span
                    className="text-[10px] tabular-nums"
                    style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}
                  >
                    #{i + 1}
                  </span>
                  {t.name}
                  <span
                    className="text-[10px] font-bold"
                    style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}
                  >
                    {t.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTeam(t.id)}
                    className="w-4 h-4 flex items-center justify-center rounded-full transition-colors"
                    style={{ color: "var(--color-outline)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#e5484d";
                      e.currentTarget.style.background = "rgba(229,72,77,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--color-outline)";
                      e.currentTarget.style.background = "transparent";
                    }}
                    aria-label={`Remove ${t.name}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Format rules — same quiet reference note as the run console. */}
        <div
          className="px-5 py-2 text-[10px]"
          style={{ borderTop: "1px solid var(--color-border-overlay)", background: "rgba(10,10,10,0.2)", color: "var(--color-outline)" }}
        >
          <FormatDescription format={format} />
        </div>
      </div>

      {/* ── Bracket board — same role as the sandbox's board area: the   */}
      {/*    thing being built/run, filling the rest of the viewport.    */}
      <div className="flex-1 min-h-0 overflow-auto relative z-10">
        {!bracketGenerated && (
          <div className="h-full flex items-center justify-center px-6">
            <p
              className="text-[11px] text-center max-w-sm"
              style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}
            >
              Add at least 2 teams, then hit Generate to lay out the bracket here.
            </p>
          </div>
        )}

        {format === "single_elimination" && singleRounds && (
          <div className="flex flex-col gap-6 p-6">
            <TournamentBracket rounds={singleRounds} title="Bracket Preview" logoSrc={logoSrc ?? undefined} />
            <ResultsGrid rounds={singleRounds} onRecordResult={handleSingleResult} />
          </div>
        )}

        {format === "double_elimination" && doubleData && (
          <DoubleElimBoard data={doubleData} onRecordResult={handleDoubleResult} logoSrc={logoSrc ?? undefined} />
        )}
      </div>
    </div>
  );
}

// Small inline icon so we don't pull in another lucide import just for
// the reset button — matches the stroke weight/size of the others.
function RotateIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 2.6-6.4" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function ResultsGrid({
  rounds,
  onRecordResult,
}: {
  rounds: Round[];
  onRecordResult: (matchId: string, winner: "A" | "B", a: number, b: number) => void;
}) {
  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(13,17,23,0.6)", border: "1px solid var(--color-border-overlay)", backdropFilter: "blur(10px)" }}
    >
      <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--color-border-overlay)" }}>
        <Trophy className="w-3.5 h-3.5" style={{ color: "var(--color-outline)" }} />
        <span
          className="text-[10px] font-bold uppercase"
          style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.2em", color: "var(--color-outline)" }}
        >
          Enter results
        </span>
      </div>
      <div className="flex gap-4 overflow-x-auto p-5">
        {rounds.map((round) => (
          <div key={round.id} className="min-w-[220px] flex flex-col gap-3">
            <p
              className="text-[10px] font-bold uppercase text-center"
              style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.14em", color: "var(--color-outline)" }}
            >
              {round.name}
            </p>
            {round.matches.map((m) => (
              <MatchResultCard key={m.id} match={m} onRecordResult={onRecordResult} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}