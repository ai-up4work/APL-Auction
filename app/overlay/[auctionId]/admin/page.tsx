// app/overlay/[auctionId]/admin/page.tsx
"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent } from "@/lib/overlayBus";

export default function OverlayAdminPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);

  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // ── cricket-match overlay toggle state — tracks on/off for each overlay
  // so the buttons below can reflect current state and Clear Everything
  // can reset them all in one shot. ──
  const [weatherOn, setWeatherOn] = useState(false);
  const [matchBoundariesOn, setMatchBoundariesOn] = useState(false);
  const [tournamentBoundariesOn, setTournamentBoundariesOn] = useState(false);
  const [liveScoreBarOn, setLiveScoreBarOn] = useState(false);
  const [pointsTableOn, setPointsTableOn] = useState(false);
  const [matchScorecardOn, setMatchScorecardOn] = useState(false);
  const [matchIntroOn, setMatchIntroOn] = useState(false);
  const [tournamentLogoOn, setTournamentLogoOn] = useState(false);

  const overlayUrl = typeof window !== "undefined" ? `${window.location.origin}/overlay/${auctionId}` : "";

  useEffect(() => {
    const bus = connectOverlayBus(auctionId);
    busRef.current = bus;
    bus.onReady(() => setConnected(true));
    return () => {
      bus.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  function fire(event: OverlayEvent, label: string) {
    busRef.current?.send(event);
    setLog((prev) => [`${new Date().toLocaleTimeString("en-GB", { hour12: false })}  ${label}`, ...prev].slice(0, 12));
  }

  function copyUrl() {
    navigator.clipboard?.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: "var(--color-background, #0d1117)", color: "var(--color-on-background, #fff)", fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }
        .panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
        .fx-btn {
          font-family: 'Geist Mono', monospace; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.14em; padding: 12px 14px;
          border-radius: 10px; transition: all 0.15s ease; border: 1px solid rgba(255,255,255,0.08);
        }
        .fx-btn:active { transform: scale(0.97); }
        .fx-toggle-on { background: linear-gradient(135deg,#A87815,#E8C468); color: #1a1304; border: none; }
        .fx-toggle-off { background: rgba(255,255,255,0.05); color: #a0aec0; }
      `}</style>

      <header className="flex items-center justify-between px-8 h-16 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-theme-orange" style={{ fontSize: 22 }}>stream</span>
          <h1 className="font-archivo text-xl font-bold italic uppercase tracking-tight text-theme-orange">Overlay Control Room</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? "#22c55e" : "#eab308" }} />
          <span className="font-mono-geist text-[10px] uppercase tracking-widest text-white/60">{connected ? "Bus connected" : "Connecting…"}</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-8 flex flex-col gap-6">

        <div className="panel p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono-geist text-[9px] uppercase tracking-[0.2em] text-white/50 mb-1">OBS Browser Source URL</div>
            <code className="font-mono-geist text-xs text-theme-orange break-all">{overlayUrl || "…"}</code>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest">1920×1080 · transparent bg on</span>
            <button onClick={copyUrl} className="fx-btn fx-toggle-on">{copied ? "Copied ✓" : "Copy URL"}</button>
          </div>
        </div>

        {/* ── Cricket match overlays — one toggle button per overlay ────── */}
        <div className="panel p-5 flex flex-col gap-3">
          <h3 className="font-mono-geist text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1">Cricket Match Overlays</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => {
                const next = !weatherOn;
                setWeatherOn(next);
                fire({ type: "weather", show: next }, `Weather ${next ? "on" : "off"}`);
              }}
              className={`fx-btn ${weatherOn ? "fx-toggle-on" : "fx-toggle-off"}`}
            >
              Weather
            </button>

            <button
              onClick={() => {
                const next = !matchBoundariesOn;
                setMatchBoundariesOn(next);
                if (next) setTournamentBoundariesOn(false);
                fire({ type: "matchBoundaries", show: next }, `Match boundaries ${next ? "on" : "off"}`);
              }}
              className={`fx-btn ${matchBoundariesOn ? "fx-toggle-on" : "fx-toggle-off"}`}
            >
              Match Boundaries
            </button>

            <button
              onClick={() => {
                const next = !tournamentBoundariesOn;
                setTournamentBoundariesOn(next);
                if (next) setMatchBoundariesOn(false);
                fire({ type: "tournamentBoundaries", show: next }, `Tournament boundaries ${next ? "on" : "off"}`);
              }}
              className={`fx-btn ${tournamentBoundariesOn ? "fx-toggle-on" : "fx-toggle-off"}`}
            >
              Tournament Boundaries
            </button>

            <button
              onClick={() => {
                const next = !liveScoreBarOn;
                setLiveScoreBarOn(next);
                fire({ type: "liveScoreBar", show: next }, `Live score bar ${next ? "on" : "off"}`);
              }}
              className={`fx-btn ${liveScoreBarOn ? "fx-toggle-on" : "fx-toggle-off"}`}
            >
              Live Score Bar
            </button>

            <button
              onClick={() => {
                const next = !pointsTableOn;
                setPointsTableOn(next);
                fire({ type: "pointsTable", show: next }, `Points table ${next ? "on" : "off"}`);
              }}
              className={`fx-btn ${pointsTableOn ? "fx-toggle-on" : "fx-toggle-off"}`}
            >
              Points Table
            </button>

            <button
              onClick={() => {
                const next = !matchScorecardOn;
                setMatchScorecardOn(next);
                fire({ type: "matchScorecard", show: next }, `Match scorecard ${next ? "on" : "off"}`);
              }}
              className={`fx-btn ${matchScorecardOn ? "fx-toggle-on" : "fx-toggle-off"}`}
            >
              Match Scorecard
            </button>

            <button
              onClick={() => {
                const next = !matchIntroOn;
                setMatchIntroOn(next);
                fire({ type: "matchIntro", show: next }, `Match intro ${next ? "on" : "off"}`);
              }}
              className={`fx-btn ${matchIntroOn ? "fx-toggle-on" : "fx-toggle-off"}`}
            >
              Match Intro
            </button>

            <button
              onClick={() => {
                const next = !tournamentLogoOn;
                setTournamentLogoOn(next);
                fire({ type: "tournamentLogo", show: next }, `Tournament logo ${next ? "on" : "off"}`);
              }}
              className={`fx-btn ${tournamentLogoOn ? "fx-toggle-on" : "fx-toggle-off"}`}
            >
              Tournament Logo
            </button>

            <button
              onClick={() => {
                setWeatherOn(false);
                setMatchBoundariesOn(false);
                setTournamentBoundariesOn(false);
                setLiveScoreBarOn(false);
                setPointsTableOn(false);
                setMatchScorecardOn(false);
                setMatchIntroOn(false);
                setTournamentLogoOn(false);
                fire({ type: "clearAll" }, "Cleared all overlays");
              }}
              className="fx-btn"
              style={{ background: "rgba(239,68,68,0.10)", color: "#f87171", borderColor: "rgba(239,68,68,0.25)" }}
            >
              Clear Everything
            </button>
          </div>

          <h4 className="font-mono-geist text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold mt-2 mb-1">Moments (auto-hide)</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(["four", "six", "wicket", "fifty", "hundred"] as const).map((m) => (
              <button
                key={m}
                onClick={() => fire({ type: "moment", moment: m }, `Moment: ${m.toUpperCase()}`)}
                className="fx-btn"
                style={{ background: "rgba(201,151,31,0.14)", color: "#E8C468", borderColor: "rgba(201,151,31,0.3)" }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <p className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest mt-1">
            Milestone and wicket graphics auto-hide after a few seconds — no need to turn them off.
          </p>
        </div>

        <div className="panel p-5">
          <h3 className="font-mono-geist text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-3">Recent triggers</h3>
          {log.length === 0 ? (
            <p className="font-mono-geist text-[11px] text-white/30">Nothing fired yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {log.map((l, i) => <div key={i} className="font-mono-geist text-[11px] text-white/50">{l}</div>)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}