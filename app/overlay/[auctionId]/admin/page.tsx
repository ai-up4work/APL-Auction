// app/overlay/[auctionId]/admin/page.tsx
"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent } from "@/lib/overlayBus";

interface OverlayToggle {
  key: string;
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  event: OverlayEvent["type"];
  exclusiveWith?: string;
}

export default function OverlayAdminPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);

  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [weatherOn, setWeatherOn] = useState(false);
  const [matchBoundariesOn, setMatchBoundariesOn] = useState(false);
  const [tournamentBoundariesOn, setTournamentBoundariesOn] = useState(false);
  const [liveScoreBarOn, setLiveScoreBarOn] = useState(false);
  const [pointsTableOn, setPointsTableOn] = useState(false);
  const [matchScorecardOn, setMatchScorecardOn] = useState(false);
  const [matchIntroOn, setMatchIntroOn] = useState(false);
  const [tournamentLogoOn, setTournamentLogoOn] = useState(false);
  const [testBgOn, setTestBgOn] = useState(false);

  // ── Preview scaling ────────────────────────────────────────────────
  // Measure the actual clipping box (.monitor-screen), not its padded
  // parent, and fit the 1920x1080 iframe into it on BOTH axes so it can
  // never overflow the box regardless of the box's real aspect ratio.
  const monitorScreenRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const el = monitorScreenRef.current;
      if (!el) return;
      const scaleX = el.clientWidth / 1920;
      const scaleY = el.clientHeight / 1080;
      setPreviewScale(Math.min(scaleX, scaleY));
    }

    updateScale();

    const ro = new ResizeObserver(updateScale);
    if (monitorScreenRef.current) ro.observe(monitorScreenRef.current);

    window.addEventListener("resize", updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

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

  const channels: OverlayToggle[] = [
    { key: "weather", label: "Weather", on: weatherOn, set: setWeatherOn, event: "weather" },
    { key: "matchBoundaries", label: "Match Boundaries", on: matchBoundariesOn, set: setMatchBoundariesOn, event: "matchBoundaries" },
    { key: "tournamentBoundaries", label: "Tournament Boundaries", on: tournamentBoundariesOn, set: setTournamentBoundariesOn, event: "tournamentBoundaries" },
    { key: "liveScoreBar", label: "Live Score Bar", on: liveScoreBarOn, set: setLiveScoreBarOn, event: "liveScoreBar" },
    { key: "pointsTable", label: "Points Table", on: pointsTableOn, set: setPointsTableOn, event: "pointsTable" },
    { key: "matchScorecard", label: "Match Scorecard", on: matchScorecardOn, set: setMatchScorecardOn, event: "matchScorecard" },
    { key: "matchIntro", label: "Match Intro", on: matchIntroOn, set: setMatchIntroOn, event: "matchIntro" },
    { key: "tournamentLogo", label: "Tournament Logo", on: tournamentLogoOn, set: setTournamentLogoOn, event: "tournamentLogo" },
  ];

  function toggleChannel(ch: OverlayToggle) {
    const next = !ch.on;
    ch.set(next);
    if (ch.key === "matchBoundaries" && next) setTournamentBoundariesOn(false);
    if (ch.key === "tournamentBoundaries" && next) setMatchBoundariesOn(false);
    fire({ type: ch.event, show: next } as OverlayEvent, `${ch.label} ${next ? "on" : "off"}`);
  }

  return (
    <div
      className="console-frame min-h-screen w-full flex flex-col"
      style={{ background: "var(--color-background, #0d1117)", color: "var(--color-on-background, #fff)", fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');

        .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }

        /* ── Console frame — faint vignette + hairline grid texture, so the
           whole page reads as a dim gallery/control-room, not a flat
           dashboard. Very subtle; restraint over decoration. ─────────── */
        .console-frame {
          background-image:
            radial-gradient(ellipse 120% 60% at 50% -10%, rgba(201,151,31,0.06), transparent 60%),
            var(--color-background, #0d1117);
        }

        /* ── Rack panel — brushed-metal top highlight + four corner rivets,
           standing in for the screws on a physical rack-mounted unit. This
           is the page's one recurring skeuomorphic motif. ──────────────── */
        .rack-panel {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015) 40%, rgba(255,255,255,0.02));
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.1));
          border-radius: 14px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.4);
        }
        .rack-panel::before, .rack-panel::after,
        .rack-panel .rivet-l, .rack-panel .rivet-r {
          content: "";
          position: absolute;
          width: 5px; height: 5px;
          border-radius: 50%;
          top: 9px;
          background: radial-gradient(circle at 35% 30%, #9a9fae, #3a3f4d 70%);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.05);
        }
        .rack-panel::before { left: 9px; }
        .rack-panel::after  { right: 9px; }

        .eyebrow {
          font-family: 'Geist Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-outline, #8c92a3);
        }

        /* ── Tally lamp — the signature element. Dim steel when off; glows
           broadcast-red when live, exactly like a studio gallery's on-air
           indicator. ──────────────────────────────────────────────────── */
        .tally {
          width: 8px; height: 8px; border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #4a4f5e, #23262f 70%);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.5);
          transition: background 0.2s ease, box-shadow 0.2s ease;
          flex-shrink: 0;
        }
        .tally.live {
          background: radial-gradient(circle at 35% 30%, #ff9d92, var(--color-status-live, #ffb4ab) 60%);
          box-shadow: 0 0 6px 1px var(--color-status-live, #ffb4ab), inset 0 0 0 1px rgba(0,0,0,0.2);
        }

        /* ── Channel strip — replaces the plain toggle button. Tally lamp +
           label + micro state readout, like a switcher's input strip. ─── */
        .strip-btn {
          position: relative;
          display: flex; flex-direction: column; gap: 8px;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.1));
          background: rgba(255,255,255,0.02);
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
          text-align: left;
        }
        .strip-btn:active { transform: scale(0.98); }
        .strip-btn.is-live {
          border-color: rgba(201,151,31,0.45);
          background: linear-gradient(180deg, rgba(201,151,31,0.1), rgba(201,151,31,0.03));
        }
        .strip-label {
          font-family: 'Geist Mono', monospace;
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-on-surface, #e3e6ef);
        }
        .strip-state {
          font-family: 'Geist Mono', monospace;
          font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--color-outline, #8c92a3);
        }
        .strip-btn.is-live .strip-state { color: var(--color-status-live, #ffb4ab); }

        .talk-btn {
          font-family: 'Geist Mono', monospace; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.14em; padding: 12px 14px;
          border-radius: 10px; transition: all 0.15s ease;
          background: rgba(201,151,31,0.1); color: #E8C468;
          border: 1px solid rgba(201,151,31,0.25);
        }
        .talk-btn:active { transform: scale(0.96); }

        .fx-btn {
          font-family: 'Geist Mono', monospace; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.14em; padding: 12px 14px;
          border-radius: 10px; transition: all 0.15s ease; border: 1px solid rgba(255,255,255,0.08);
        }
        .fx-btn:active { transform: scale(0.97); }
        .fx-toggle-on { background: linear-gradient(135deg,#A87815,#E8C468); color: #1a1304; border: none; }
        .fx-toggle-off { background: rgba(255,255,255,0.05); color: #a0aec0; }

        /* ── Program monitor bezel — corner brackets like a broadcast
           preview/program monitor, with a rec-tally + PGM plate. ───────── */
        .monitor-frame {
          position: relative;
          padding: 10px;
          border-radius: 14px;
          background: linear-gradient(155deg, var(--color-surface-container-high, #1f2433), var(--color-surface-container-lowest, #07090d));
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.1));
        }
        .monitor-screen {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          background: #000;
          aspect-ratio: 16 / 9;
          /* Centers the scaled iframe inside the box so if the box's real
             aspect ratio ever drifts from 16:9, the content stays centered
             with letterboxing rather than pinned/clipped to one corner. */
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .monitor-corner {
          position: absolute;
          width: 18px; height: 18px;
          border-color: rgba(201,151,31,0.55);
          z-index: 2; pointer-events: none;
        }
        .monitor-corner.tl { top: 6px; left: 6px; border-top: 2px solid; border-left: 2px solid; border-top-left-radius: 4px; }
        .monitor-corner.tr { top: 6px; right: 6px; border-top: 2px solid; border-right: 2px solid; border-top-right-radius: 4px; }
        .monitor-corner.bl { bottom: 6px; left: 6px; border-bottom: 2px solid; border-left: 2px solid; border-bottom-left-radius: 4px; }
        .monitor-corner.br { bottom: 6px; right: 6px; border-bottom: 2px solid; border-right: 2px solid; border-bottom-right-radius: 4px; }
        .pgm-plate {
          position: absolute; top: 14px; left: 14px; z-index: 2;
          display: flex; align-items: center; gap: 6px;
          padding: 4px 8px; border-radius: 5px;
          background: rgba(7,9,13,0.75); backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.1);
        }

        /* ── Themed scrollbar for the event log ─────────────────────────── */
        .log-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--color-theme-orange) var(--color-surface-container-high);
          overflow-y: scroll;
        }
        .log-scroll::-webkit-scrollbar { width: 8px; }
        .log-scroll::-webkit-scrollbar-track { background: var(--color-surface-container-high, #1f2433); border-radius: 8px; }
        .log-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--color-theme-orange) 55%, transparent); border-radius: 8px; }
        .log-scroll::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--color-theme-orange) 75%, transparent); }

        @keyframes connPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

      <header className="flex items-center justify-between px-8 h-16 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-theme-orange" style={{ fontSize: 22 }}>stream</span>
          <h1 className="font-archivo text-xl font-bold italic uppercase tracking-tight text-theme-orange">Overlay Control Room</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="tally"
            style={{
              background: connected
                ? "radial-gradient(circle at 35% 30%, #7ee8a8, var(--color-success-green, #4caf50) 60%)"
                : undefined,
              boxShadow: connected ? "0 0 6px 1px var(--color-success-green, #4caf50)" : undefined,
              animation: connected ? undefined : "connPulse 1.4s ease-in-out infinite",
            }}
          />
          <span className="font-mono-geist text-[10px] uppercase tracking-widest text-white/60">
            {connected ? "Bus connected" : "Connecting…"}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-8 flex flex-col gap-6">

        {/* ── Source plate ─────────────────────────────────────────────── */}
        <div className="rack-panel p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow mb-1.5">OBS Browser Source</div>
            <code className="font-mono-geist text-xs text-theme-orange break-all">{overlayUrl || "…"}</code>
          </div>
          <div className="flex items-center gap-3">
            <span className="eyebrow">1920×1080 · transparent bg</span>
            <button onClick={copyUrl} className="talk-btn">{copied ? "Copied ✓" : "Copy URL"}</button>
          </div>
        </div>

        {/* ── Program monitor ──────────────────────────────────────────── */}
        <div className="rack-panel p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Program Monitor</div>
            <span className="eyebrow">scaled preview</span>
          </div>
          <div className="monitor-frame">
            <div className="monitor-screen" ref={monitorScreenRef}>
              <div className="monitor-corner tl" />
              <div className="monitor-corner tr" />
              <div className="monitor-corner bl" />
              <div className="monitor-corner br" />
              {/* <div className="pgm-plate">
                <span className="tally live" style={{ animation: "connPulse 1.8s ease-in-out infinite" }} />
                <span className="font-mono-geist text-[9px] font-bold tracking-[0.2em] text-white/80">PGM OUT</span>
              </div> */}
              {overlayUrl && (
                  <iframe
                    src={overlayUrl}
                    title="Overlay preview"
                    style={{
                      width: "1920px",
                      height: "1080px",
                      border: "none",
                      transform: `scale(${previewScale})`,
                      transformOrigin: "center center",
                      flexShrink: 0,
                    }}
                  />
                )}
            </div>
          </div>
        </div>

        {/* ── Preview tools ─────────────────────────────────────────────── */}
        <div className="rack-panel p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow mb-1.5" style={{ color: "var(--color-secondary, #c8cdd8)" }}>Preview Tools</div>
            <p className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest">
              Sample footage behind overlays — layout testing only, off before going live
            </p>
          </div>
          <button
            onClick={() => {
              const next = !testBgOn;
              setTestBgOn(next);
              fire({ type: "testBg", show: next }, `Test background ${next ? "on" : "off"}`);
            }}
            className="strip-btn"
            style={{ minWidth: 140 }}
          >
            <span className="flex items-center gap-2">
              <span className={`tally ${testBgOn ? "live" : ""}`} style={testBgOn ? { background: "radial-gradient(circle at 35% 30%, #93c5fd, #3b82f6 60%)", boxShadow: "0 0 6px 1px #3b82f6" } : undefined} />
              <span className="strip-label">Test Background</span>
            </span>
            <span className="strip-state" style={testBgOn ? { color: "#93c5fd" } : undefined}>{testBgOn ? "Live" : "Off"}</span>
          </button>
        </div>

        {/* ── Channel strips ───────────────────────────────────────────── */}
        <div className="rack-panel p-5 flex flex-col gap-3">
          <div className="eyebrow mb-1">Cricket Match Overlays</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {channels.map((ch) => (
              <button key={ch.key} onClick={() => toggleChannel(ch)} className={`strip-btn ${ch.on ? "is-live" : ""}`}>
                <span className="flex items-center gap-2">
                  <span className={`tally ${ch.on ? "live" : ""}`} />
                  <span className="strip-label">{ch.label}</span>
                </span>
                <span className="strip-state">{ch.on ? "On Air" : "Standby"}</span>
              </button>
            ))}

            <button
              onClick={() => {
                channels.forEach((ch) => ch.set(false));
                fire({ type: "clearAll" }, "Cleared all overlays");
              }}
              className="strip-btn"
              style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}
            >
              <span className="flex items-center gap-2">
                <span className="tally" style={{ background: "radial-gradient(circle at 35% 30%, #ff9d9d, #ef4444 60%)" }} />
                <span className="strip-label" style={{ color: "#f87171" }}>Clear Everything</span>
              </span>
              <span className="strip-state" style={{ color: "#f87171" }}>Reset all</span>
            </button>
          </div>

          <div className="eyebrow mt-3 mb-1">Moments (auto-hide)</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(["four", "six", "wicket", "fifty", "hundred"] as const).map((m) => (
              <button key={m} onClick={() => fire({ type: "moment", moment: m }, `Moment: ${m.toUpperCase()}`)} className="talk-btn">
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <p className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest mt-1">
            Milestone and wicket graphics auto-hide after a few seconds — no need to turn them off.
          </p>
        </div>

        {/* ── Event log ─────────────────────────────────────────────────── */}
        <div className="rack-panel p-5">
          <div className="eyebrow mb-3">Event Log</div>
          <div className="log-scroll space-y-1.5 h-40 pr-1">
            {log.length === 0 ? (
              <p className="font-mono-geist text-[11px] text-white/30">Nothing fired yet.</p>
            ) : (
              log.map((l, i) => <div key={i} className="font-mono-geist text-[11px] text-white/50">{l}</div>)
            )}
          </div>
        </div>
      </main>
    </div>
  );
}