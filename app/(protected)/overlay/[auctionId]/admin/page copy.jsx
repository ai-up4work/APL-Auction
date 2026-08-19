"use client";

import { useState } from "react";
import {
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Plus,
  ArrowLeftRight,
  AlertTriangle,
  Undo2,
  Pencil,
  Copy,
  Lock,
  Tv,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Reskinned in the auction console's own language: glass panels,
   Archivo Narrow italic-bold uppercase headers, Geist Mono caps
   for every label/data value, the theme-orange (#c9971f) gradient
   for primary actions, same dark near-black stage. Content/layout
   is unchanged from the real Overlay Control Room screens.
   ───────────────────────────────────────────────────────────── */

const ORANGE = "#c9971f";
const ORANGE_SOFT = "rgba(201,151,31,0.2)";
const ORANGE_FAINT = "rgba(201,151,31,0.08)";
const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";
const RED = "#ef4444";
const RED_SOFT = "rgba(239,68,68,0.4)";
const RED_FAINT = "rgba(239,68,68,0.1)";
const GREEN = "#22c55e";
const INDIGO = "#818cf8";

const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Geist+Mono:wght@400;500;700&family=Inter:wght@400;500;700&display=swap');
  .font-archivo { font-family: 'Archivo Narrow', sans-serif; }
  .font-mono-geist { font-family: 'Geist Mono', monospace; }
  .glass-panel {
    background: rgba(255,255,255,0.035);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.08);
  }
`;

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/* ── shell pieces ── */
function GlassCard({ children, className = "" }) {
  return <div className={`glass-panel rounded-2xl p-6 ${className}`}>{children}</div>;
}

function Eyebrow({ children }) {
  return (
    <p className="font-mono-geist text-[10px] text-white/40 uppercase tracking-[0.18em] font-bold mb-2.5">
      {children}
    </p>
  );
}

function TogglePill({ label, on, onClick, dotColor }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 font-mono-geist text-[10px] uppercase tracking-[0.12em] font-bold px-3 py-1.5 rounded transition-all shrink-0"
      style={{
        background: on ? `${dotColor}1a` : "rgba(255,255,255,0.03)",
        border: `1px solid ${on ? `${dotColor}40` : "rgba(255,255,255,0.08)"}`,
        color: on ? "#e5e7eb" : "rgba(255,255,255,0.4)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: on ? dotColor : "#4b5563" }} />
      {label}
    </button>
  );
}

function GroupLabel({ children }) {
  return (
    <span className="font-mono-geist text-[9px] text-white/30 uppercase tracking-[0.2em] font-bold shrink-0 mr-1">
      {children}
    </span>
  );
}

function PlayerSlot({ label, name, onClear }) {
  const filled = !!name;
  return (
    <div
      className="rounded-xl p-4"
      style={{ border: `1px dashed ${filled ? "rgba(255,255,255,0.12)" : RED_SOFT}`, background: filled ? "rgba(255,255,255,0.02)" : RED_FAINT }}
    >
      <p className="flex items-center gap-1.5 font-mono-geist text-[9px] uppercase tracking-[0.18em] font-bold mb-2.5" style={{ color: filled ? "rgba(255,255,255,0.4)" : RED }}>
        {!filled && <AlertTriangle className="h-2.5 w-2.5" />}
        {label}
      </p>
      <button onClick={onClear} className="flex items-center gap-2 font-archivo text-sm font-bold text-white">
        <span
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)" }}
        >
          <Plus className="h-3.5 w-3.5 text-white/40" />
        </span>
        {filled ? name : `Select ${label.toLowerCase().replace(" *", "")}`}
      </button>
    </div>
  );
}

export default function OverlayControlRoom() {
  const [alwaysOn, setAlwaysOn] = useState({ weather: true, liveScoreBar: true, tournamentLogo: true });
  const [fullScreen, setFullScreen] = useState({ pointsTable: false, matchScorecard: false, matchIntro: false });
  const [boundaries, setBoundaries] = useState({ matchBoundaries: false, tournamentBoundaries: false });
  const [testBg, setTestBg] = useState(false);

  const [scorerOpen, setScorerOpen] = useState(true);
  const [runs, setRuns] = useState(0);
  const [wkts, setWkts] = useState(0);
  const [legalBalls, setLegalBalls] = useState(0);
  const [freeHit, setFreeHit] = useState(false);
  const [extraMode, setExtraMode] = useState(null);
  const [striker, setStriker] = useState(null);
  const [nonStriker, setNonStriker] = useState(null);
  const [bowler, setBowler] = useState(null);
  const [history, setHistory] = useState([]);
  const [partnership, setPartnership] = useState({ runs: 0, balls: 0 });
  const [boundaryCount, setBoundaryCount] = useState({ fours: 0, sixes: 0 });
  const [bowlerFigures, setBowlerFigures] = useState({ overs: 0, balls: 0, runs: 0, wkts: 0 });

  const roster = [
    "Hasitha Perera", "Niroshan Jay", "Kavindu Silva", "Danushka Mendis",
    "Sahan Fernando", "Kaveen Mendis", "Yohan Raj", "Kusal Fernando",
  ];

  const overs = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
  const rr = legalBalls > 0 ? (runs / (legalBalls / 6)).toFixed(2) : "0.00";

  function snapshot() {
    return { runs, wkts, legalBalls, partnership, boundaryCount, bowlerFigures };
  }

  function record(runsAdded, { wicket = false, extra = null } = {}) {
    setHistory((h) => [...h, snapshot()]);
    const isLegal = !["Wd", "Nb"].includes(extra);
    setRuns((r) => r + runsAdded);
    if (wicket) setWkts((w) => w + 1);
    if (isLegal) setLegalBalls((b) => b + 1);
    setPartnership((p) => ({ runs: p.runs + runsAdded, balls: p.balls + (isLegal ? 1 : 0) }));
    if (runsAdded === 4) setBoundaryCount((m) => ({ ...m, fours: m.fours + 1 }));
    if (runsAdded === 6) setBoundaryCount((m) => ({ ...m, sixes: m.sixes + 1 }));
    setBowlerFigures((f) => {
      const balls = f.balls + (isLegal ? 1 : 0);
      return { overs: Math.floor(balls / 6), balls: balls % 6, runs: f.runs + runsAdded, wkts: f.wkts + (wicket ? 1 : 0) };
    });
    setExtraMode(null);
    setFreeHit(false);
  }

  function handleRun(n) {
    if (extraMode === "Wd" || extraMode === "Nb") return record(n + 1, { extra: extraMode });
    return record(n);
  }

  function handleOut() {
    if (freeHit) return;
    record(0, { wicket: true });
  }

  function handleUndo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setRuns(prev.runs);
    setWkts(prev.wkts);
    setLegalBalls(prev.legalBalls);
    setPartnership(prev.partnership);
    setBoundaryCount(prev.boundaryCount);
    setBowlerFigures(prev.bowlerFigures);
    setHistory((h) => h.slice(0, -1));
  }

  const extraOptions = ["Wide", "No Ball", "Bye", "Leg Bye"];
  const extraKeyFor = (label) => ({ Wide: "Wd", "No Ball": "Nb", Bye: "By", "Leg Bye": "Lb" }[label]);

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_STYLE }} />

      {/* subtle ambient glow, matching the auction stage */}
      <div className="fixed -top-20 -right-20 w-96 h-96 rounded-full blur-[120px] pointer-events-none" style={{ background: ORANGE_FAINT }} />

      {/* ── top bar ── */}
      <header className="relative flex items-center justify-between gap-3 px-6 h-16 glass-panel border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: ORANGE_FAINT, border: `1px solid ${ORANGE_SOFT}` }}>
            <Tv className="h-4 w-4" style={{ color: ORANGE }} />
          </div>
          <h1 className="font-archivo text-xl font-bold italic tracking-tight uppercase" style={{ color: ORANGE }}>
            On Air
          </h1>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full" style={{ background: GREEN, opacity: 0.5 }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: GREEN }} />
            </span>
            <span className="font-mono-geist text-[9px] uppercase tracking-[0.16em] font-bold" style={{ color: GREEN }}>Broadcasting</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono-geist text-[10px] text-white/40 uppercase tracking-[0.12em]">
          <Lock className="h-3 w-3" />
          Secure Admin Node
        </div>

        <button
          className="flex items-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] px-4 py-2 rounded transition-all hover:brightness-110 active:scale-95"
          style={{ background: "rgba(239,68,68,0.12)", border: `1px solid ${RED_SOFT}`, color: RED }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </button>
      </header>

      {/* ── toggle strip ── */}
      <div className="relative px-6 py-4 flex items-center gap-2 flex-wrap border-b border-white/5">
        <GroupLabel>Always On</GroupLabel>
        <TogglePill label="Weather" on={alwaysOn.weather} dotColor={GREEN} onClick={() => setAlwaysOn((a) => ({ ...a, weather: !a.weather }))} />
        <TogglePill label="Live Score Bar" on={alwaysOn.liveScoreBar} dotColor={GREEN} onClick={() => setAlwaysOn((a) => ({ ...a, liveScoreBar: !a.liveScoreBar }))} />
        <TogglePill label="Tournament Logo" on={alwaysOn.tournamentLogo} dotColor={GREEN} onClick={() => setAlwaysOn((a) => ({ ...a, tournamentLogo: !a.tournamentLogo }))} />

        <span className="w-px h-4 mx-1 bg-white/10" />

        <GroupLabel>Full-Screen</GroupLabel>
        <TogglePill label="Points Table" on={fullScreen.pointsTable} dotColor={ORANGE} onClick={() => setFullScreen((f) => ({ ...f, pointsTable: !f.pointsTable }))} />
        <TogglePill label="Match Scorecard" on={fullScreen.matchScorecard} dotColor={ORANGE} onClick={() => setFullScreen((f) => ({ ...f, matchScorecard: !f.matchScorecard }))} />
        <TogglePill label="Match Intro" on={fullScreen.matchIntro} dotColor={ORANGE} onClick={() => setFullScreen((f) => ({ ...f, matchIntro: !f.matchIntro }))} />

        <span className="w-px h-4 mx-1 bg-white/10" />

        <GroupLabel>Boundaries</GroupLabel>
        <TogglePill label="Match Boundaries" on={boundaries.matchBoundaries} dotColor={ORANGE} onClick={() => setBoundaries((b) => ({ ...b, matchBoundaries: !b.matchBoundaries }))} />
        <TogglePill label="Tournament Boundaries" on={boundaries.tournamentBoundaries} dotColor={ORANGE} onClick={() => setBoundaries((b) => ({ ...b, tournamentBoundaries: !b.tournamentBoundaries }))} />

        <span className="w-px h-4 mx-1 bg-white/10" />

        <TogglePill label="Test BG" on={testBg} dotColor={ORANGE} onClick={() => setTestBg((v) => !v)} />
      </div>

      <div className="relative px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ══════════════ LEFT / MAIN ══════════════ */}
        <div className="lg:col-span-2 space-y-6">
          {/* match setup bar */}
          <GlassCard className="flex items-center justify-between gap-3 flex-wrap !py-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded"
                style={{ background: ORANGE_FAINT, border: `1px solid ${ORANGE_SOFT}`, color: ORANGE }}
              >
                Match Setup · Locked
              </span>
              <span className="font-archivo text-base font-bold uppercase italic">JSH <span className="text-white/40 not-italic font-normal">vs</span> MWR</span>
              <span className="text-white/40 text-sm">· Galle Fort</span>
            </div>
            <button className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] px-3.5 py-1.5 rounded text-white/70 hover:text-white transition-colors" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Edit
            </button>
          </GlassCard>

          {/* SCORER CARD */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <button onClick={() => setScorerOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-6 py-4">
              <div className="flex items-center gap-3">
                <span
                  className="h-7 w-7 rounded-lg flex items-center justify-center font-mono-geist text-xs font-bold shrink-0"
                  style={{ border: `1px solid ${ORANGE_SOFT}`, color: ORANGE }}
                >
                  3
                </span>
                <div className="text-left">
                  <p className="font-archivo text-base font-bold uppercase italic leading-tight">Scorer</p>
                  <p className="font-mono-geist text-[10px] text-white/40 uppercase tracking-[0.1em] mt-0.5">Tap the ball, we do the maths</p>
                </div>
              </div>
              {scorerOpen ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
            </button>

            {scorerOpen && (
              <div className="px-6 pb-6 border-t border-white/5">
                {/* score row */}
                <div className="flex items-center justify-between gap-3 flex-wrap pt-5 pb-6">
                  <div className="flex items-baseline gap-3">
                    <span className="font-archivo text-5xl font-bold tabular-nums">{runs}/{wkts}</span>
                    <span className="font-mono-geist text-[11px] text-white/40 uppercase tracking-[0.1em]">{overs} ov · RR {rr} · JSH batting</span>
                  </div>
                  <button
                    className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] px-4 py-2 rounded transition-all hover:brightness-110 active:scale-95"
                    style={{ background: RED_FAINT, border: `1px solid ${RED_SOFT}`, color: RED }}
                  >
                    End Innings
                  </button>
                </div>

                {/* who's involved */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono-geist text-[10px] text-white/40 uppercase tracking-[0.18em] font-bold">Who's Involved</span>
                  <button
                    onClick={() => setPartnership({ runs: 0, balls: 0 })}
                    className="flex items-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded text-white/70"
                    style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <RotateCcw className="h-3 w-3" /> New Partnership
                  </button>
                </div>

                <Eyebrow>Batting Pair</Eyebrow>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4 -mt-1">
                  <PlayerSlot label="Striker *" name={striker} onClear={() => setStriker(null)} />
                  <button
                    onClick={() => { const s = striker; setStriker(nonStriker); setNonStriker(s); }}
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ border: `1px solid ${ORANGE_SOFT}` }}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" style={{ color: ORANGE }} />
                  </button>
                  <PlayerSlot label="Non-Striker" name={nonStriker} onClear={() => setNonStriker(null)} />
                </div>

                <p className="flex items-center gap-1.5 font-mono-geist text-[9px] text-white/40 uppercase tracking-[0.18em] font-bold mb-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: INDIGO }} /> Bowling
                </p>
                <div className="mb-5">
                  <div
                    className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
                    style={{ border: `1px dashed ${bowler ? "rgba(255,255,255,0.12)" : RED_SOFT}`, background: bowler ? "rgba(255,255,255,0.02)" : RED_FAINT }}
                  >
                    <div>
                      <p className="flex items-center gap-1.5 font-mono-geist text-[9px] uppercase tracking-[0.18em] font-bold mb-2.5" style={{ color: bowler ? "rgba(255,255,255,0.4)" : RED }}>
                        {!bowler && <AlertTriangle className="h-2.5 w-2.5" />} Bowler (MWR)
                      </p>
                      <button onClick={() => setBowler(null)} className="flex items-center gap-2 font-archivo text-sm font-bold">
                        <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
                          <Plus className="h-3.5 w-3.5 text-white/40" />
                        </span>
                        {bowler || "Select bowler"}
                      </button>
                    </div>
                    <span className="font-mono-geist text-[10px] text-white/30 uppercase tracking-[0.1em]">tap or drag a player below ▾</span>
                  </div>
                </div>

                <Eyebrow>Pick From MWR</Eyebrow>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mb-6 -mt-1">
                  {roster.map((name) => {
                    const isBowler = bowler === name;
                    return (
                      <button
                        key={name}
                        onClick={() => setBowler((cur) => (cur === name ? null : name))}
                        className="flex items-center gap-2.5 rounded-full pl-2 pr-3.5 py-1.5 text-left transition-all"
                        style={{ border: `1px solid ${isBowler ? ORANGE_SOFT : "rgba(255,255,255,0.1)"}`, background: isBowler ? ORANGE_FAINT : "rgba(255,255,255,0.02)" }}
                      >
                        <span
                          className="h-7 w-7 rounded-full flex items-center justify-center font-mono-geist text-[10px] font-bold shrink-0"
                          style={{ border: `1px solid ${isBowler ? ORANGE_SOFT : "rgba(255,255,255,0.15)"}`, color: isBowler ? ORANGE : "#e5e7eb" }}
                        >
                          {initials(name)}
                        </span>
                        <span className="font-archivo text-sm text-white/80 truncate">{name}</span>
                      </button>
                    );
                  })}
                </div>

                <Eyebrow>This Ball</Eyebrow>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3 -mt-1">
                  <button
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className="flex items-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] px-4 py-2 rounded transition-all hover:brightness-110 active:scale-95 disabled:opacity-30"
                    style={{ background: ORANGE_FAINT, border: `1px solid ${ORANGE_SOFT}`, color: ORANGE }}
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Undo
                  </button>

                  <button onClick={() => setFreeHit((v) => !v)} className="flex items-center gap-2.5">
                    <span className="relative h-5 w-9 rounded-full transition-colors" style={{ background: freeHit ? ORANGE : "rgba(255,255,255,0.15)" }}>
                      <span className="absolute top-0.5 h-4 w-4 rounded-full bg-black transition-all" style={{ left: freeHit ? "18px" : "2px" }} />
                    </span>
                    <span className="text-left leading-tight">
                      <span className="block font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em]">Free Hit</span>
                      <span className="block font-mono-geist text-[9px] text-white/40 uppercase">{freeHit ? "On" : "Off"}</span>
                    </span>
                  </button>
                </div>

                <Eyebrow>Extra</Eyebrow>
                <div className="flex items-center gap-2 mb-4 flex-wrap -mt-1">
                  <span className="w-10 h-7 rounded" style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                  {extraOptions.map((label) => {
                    const key = extraKeyFor(label);
                    const active = extraMode === key;
                    return (
                      <button
                        key={label}
                        onClick={() => setExtraMode(active ? null : key)}
                        className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-3.5 py-1.5 rounded transition-all"
                        style={{ border: `1px solid ${active ? ORANGE_SOFT : "rgba(255,255,255,0.1)"}`, background: active ? ORANGE_FAINT : "rgba(255,255,255,0.02)", color: active ? ORANGE : "rgba(255,255,255,0.5)" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-2">
                  {[0, 1, 2, 3, 4, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleRun(n)}
                      className="rounded-xl py-4 font-archivo text-xl font-bold transition-all hover:brightness-110 active:scale-95"
                      style={
                        n === 4 || n === 6
                          ? { background: GOLD_GRADIENT, color: "#1a1304" }
                          : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }
                      }
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={handleOut}
                    className="rounded-xl py-4 font-mono-geist text-sm font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95"
                    style={{ background: RED_FAINT, border: `1px solid ${RED_SOFT}`, color: RED }}
                  >
                    Out
                  </button>
                </div>
                <p className="font-mono-geist text-[10px] text-white/30 uppercase tracking-[0.05em] mb-6 leading-relaxed">
                  Pick an extra type first if this ball is a wide / no ball / bye / leg bye. Fours, sixes, and fifty/hundred milestones fire automatically.
                </p>

                {/* stat strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Partnership", value: `${partnership.runs} (${partnership.balls})` },
                    { label: "Match 4s / 6s", value: `${boundaryCount.fours} / ${boundaryCount.sixes}` },
                    { label: "Tourn. 4s / 6s", value: `${boundaryCount.fours} / ${boundaryCount.sixes}` },
                    { label: "Bowler Figures", value: `${bowlerFigures.overs}.${bowlerFigures.balls}-${bowlerFigures.runs}-${bowlerFigures.wkts}-0` },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl px-4 py-3 glass-panel">
                      <p className="font-mono-geist text-[9px] text-white/40 uppercase tracking-[0.16em] font-bold mb-1">{s.label}</p>
                      <p className="font-archivo text-lg font-bold tabular-nums">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════ RIGHT / SIDEBAR ══════════════ */}
        <div className="space-y-6">
          <GlassCard>
            <h3 className="font-archivo text-lg font-bold italic uppercase mb-1">Program Monitor</h3>
            <p className="font-mono-geist text-[10px] text-white/40 uppercase tracking-[0.1em] mb-4">OBS browser source · 1920×1080 · transparent background</p>
            <div className="relative aspect-video rounded-lg mb-3 overflow-hidden" style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ background: ORANGE_FAINT, border: `1px solid ${ORANGE_SOFT}` }} />
                <span className="h-1.5 w-10 rounded-full bg-white/10" />
              </div>
              <span className="absolute top-2 right-2 h-3 w-3 rounded-sm bg-white/10" />
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <span className="h-2 w-2 rounded-full" style={{ background: ORANGE }} />
                <span className="h-1 flex-1 mx-2 rounded-full bg-white/10" />
                <span className="h-2 w-2 rounded-full" style={{ background: ORANGE }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 font-mono-geist text-[10px] text-white/40 px-3 py-2 rounded truncate" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                http://localhost:3000/overlay/9540c…
              </div>
              <button
                className="shrink-0 flex items-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-2 rounded transition-all hover:brightness-110 active:scale-95"
                style={{ background: ORANGE_FAINT, border: `1px solid ${ORANGE_SOFT}`, color: ORANGE }}
              >
                <Copy className="h-3 w-3" /> Copy URL
              </button>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="font-archivo text-lg font-bold italic uppercase mb-1">Moments</h3>
            <p className="font-mono-geist text-[10px] text-white/40 uppercase tracking-[0.1em] mb-4">Fire the graphic the instant it happens on the ball.</p>
            <button
              className="w-full flex items-center justify-between font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-4 py-3 rounded text-white/70"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Show Moments Controls
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </GlassCard>

          <GlassCard>
            <h3 className="font-archivo text-lg font-bold italic uppercase mb-1">Weather</h3>
            <p className="font-mono-geist text-[10px] text-white/40 uppercase tracking-[0.1em] mb-4 leading-relaxed">
              Search the nearest resolvable location — the overlay always shows the Venue name from Match Setup.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-lg px-4 py-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <p className="font-archivo text-sm font-bold">Galle Fort — 28°C, partly-cloudy</p>
                <p className="font-mono-geist text-[9px] text-white/30 uppercase tracking-[0.14em] mt-0.5">Auto-refreshes every 5 min</p>
              </div>
              <button className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center" style={{ border: `1px solid ${ORANGE_SOFT}` }}>
                <Pencil className="h-3 w-3" style={{ color: ORANGE }} />
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}