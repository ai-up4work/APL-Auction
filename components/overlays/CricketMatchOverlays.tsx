// components/overlays/CricketMatchOverlays.tsx
//
// Cricket match-broadcast overlay set, restyled to match the APL reference
// designs: dark glass panels (backdrop-blur + translucent borders), the
// #E45D35 "APL orange" accent, Archivo Narrow for display type, Geist Mono
// for uppercase labels, Inter for body text. All components ship with
// hardcoded example data via default props, so they render correctly
// standalone — pass real props once you wire them to your bus/live data.
"use client";

import React from "react";

/* ────────────────────────────────────────────────────────────────────────
   Shared style tokens — pulled from the APL reference overlays.
   ──────────────────────────────────────────────────────────────────────── */
export const overlayFonts = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Geist+Mono:wght@400;500;700&family=Inter:wght@400;500&display=swap');
  .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
  .font-mono-geist { font-family: 'Geist Mono', monospace; }
  .font-inter      { font-family: 'Inter', sans-serif; }
`;

const ORANGE = "#E45D35";
const ORANGE_DIM = "rgba(228,93,53,0.3)";
const GLASS_BG = "rgba(16,20,21,0.7)";
const GLASS_BORDER = "1px solid rgba(255,255,255,0.1)";
const GLASS_SHADOW = "0 8px 32px 0 rgba(0,0,0,0.37)";
const GLASS_BLUR = "blur(12px)";

/* ────────────────────────────────────────────────────────────────────────
   Brand bug — top-left "LIVE" identity badge
   ──────────────────────────────────────────────────────────────────────── */
export function BrandBug({ label = "APL LIVE", tag = "Broadcast 4K" }: { label?: string; tag?: string }) {
  return (
    <div
      className="absolute top-10 left-10 px-6 py-3 rounded-tl-xl rounded-br-xl flex items-center gap-4"
      style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW, borderLeft: `4px solid ${ORANGE}` }}
    >
      <div className="flex flex-col">
        <span className="font-archivo leading-none uppercase tracking-tighter" style={{ fontSize: 22, color: ORANGE, textShadow: "0 0 10px rgba(228,93,53,0.4)" }}>{label}</span>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "#ffb4ab" }} />
          <span className="font-mono-geist uppercase" style={{ fontSize: 10, letterSpacing: "0.2em", color: "#c6c6cd" }}>{tag}</span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Target widget — top-right run chase state
   ──────────────────────────────────────────────────────────────────────── */
export type TargetWidgetProps = { target?: number; needRuns?: number; needBalls?: number; progressPct?: number };

export function TargetWidget({ target = 210, needRuns = 26, needBalls = 10, progressPct = 75 }: TargetWidgetProps) {
  return (
    <div
      className="absolute top-10 right-10 px-6 py-4 rounded-xl flex flex-col items-end"
      style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW, borderRight: `4px solid ${ORANGE}` }}
    >
      <div className="font-mono-geist uppercase" style={{ fontSize: 10, letterSpacing: "0.2em", color: "#c6c6cd", marginBottom: 4 }}>Target: {target}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-archivo uppercase" style={{ fontSize: 20, color: "#e0e3e4" }}>Need</span>
        <span className="font-archivo" style={{ fontSize: 20, color: ORANGE, filter: "drop-shadow(0 0 4px rgba(228,93,53,0.5))" }}>{needRuns}</span>
        <span className="font-archivo uppercase" style={{ fontSize: 20, color: "#e0e3e4" }}>runs from</span>
        <span className="font-archivo" style={{ fontSize: 20, color: ORANGE, filter: "drop-shadow(0 0 4px rgba(228,93,53,0.5))" }}>{needBalls}</span>
        <span className="font-archivo uppercase" style={{ fontSize: 20, color: "#e0e3e4" }}>balls</span>
      </div>
      <div className="w-full h-1 rounded-full overflow-hidden mt-3" style={{ background: "#313536" }}>
        <div className="h-full" style={{ width: `${progressPct}%`, background: ORANGE, boxShadow: "0 0 8px rgba(228,93,53,0.5)" }} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Main scoreboard — bottom-left bar: skewed team tag, score/overs, batsmen
   ──────────────────────────────────────────────────────────────────────── */
export type Batsman = { name: string; runs: number; balls: number; onStrike?: boolean };

export type MainScoreboardProps = {
  team?: string;
  teamSub?: string;
  score?: string;
  overs?: string;
  batsmen?: Batsman[];
};

export function MainScoreboard({
  team = "MUM",
  teamSub = "STRIKERS",
  score = "184/4",
  overs = "18.2",
  batsmen = [
    { name: "V Kohli", runs: 74, balls: 42, onStrike: true },
    { name: "S Yadav", runs: 12, balls: 8 },
  ],
}: MainScoreboardProps) {
  return (
    <div className="absolute left-10 bottom-10 flex items-stretch h-20 rounded-xl overflow-hidden" style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW }}>
      <div className="px-8 flex items-center justify-center -ml-4" style={{ background: ORANGE, transform: "skewX(-12deg)" }}>
        <div className="flex flex-col items-center" style={{ transform: "skewX(12deg)" }}>
          <span className="font-archivo font-black leading-none text-white" style={{ fontSize: 20 }}>{team}</span>
          <span className="font-mono-geist text-white/80 uppercase" style={{ fontSize: 9, letterSpacing: "0.2em" }}>{teamSub}</span>
        </div>
      </div>
      <div className="flex-grow flex items-center px-8 justify-between gap-8">
        <div className="flex items-baseline gap-4">
          <div className="flex flex-col">
            <span className="font-mono-geist uppercase" style={{ fontSize: 10, color: "#c6c6cd" }}>Score</span>
            <span className="font-archivo font-bold" style={{ fontSize: 30, color: "#e0e3e4" }}>{score}</span>
          </div>
          <div className="h-10 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div className="flex flex-col">
            <span className="font-mono-geist uppercase" style={{ fontSize: 10, color: "#c6c6cd" }}>Overs</span>
            <span className="font-archivo font-bold" style={{ fontSize: 30, color: "#e0e3e4" }}>{overs}</span>
          </div>
        </div>
        <div className="flex items-center gap-10">
          {batsmen.map((b) => (
            <div key={b.name} className="flex flex-col items-end" style={{ opacity: b.onStrike ? 1 : 0.7 }}>
              <div className="flex items-center gap-2">
                <span className="font-archivo" style={{ fontSize: 15, color: "#e0e3e4" }}>{b.name.toUpperCase()}</span>
                {b.onStrike && <span style={{ color: ORANGE, fontSize: 12 }}>&#9733;</span>}
              </div>
              <span className="font-mono-geist font-bold" style={{ fontSize: 15, color: b.onStrike ? ORANGE : "#e0e3e4" }}>
                {b.runs}{b.onStrike ? "*" : ""} <span className="font-normal" style={{ fontSize: 12, color: "#c6c6cd" }}>({b.balls})</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Batsman stats panel — standalone list version (used when the main
   scoreboard above only needs to show one active pair inline)
   ──────────────────────────────────────────────────────────────────────── */
export type BatsmanStatsPanelProps = { batsmen?: Batsman[] };

export function BatsmanStatsPanel({
  batsmen = [
    { name: "Rohit Sharma", runs: 78, balls: 46, onStrike: true },
    { name: "Ishan Kishan", runs: 34, balls: 28 },
  ],
}: BatsmanStatsPanelProps) {
  return (
    <div className="absolute left-10 bottom-36 w-[280px] rounded-xl overflow-hidden" style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW }}>
      <div className="font-mono-geist px-4 py-1.5 uppercase" style={{ background: ORANGE, color: "white", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em" }}>
        Batting
      </div>
      {batsmen.map((b) => {
        const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0";
        return (
          <div key={b.name} className="flex items-center justify-between px-4 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2">
              {b.onStrike && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ORANGE, boxShadow: `0 0 6px ${ORANGE}` }} />}
              <span className="font-archivo" style={{ fontSize: 14, fontWeight: 600, color: "#e0e3e4" }}>{b.name}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-archivo font-bold" style={{ fontSize: 15, color: "#e0e3e4" }}>{b.runs}</span>
              <span className="font-mono-geist" style={{ fontSize: 10, color: "#c6c6cd" }}>({b.balls})</span>
              <span className="font-mono-geist" style={{ fontSize: 9, color: ORANGE }}>SR {sr}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Bowler stats panel — bottom-right, "Current Bowler" tag + O-M-R-W grid
   ──────────────────────────────────────────────────────────────────────── */
export type BowlerStatsPanelProps = {
  name?: string;
  overs?: string;
  maidens?: number;
  runs?: number;
  wickets?: number;
};

export function BowlerStatsPanel({
  name = "M Shami",
  overs = "3.2",
  maidens = 0,
  runs = 28,
  wickets = 2,
}: BowlerStatsPanelProps) {
  return (
    <div
      className="absolute right-10 bottom-10 w-[320px] h-20 rounded-xl flex flex-col justify-center px-6 relative overflow-hidden"
      style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW, borderBottom: `4px solid ${ORANGE}` }}
    >
      <div className="absolute top-0 right-0 p-2">
        <span className="font-mono-geist uppercase" style={{ fontSize: 9, color: ORANGE, background: "rgba(228,93,53,0.1)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.05em" }}>
          Current bowler
        </span>
      </div>
      <span className="font-archivo uppercase tracking-tight" style={{ fontSize: 18, color: "#e0e3e4" }}>{name}</span>
      <div className="flex items-center gap-3 mt-1">
        <Stat label="O" value={overs} />
        <Divider />
        <Stat label="M" value={String(maidens)} />
        <Divider />
        <Stat label="R" value={String(runs)} />
        <Divider />
        <Stat label="W" value={String(wickets)} accent />
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono-geist" style={{ fontSize: 11, color: "#c6c6cd" }}>{label}</span>
      <span className="font-mono-geist font-bold" style={{ fontSize: 13, color: accent ? ORANGE : "#e0e3e4" }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.1)" }} />;
}

/* ────────────────────────────────────────────────────────────────────────
   Partnership tracker — small pill
   ──────────────────────────────────────────────────────────────────────── */
export type PartnershipTrackerProps = { runs?: number; balls?: number };

export function PartnershipTracker({ runs = 62, balls = 41 }: PartnershipTrackerProps) {
  return (
    <div
      className="absolute left-10 bottom-32 font-mono-geist flex items-center gap-2 px-4 py-1.5 rounded-full uppercase"
      style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW, fontSize: 10, letterSpacing: "0.1em", color: "#c6c6cd" }}
    >
      Partnership
      <span className="font-archivo font-bold" style={{ color: ORANGE, fontSize: 13 }}>{runs} ({balls})</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Last-over ticker — six ball pips, centered pill
   ──────────────────────────────────────────────────────────────────────── */
export type OverSummaryStripProps = { balls?: string[] };

function pipStyle(result: string): React.CSSProperties {
  if (result === "W") return { background: ORANGE, color: "white", boxShadow: "0 0 10px rgba(228,93,53,0.4)" };
  if (result === "6") return { background: "rgba(228,93,53,0.2)", color: ORANGE, border: `1px solid ${ORANGE}` };
  return { background: "transparent", color: "#e0e3e4", border: "1px solid rgba(255,255,255,0.1)" };
}

export function OverSummaryStrip({ balls = ["1", "4", "W", "1", "0", "6"] }: OverSummaryStripProps) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 bottom-2 px-4 py-2 rounded-full flex items-center gap-3"
      style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW }}
    >
      <span className="font-mono-geist uppercase" style={{ fontSize: 10, letterSpacing: "0.2em", color: "#c6c6cd", marginRight: 6 }}>Last over:</span>
      <div className="flex gap-2">
        {balls.map((b, i) => (
          <span
            key={i}
            className="font-archivo font-bold flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, fontSize: 13, ...pipStyle(b) }}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Powerplay badge
   ──────────────────────────────────────────────────────────────────────── */
export function PowerplayBadge({ label = "Powerplay &middot; Overs 1-6" }: { label?: string }) {
  return (
    <div
      className="absolute top-10 left-10 font-mono-geist px-4 py-1.5 rounded-full uppercase"
      style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW, color: ORANGE, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em" }}
      dangerouslySetInnerHTML={{ __html: label }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Milestone popup — fifty / century celebration
   ──────────────────────────────────────────────────────────────────────── */
export type MilestonePopupProps = { player?: string; milestone?: string; ballsTaken?: number };

export function MilestonePopup({ player = "V Kohli", milestone = "50", ballsTaken = 34 }: MilestonePopupProps) {
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl px-10 py-6 text-center"
      style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: `2px solid ${ORANGE_DIM}`, boxShadow: "0 0 60px rgba(228,93,53,0.35)" }}
    >
      <div className="font-archivo font-bold italic" style={{ fontSize: 56, color: ORANGE, lineHeight: 1 }}>{milestone}</div>
      <div className="font-mono-geist uppercase mt-2" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#e0e3e4" }}>
        {player} &middot; off {ballsTaken} balls
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Wicket fall graphic
   ──────────────────────────────────────────────────────────────────────── */
export type WicketGraphicProps = { batsman?: string; dismissal?: string; runs?: number; balls?: number };

export function WicketGraphic({ batsman = "R Sharma", dismissal = "c Rahul b Bumrah", runs = 78, balls = 46 }: WicketGraphicProps) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ boxShadow: "0 0 60px rgba(228,93,53,0.3)" }}>
      <div className="relative px-14 py-6 rounded-md text-center" style={{ border: `4px solid ${ORANGE}`, background: "rgba(228,93,53,0.12)" }}>
        <span className="font-archivo block italic font-bold uppercase" style={{ fontSize: 64, color: ORANGE, letterSpacing: "0.08em" }}>Out!</span>
        <span className="font-mono-geist block mt-2" style={{ fontSize: 12, color: "#e0e3e4", letterSpacing: "0.04em" }}>
          {batsman} {dismissal}, {runs} ({balls})
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Points table — mini standings
   ──────────────────────────────────────────────────────────────────────── */
export type StandingRow = { team: string; played: number; won: number; nrr: string; pts: number };

export type PointsTableProps = { rows?: StandingRow[] };

export function PointsTable({
  rows = [
    { team: "MUM", played: 8, won: 6, nrr: "+0.84", pts: 12 },
    { team: "RSA", played: 8, won: 5, nrr: "+0.42", pts: 10 },
    { team: "IND", played: 8, won: 4, nrr: "-0.11", pts: 8 },
    { team: "AUS", played: 8, won: 3, nrr: "-0.55", pts: 6 },
  ],
}: PointsTableProps) {
  return (
    <div className="absolute left-1/2 top-10 -translate-x-1/2 w-[380px] rounded-xl overflow-hidden" style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW }}>
      <div className="font-mono-geist px-4 py-2 uppercase" style={{ background: ORANGE, color: "white", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em" }}>
        Points table
      </div>
      <table className="w-full font-mono-geist" style={{ fontSize: 11, color: "#e0e3e4" }}>
        <thead>
          <tr style={{ color: "#c6c6cd" }}>
            <td className="px-4 py-1.5">Team</td>
            <td className="px-2 py-1.5 text-right">P</td>
            <td className="px-2 py-1.5 text-right">W</td>
            <td className="px-2 py-1.5 text-right">NRR</td>
            <td className="px-4 py-1.5 text-right">Pts</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <td className="font-archivo px-4 py-1.5" style={{ fontWeight: 600 }}>{r.team}</td>
              <td className="px-2 py-1.5 text-right">{r.played}</td>
              <td className="px-2 py-1.5 text-right">{r.won}</td>
              <td className="px-2 py-1.5 text-right">{r.nrr}</td>
              <td className="px-4 py-1.5 text-right font-bold" style={{ color: ORANGE }}>{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Player of the match banner
   ──────────────────────────────────────────────────────────────────────── */
export type PlayerOfMatchProps = { player?: string; team?: string; line?: string };

export function PlayerOfMatchBanner({ player = "R Sharma", team = "MI", line = "78 (46) &middot; Player of the match" }: PlayerOfMatchProps) {
  return (
    <div className="absolute left-1/2 bottom-24 -translate-x-1/2 flex items-stretch rounded-xl overflow-hidden" style={{ background: GLASS_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, boxShadow: GLASS_SHADOW }}>
      <div className="w-1.5" style={{ background: ORANGE }} />
      <div className="px-6 py-3 text-center">
        <div className="font-mono-geist uppercase" style={{ fontSize: 9, letterSpacing: "0.2em", color: ORANGE }}>{team}</div>
        <div className="font-archivo font-bold italic" style={{ fontSize: 20, color: "#e0e3e4" }}>{player}</div>
        <div className="font-mono-geist" style={{ fontSize: 10, color: "#c6c6cd" }} dangerouslySetInnerHTML={{ __html: line }} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Match summary overlay — full-screen end-of-innings/match card:
   header bar, two team sections (batsmen + bowlers tables), winner footer
   ──────────────────────────────────────────────────────────────────────── */
export type SummaryBatsman = { name: string; runs: number; balls: number };
export type SummaryBowler = { name: string; wickets: number; runsConceded: number; overs: string };
export type TeamSummary = { name: string; code: string; overs: string; score: string; accent?: string; batsmen: SummaryBatsman[]; bowlers: SummaryBowler[] };

export type MatchSummaryOverlayProps = { teamA?: TeamSummary; teamB?: TeamSummary; result?: string };

export function MatchSummaryOverlay({
  teamA = {
    name: "INDIA",
    code: "IND",
    overs: "20 OVERS",
    score: "140-3",
    accent: ORANGE,
    batsmen: [
      { name: "Shreyas Iyer", runs: 50, balls: 40 },
      { name: "Axar Patel", runs: 40, balls: 33 },
      { name: "KL Rahul", runs: 30, balls: 22 },
      { name: "Virat Kohli", runs: 20, balls: 25 },
    ],
    bowlers: [
      { name: "Dale Steyn", wickets: 2, runsConceded: 40, overs: "4.0" },
      { name: "Lockie Ferguson", wickets: 1, runsConceded: 50, overs: "4.0" },
      { name: "Michael Bracewell", wickets: 0, runsConceded: 20, overs: "4.0" },
      { name: "Tom Latham", wickets: 0, runsConceded: 30, overs: "4.0" },
    ],
  },
  teamB = {
    name: "SOUTH AFRICA",
    code: "RSA",
    overs: "19 OVERS",
    score: "141-1",
    accent: "#4ade80",
    batsmen: [
      { name: "Marco Jansen", runs: 50, balls: 36 },
      { name: "Heinrich Klaasen", runs: 50, balls: 54 },
      { name: "David Miller", runs: 36, balls: 20 },
      { name: "Aiden Markram", runs: 5, balls: 4 },
    ],
    bowlers: [
      { name: "Jasprit Bumrah", wickets: 1, runsConceded: 44, overs: "4.0" },
      { name: "Mohd. Shami", wickets: 0, runsConceded: 47, overs: "4.0" },
      { name: "Harshit Rana", wickets: 0, runsConceded: 30, overs: "4.0" },
      { name: "Ravindra Jadeja", wickets: 0, runsConceded: 20, overs: "3.0" },
    ],
  },
  result = "SOUTH AFRICA WON BY 9 WICKETS",
}: MatchSummaryOverlayProps) {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] rounded-xl overflow-hidden flex flex-col" style={{ border: "2px solid #363a3b", background: GLASS_BG, backdropFilter: GLASS_BLUR, boxShadow: GLASS_SHADOW }}>
      <div className="h-16 bg-white flex items-center justify-center relative overflow-hidden">
        <h1 className="font-archivo relative text-black font-extrabold uppercase" style={{ fontSize: 32, fontStyle: "italic", letterSpacing: "0.1em" }}>Match summary</h1>
        <div className="absolute right-0 h-full w-24" style={{ background: ORANGE, transform: "skewX(-25deg) translateX(48px)" }} />
      </div>
      <div className="flex flex-col p-1 gap-1">
        <TeamSummaryBlock team={teamA} />
        <TeamSummaryBlock team={teamB} />
      </div>
      <div className="mt-auto h-16 flex items-center justify-center" style={{ background: "rgba(228,93,53,0.15)", borderTop: `1px solid ${ORANGE_DIM}` }}>
        <div className="font-archivo italic font-black" style={{ fontSize: 26, letterSpacing: "0.2em", color: "#e0e3e4" }}>{result}</div>
      </div>
    </div>
  );
}

function TeamSummaryBlock({ team }: { team: TeamSummary }) {
  const accent = team.accent ?? ORANGE;
  return (
    <div className="flex flex-col border-b pb-1" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between px-6 py-2" style={{ background: `linear-gradient(90deg, ${accent}33 0%, transparent 100%)`, borderLeft: `4px solid ${accent}` }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <span className="font-archivo font-bold" style={{ fontSize: 13, color: "#e0e3e4" }}>{team.code}</span>
          </div>
          <h2 className="font-archivo font-bold" style={{ fontSize: 24, color: "#e0e3e4" }}>{team.name}</h2>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontSize: 16, color: "#c6c6cd" }}>{team.overs}</span>
          <span className="font-archivo font-black" style={{ fontSize: 26, color: accent }}>{team.score}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px mt-1" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="flex flex-col" style={{ background: "rgba(16,20,21,0.6)" }}>
          <div className="flex px-6 py-1.5 uppercase font-bold" style={{ background: "rgba(255,255,255,0.03)", fontSize: 11, letterSpacing: "0.1em", color: "#c6c6cd" }}>
            <span className="flex-1">Batsmen</span>
            <span className="w-10 text-right">R</span>
            <span className="w-10 text-right">B</span>
          </div>
          {team.batsmen.map((b, i) => (
            <div key={b.name} className="flex px-6 py-2" style={{ background: i % 2 === 1 ? "rgba(255,255,255,0.03)" : "transparent" }}>
              <span className="flex-1 font-semibold uppercase" style={{ fontSize: 13, color: "#e0e3e4" }}>{b.name}</span>
              <span className="w-10 text-right font-bold" style={{ fontSize: 13, color: accent }}>{b.runs}</span>
              <span className="w-10 text-right" style={{ fontSize: 13, color: "#c6c6cd" }}>{b.balls}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col" style={{ background: "rgba(16,20,21,0.6)" }}>
          <div className="flex px-6 py-1.5 uppercase font-bold" style={{ background: "rgba(255,255,255,0.03)", fontSize: 11, letterSpacing: "0.1em", color: "#c6c6cd" }}>
            <span className="flex-1">Bowlers</span>
            <span className="w-12 text-right">W-R</span>
            <span className="w-10 text-right">O</span>
          </div>
          {team.bowlers.map((b, i) => (
            <div key={b.name} className="flex px-6 py-2" style={{ background: i % 2 === 1 ? "rgba(255,255,255,0.03)" : "transparent" }}>
              <span className="flex-1 font-semibold uppercase" style={{ fontSize: 13, color: "#e0e3e4" }}>{b.name}</span>
              <span className="w-12 text-right font-bold" style={{ fontSize: 13, color: accent }}>{b.wickets}-{b.runsConceded}</span>
              <span className="w-10 text-right" style={{ fontSize: 13, color: "#c6c6cd" }}>{b.overs}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}