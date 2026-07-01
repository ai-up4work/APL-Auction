// app/overlay/[auctionId]/page.tsx
"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent, type StampState, type SoldBoardEntry } from "@/lib/overlayBus";

type Particle = { id: number; tx: number; ty: number; color: string; duration: number };
type TickerItem = { id: number; message: string };

let idCtr = 0;
const nextId = () => idCtr++;

const GOLD_COLORS  = ["#E8C468", "#A87815", "#FDECC8", "#ffffff", "#c9971f"];
const GRAY_COLORS  = ["#718096", "#A0AEC0", "#CBD5E0", "#E2E8F0"];

export default function OverlayPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);

  // ── FX state ───────────────────────────────────────────────────────────
  const [stamp, setStamp]           = useState<{ state: StampState; key: number } | null>(null);
  const [particles, setParticles]   = useState<Particle[]>([]);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [lowerThird, setLowerThird] = useState<{ show: boolean; tag?: string; title?: string; subtitle?: string }>({ show: false });
  const [scoreboard, setScoreboard] = useState<{ show: boolean; label?: string; value?: string; sub?: string }>({ show: false });
  const [tickerQueue, setTickerQueue] = useState<TickerItem[]>([]);
  const [replayOn, setReplayOn]     = useState(false);
  const [soldBoard, setSoldBoard]   = useState<{ show: boolean; entries: SoldBoardEntry[] }>({ show: false, entries: [] });
  const [connected, setConnected]   = useState(false);

  const stampTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function spawnParticles(colors: string[], count = 60) {
    const created: Particle[] = Array.from({ length: count }, () => ({
      id: nextId(),
      tx: (Math.random() - 0.5) * 1200,
      ty: (Math.random() - 0.5) * 800 - 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 1.2 + Math.random() * 1.6,
    }));
    setParticles((prev) => [...prev, ...created]);
    created.forEach((p) => {
      setTimeout(() => setParticles((prev) => prev.filter((x) => x.id !== p.id)), p.duration * 1000);
    });
  }

  function handleEvent(evt: OverlayEvent) {
    switch (evt.type) {
      case "stamp": {
        if (stampTimeout.current) clearTimeout(stampTimeout.current);
        setStamp({ state: evt.state, key: nextId() });
        spawnParticles(evt.state === "sold" ? GOLD_COLORS : GRAY_COLORS, evt.state === "sold" ? 70 : 40);
        stampTimeout.current = setTimeout(() => setStamp(null), 3200);
        break;
      }
      case "confetti":
        spawnParticles(evt.colors && evt.colors.length ? evt.colors : GOLD_COLORS, 80);
        break;
      case "flash": {
        setFlashColor(evt.color ?? "rgba(201,151,31,0.16)");
        setTimeout(() => setFlashColor(null), 180);
        break;
      }
      case "lowerThird":
        setLowerThird({ show: evt.show, tag: evt.tag, title: evt.title, subtitle: evt.subtitle });
        break;
      case "scoreboard":
        setScoreboard({ show: evt.show, label: evt.label, value: evt.value, sub: evt.sub });
        break;
      case "ticker": {
        const item = { id: nextId(), message: evt.message };
        setTickerQueue((prev) => [...prev.slice(-7), item]);
        break;
      }
      case "replayBadge":
        setReplayOn(evt.show);
        break;
      case "soldBoard": {
        setSoldBoard((prev) => {
          if (evt.clear) return { show: evt.show, entries: [] };
          if (evt.entry) return { show: evt.show, entries: [evt.entry, ...prev.entries].slice(0, 5) };
          return { show: evt.show, entries: prev.entries };
        });
        break;
      }
      case "clearAll":
        setStamp(null);
        setParticles([]);
        setFlashColor(null);
        setLowerThird({ show: false });
        setScoreboard({ show: false });
        setTickerQueue([]);
        setReplayOn(false);
        setSoldBoard({ show: false, entries: [] });
        break;
    }
  }

  useEffect(() => {
    const bus = connectOverlayBus(auctionId, handleEvent);
    setConnected(true);
    return () => {
      bus.disconnect();
      if (stampTimeout.current) clearTimeout(stampTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Geist+Mono:wght@400;500;700&display=swap');

        /* Fully transparent canvas — OBS Browser Source composites this
           directly on top of your camera source. Do NOT put a background
           color on <html>/<body> anywhere in global CSS for this route. */
        html, body { background: transparent !important; }

        .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }

        .fx-particle {
          position: fixed; pointer-events: none; z-index: 500;
          border-radius: 50%; width: 9px; height: 9px;
          animation-name: fx-particle-fly;
          animation-timing-function: cubic-bezier(0.1,0.8,0.3,1);
          animation-fill-mode: forwards;
        }
        @keyframes fx-particle-fly {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }

        .fx-stamp { animation: fx-stamp-land 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes fx-stamp-land {
          0%   { opacity: 0; transform: scale(2.4) rotate(var(--rot)); filter: blur(16px); }
          55%  { opacity: 1; filter: blur(0); }
          70%  { transform: scale(0.96) rotate(var(--rot)); }
          85%  { transform: scale(1.03) rotate(var(--rot)); }
          100% { transform: scale(1) rotate(var(--rot)); }
        }

        .fx-lower-third { animation: fx-slide-up 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes fx-slide-up {
          0%   { transform: translateY(40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        .fx-scoreboard { animation: fx-slide-left 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes fx-slide-left {
          0%   { transform: translateX(40px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }

        .fx-ticker-in { animation: fx-ticker-pop 0.35s ease-out both; }
        @keyframes fx-ticker-pop {
          0%   { transform: translateX(-16px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }

        .fx-sold-row { animation: fx-sold-row-in 0.35s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes fx-sold-row-in {
          0%   { transform: translateX(-24px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }

        @keyframes fx-dot-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .fx-dot { animation: fx-dot-pulse 1.3s ease-in-out infinite; }

        @keyframes fx-replay-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .fx-replay { animation: fx-replay-blink 1s ease-in-out infinite; }
      `}</style>

      {/* Root: fully transparent, fills the OBS canvas, nothing interactive */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">

        {/* Connection dot — tiny, corner, so you can confirm the bus is live
            while framing the source in OBS. Remove/hide once confirmed. */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 opacity-60">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: connected ? "#22c55e" : "#ef4444" }}
          />
          <span className="font-mono-geist text-[8px] text-white/70 uppercase tracking-widest">
            fx-bus {connected ? "live" : "off"}
          </span>
        </div>

        {/* Flash */}
        {flashColor && (
          <div className="absolute inset-0" style={{ background: flashColor }} />
        )}

        {/* Confetti / particles */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="fx-particle"
            style={{
              left: "50%",
              top: "45%",
              backgroundColor: p.color,
              boxShadow: `0 0 6px ${p.color}`,
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              animationDuration: `${p.duration}s`,
            } as React.CSSProperties}
          />
        ))}

        {/* SOLD / UNSOLD stamp */}
        {stamp && (
          <div
            key={stamp.key}
            className="fx-stamp absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ "--rot": stamp.state === "sold" ? "-11deg" : "11deg" } as React.CSSProperties}
          >
            <div
              className="relative px-14 py-6 rounded-md overflow-hidden"
              style={{
                border: `4px solid ${stamp.state === "sold" ? "#A87815" : "#718096"}`,
                background: stamp.state === "sold" ? "rgba(201,151,31,0.10)" : "rgba(74,85,104,0.12)",
                boxShadow: `0 0 60px ${stamp.state === "sold" ? "rgba(201,151,31,0.35)" : "rgba(113,128,150,0.25)"}`,
              }}
            >
              <span
                className="font-archivo block text-center italic font-bold uppercase tracking-[0.1em]"
                style={{
                  fontSize: stamp.state === "sold" ? 84 : 64,
                  color: stamp.state === "sold" ? "#E8C468" : "#A0AEC0",
                  textShadow: stamp.state === "sold" ? "0 0 50px rgba(232,196,104,0.4)" : "none",
                }}
              >
                {stamp.state === "sold" ? "SOLD!" : "UNSOLD"}
              </span>
            </div>
          </div>
        )}

        {/* Replay badge */}
        {replayOn && (
          <div className="fx-replay absolute top-3 right-3 flex items-center gap-2 px-4 py-1.5 rounded-full"
            style={{ background: "rgba(239,68,68,0.16)", border: "1px solid rgba(239,68,68,0.5)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: "0 0 6px #ef4444" }} />
            <span className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.24em] text-red-400">Replay</span>
          </div>
        )}

        {/* Scoreboard — top-right mini panel (shifts down if replay badge showing) */}
        {scoreboard.show && (
          <div className="fx-scoreboard absolute right-3" style={{ top: replayOn ? 52 : 12 }}>
            <div
              className="px-6 py-3 rounded-xl min-w-[220px]"
              style={{ background: "rgba(13,17,23,0.90)", border: "1px solid rgba(201,151,31,0.30)", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}
            >
              <div className="font-mono-geist text-[8px] uppercase tracking-[0.22em] text-theme-orange font-bold mb-1">
                {scoreboard.label ?? "Score"}
              </div>
              <div className="font-archivo text-3xl font-bold text-white leading-none">
                {scoreboard.value ?? "—"}
              </div>
              {scoreboard.sub && (
                <div className="font-mono-geist text-[9px] text-white/50 uppercase tracking-[0.1em] mt-1">
                  {scoreboard.sub}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sold board — running mini scorecard of recent purchases, upper-left below the connection dot */}
        {soldBoard.show && soldBoard.entries.length > 0 && (
          <div className="absolute top-10 left-3 w-[260px]">
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "rgba(13,17,23,0.90)", border: "1px solid rgba(201,151,31,0.30)", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}
            >
              <div
                className="px-4 py-2 font-mono-geist text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{ background: "linear-gradient(90deg,#A87815,#E8C468)", color: "#1a1304" }}
              >
                Recently Sold
              </div>
              <div className="flex flex-col">
                {soldBoard.entries.map((e, i) => (
                  <div
                    key={e.id}
                    className="fx-sold-row flex items-center justify-between px-4 py-2"
                    style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex flex-col">
                      <span className="font-archivo text-sm font-bold text-white leading-tight">{e.player}</span>
                      <span className="font-mono-geist text-[9px] text-white/50 uppercase tracking-wide">{e.team}</span>
                    </div>
                    <span className="font-mono-geist text-xs font-bold" style={{ color: "#E8C468" }}>{e.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Lower third */}
        {lowerThird.show && (
          <div className="fx-lower-third absolute left-8 bottom-16">
            <div
              className="flex items-stretch rounded-xl overflow-hidden"
              style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.55)" }}
            >
              <div className="w-1.5" style={{ background: "linear-gradient(180deg,#A87815,#E8C468)" }} />
              <div className="px-6 py-3" style={{ background: "rgba(13,17,23,0.90)" }}>
                {lowerThird.tag && (
                  <div className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.28em] text-theme-orange mb-1">
                    {lowerThird.tag}
                  </div>
                )}
                <div className="font-archivo text-2xl font-bold italic uppercase text-white leading-tight">
                  {lowerThird.title ?? ""}
                </div>
                {lowerThird.subtitle && (
                  <div className="font-mono-geist text-[10px] text-white/60 uppercase tracking-[0.12em] mt-0.5">
                    {lowerThird.subtitle}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ticker strip — bottom edge */}
        {tickerQueue.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-9 flex items-center overflow-hidden"
            style={{ background: "rgba(13,17,23,0.90)", borderTop: "1px solid rgba(201,151,31,0.25)" }}>
            <div className="px-4 h-full flex items-center shrink-0" style={{ background: "#c9971f" }}>
              <span className="fx-dot w-1.5 h-1.5 rounded-full bg-background mr-2" style={{ background: "#0d1117" }} />
              <span className="font-mono-geist text-[9px] font-bold uppercase tracking-widest text-[#0d1117]">
                Live
              </span>
            </div>
            <div className="flex-1 flex items-center gap-8 px-4 overflow-hidden">
              {tickerQueue.slice(-3).map((t) => (
                <span key={t.id} className="fx-ticker-in font-archivo text-sm font-bold uppercase tracking-wide text-white/90 whitespace-nowrap">
                  {t.message}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}