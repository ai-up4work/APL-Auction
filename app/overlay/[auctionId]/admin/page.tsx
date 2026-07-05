// app/overlay/[auctionId]/admin/page.tsx
"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent } from "@/lib/overlayBus";
import { supabase } from "@/lib/supabse";

export default function OverlayAdminPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);

  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [ltTag, setLtTag] = useState("On The Block");
  const [ltTitle, setLtTitle] = useState("Player Name");
  const [ltSubtitle, setLtSubtitle] = useState("Role · Country");
  const [ltShowing, setLtShowing] = useState(false);

  const [sbLabel, setSbLabel] = useState("Current Bid");
  const [sbValue, setSbValue] = useState("1,20,000 PTS");
  const [sbSub, setSbSub] = useState("Leading: RCB");
  const [sbShowing, setSbShowing] = useState(false);

  const [tickerMsg, setTickerMsg] = useState("Rahul sold to MI for 2,40,000 PTS!");

  const [sbTeam, setSbTeam] = useState("MI");
  const [sbPlayer, setSbPlayer] = useState("Rahul Sharma");
  const [sbPrice, setSbPrice] = useState("2,40,000 PTS");
  const [soldBoardShowing, setSoldBoardShowing] = useState(false);

  // ── cricket-match overlay toggle state — just tracks on/off for the UI ──
  const [powerplayOn, setPowerplayOn] = useState(false);
  const [pointsTableOn, setPointsTableOn] = useState(false);
  const [mainScoreboardOn, setMainScoreboardOn] = useState(false);
  const [battingOn, setBattingOn] = useState(false);
  const [bowlingOn, setBowlingOn] = useState(false);
  const [partnershipOn, setPartnershipOn] = useState(false);
  const [overSummaryOn, setOverSummaryOn] = useState(false);
  const [playerOfMatchOn, setPlayerOfMatchOn] = useState(false);

  const overlayUrl = typeof window !== "undefined" ? `${window.location.origin}/overlay/${auctionId}` : "";

  useEffect(() => {
    const bus = connectOverlayBus(auctionId);
    busRef.current = bus;
    const t = setTimeout(() => setConnected(bus.isReady), 600);
    return () => {
      clearTimeout(t);
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
        input, textarea {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10);
          border-radius: 8px; padding: 8px 12px; color: #fff; font-size: 13px; width: 100%; outline: none;
        }
        input:focus, textarea:focus { border-color: rgba(201,151,31,0.5); }
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

      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="panel p-5 lg:col-span-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono-geist text-[9px] uppercase tracking-[0.2em] text-white/50 mb-1">OBS Browser Source URL</div>
            <code className="font-mono-geist text-xs text-theme-orange break-all">{overlayUrl || "…"}</code>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest">1920×1080 · transparent bg on</span>
            <button onClick={copyUrl} className="fx-btn fx-toggle-on">{copied ? "Copied ✓" : "Copy URL"}</button>
          </div>
        </div>

        <div className="panel p-5 flex flex-col gap-3">
          <h3 className="font-mono-geist text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1">Quick FX</h3>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => fire({ type: "stamp", state: "sold" }, "Stamp: SOLD")} className="fx-btn" style={{ background: "rgba(201,151,31,0.14)", color: "#E8C468", borderColor: "rgba(201,151,31,0.3)" }}>Sold Stamp</button>
            <button onClick={() => fire({ type: "stamp", state: "unsold" }, "Stamp: UNSOLD")} className="fx-btn" style={{ background: "rgba(113,128,150,0.14)", color: "#CBD5E0", borderColor: "rgba(113,128,150,0.3)" }}>Unsold Stamp</button>
            <button onClick={() => fire({ type: "confetti" }, "Confetti burst")} className="fx-btn" style={{ background: "rgba(232,196,104,0.12)", color: "#E8C468" }}>Confetti</button>
            <button onClick={() => fire({ type: "flash", color: "rgba(201,151,31,0.18)" }, "Flash")} className="fx-btn" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>Flash</button>
            <button onClick={() => fire({ type: "replayBadge", show: true }, "Replay badge ON")} className="fx-btn" style={{ background: "rgba(239,68,68,0.14)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}>Replay On</button>
            <button onClick={() => fire({ type: "replayBadge", show: false }, "Replay badge OFF")} className="fx-btn" style={{ background: "rgba(255,255,255,0.05)", color: "#a0aec0" }}>Replay Off</button>
          </div>
          <button
            onClick={() => {
              setSoldBoardShowing(false);
              setPowerplayOn(false); setPointsTableOn(false); setMainScoreboardOn(false);
              setBattingOn(false); setBowlingOn(false); setPartnershipOn(false);
              setOverSummaryOn(false); setPlayerOfMatchOn(false);
              fire({ type: "clearAll" }, "Cleared all overlays");
            }}
            className="fx-btn mt-1"
            style={{ background: "rgba(239,68,68,0.10)", color: "#f87171", borderColor: "rgba(239,68,68,0.25)" }}
          >
            Clear Everything
          </button>
        </div>

        <div className="panel p-5 flex flex-col gap-3">
          <h3 className="font-mono-geist text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1">Lower Third</h3>
          <input placeholder="Tag (e.g. On The Block)" value={ltTag} onChange={(e) => setLtTag(e.target.value)} />
          <input placeholder="Title (e.g. player name)" value={ltTitle} onChange={(e) => setLtTitle(e.target.value)} />
          <input placeholder="Subtitle (e.g. role · country)" value={ltSubtitle} onChange={(e) => setLtSubtitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button onClick={() => { setLtShowing(true); fire({ type: "lowerThird", show: true, tag: ltTag, title: ltTitle, subtitle: ltSubtitle }, `Lower third: ${ltTitle}`); }} className="fx-btn fx-toggle-on">Show</button>
            <button onClick={() => { setLtShowing(false); fire({ type: "lowerThird", show: false }, "Lower third hidden"); }} className="fx-btn fx-toggle-off">Hide</button>
          </div>
          <span className="font-mono-geist text-[9px] uppercase tracking-widest" style={{ color: ltShowing ? "#22c55e" : "#666" }}>{ltShowing ? "● live on overlay" : "○ hidden"}</span>
        </div>

        <div className="panel p-5 flex flex-col gap-3">
          <h3 className="font-mono-geist text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1">Scoreboard / Bid Update</h3>
          <input placeholder="Label (e.g. Current Bid)" value={sbLabel} onChange={(e) => setSbLabel(e.target.value)} />
          <input placeholder="Value (e.g. 1,20,000 PTS)" value={sbValue} onChange={(e) => setSbValue(e.target.value)} />
          <input placeholder="Sub-line (e.g. Leading: RCB)" value={sbSub} onChange={(e) => setSbSub(e.target.value)} />
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button onClick={() => { setSbShowing(true); fire({ type: "scoreboard", show: true, label: sbLabel, value: sbValue, sub: sbSub }, `Scoreboard: ${sbValue}`); }} className="fx-btn fx-toggle-on">Show / Update</button>
            <button onClick={() => { setSbShowing(false); fire({ type: "scoreboard", show: false }, "Scoreboard hidden"); }} className="fx-btn fx-toggle-off">Hide</button>
          </div>
          <span className="font-mono-geist text-[9px] uppercase tracking-widest" style={{ color: sbShowing ? "#22c55e" : "#666" }}>{sbShowing ? "● live on overlay" : "○ hidden"}</span>
        </div>

        <div className="panel p-5 flex flex-col gap-3">
          <h3 className="font-mono-geist text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1">Sold Board (Scorecard)</h3>
          <input placeholder="Team (e.g. MI)" value={sbTeam} onChange={(e) => setSbTeam(e.target.value)} />
          <input placeholder="Player name" value={sbPlayer} onChange={(e) => setSbPlayer(e.target.value)} />
          <input placeholder="Price (e.g. 2,40,000 PTS)" value={sbPrice} onChange={(e) => setSbPrice(e.target.value)} />
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              onClick={async () => {
                setSoldBoardShowing(true);
                const { data, error } = await supabase.from("overlay_sold_board").insert({ auction_id: auctionId, team: sbTeam, player: sbPlayer, price: sbPrice }).select("id").single();
                fire({ type: "soldBoard", show: true, entry: { id: error ? `${Date.now()}` : data.id, team: sbTeam, player: sbPlayer, price: sbPrice } }, `Sold board: ${sbPlayer} → ${sbTeam}${error ? " (not saved — check table)" : ""}`);
              }}
              className="fx-btn fx-toggle-on"
            >
              Add Entry
            </button>
            <button
              onClick={async () => {
                setSoldBoardShowing(false);
                await supabase.from("overlay_sold_board").delete().eq("auction_id", auctionId);
                fire({ type: "soldBoard", show: false, clear: true }, "Sold board cleared");
              }}
              className="fx-btn fx-toggle-off"
            >
              Clear / Hide
            </button>
          </div>
          <span className="font-mono-geist text-[9px] uppercase tracking-widest" style={{ color: soldBoardShowing ? "#22c55e" : "#666" }}>{soldBoardShowing ? "● live on overlay" : "○ hidden"}</span>
        </div>

        {/* ── Cricket match overlays — one toggle button per overlay ────── */}
        <div className="panel p-5 lg:col-span-3 flex flex-col gap-3">
          <h3 className="font-mono-geist text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1">Cricket Match Overlays</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

           
          </div>
          <p className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest mt-1">
            Milestone and wicket graphics auto-hide after a few seconds — no need to turn them off.
          </p>
        </div>

        <div className="panel p-5 flex flex-col gap-3 lg:col-span-3">
          <h3 className="font-mono-geist text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1">Ticker Message</h3>
          <div className="flex gap-3">
            <input
              className="flex-1"
              placeholder="e.g. Rahul sold to MI for 2,40,000 PTS!"
              value={tickerMsg}
              onChange={(e) => setTickerMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && tickerMsg.trim()) fire({ type: "ticker", message: tickerMsg.trim() }, `Ticker: ${tickerMsg.trim()}`); }}
            />
            <button onClick={() => tickerMsg.trim() && fire({ type: "ticker", message: tickerMsg.trim() }, `Ticker: ${tickerMsg.trim()}`)} className="fx-btn fx-toggle-on shrink-0 px-6">Send</button>
          </div>
        </div>

        <div className="panel p-5 lg:col-span-3">
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