// components/demo/DemoAuctioneerPage.tsx
"use client";

import React, { useSyncExternalStore, useState } from "react";
import { demoModel, getNextBidAmount, fmtPts } from "@/lib/demo/demoModel";
import DemoCursor from "./DemoCursor";

type Particle = { id: number; tx: number; ty: number; color: string; duration: number };
const SOLD_COLORS = ["#E8C468", "#A87815", "#FDECC8", "#ffffff"];
const UNSOLD_COLORS = ["#718096", "#A0AEC0", "#CBD5E0", "#E2E8F0"];
let pid = 0;

// Faithful re-creation of your embedded sold/unsold stamp styling from
// AuctioneerContent's own <style jsx global> block — same class names,
// same animation curves.
function AuctionStamp({ state }: { state: "sold" | "unsold" }) {
  const isSold = state === "sold";
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      <div className={isSold ? "auction-sold-stamp" : "auction-unsold-stamp"}>
        <div className={isSold ? "sold-stamp-face" : "unsold-stamp-face"}>
          <div className={isSold ? "sold-inner-ring" : "unsold-inner-ring"} />
          <div className={isSold ? "sold-hatch-layer" : "unsold-hatch-layer"} />
          <span className={isSold ? "sold-word" : "unsold-word"}>{isSold ? "SOLD" : "UNSOLD"}</span>
          {isSold ? (
            <div className="sold-dots"><span className="sold-dot" /><span className="sold-dot" /><span className="sold-dot" /></div>
          ) : (
            <span className="unsold-sub">Passed In</span>
          )}
          {isSold && <div className="sold-bar" />}
        </div>
      </div>
    </div>
  );
}

export default function DemoAuctioneerPage() {
  const snap = useSyncExternalStore(demoModel.subscribe.bind(demoModel), demoModel.getSnapshot.bind(demoModel));
  const { auction, currentLot, bidHistory, teamPurses, lotNumber, clockPct, isLocked } = snap;

  const [particles, setParticles] = useState<Particle[]>([]);
  const [flashActive, setFlashActive] = useState(false);
  const [glowActive, setGlowActive] = useState(false);

  const soldState: "pending" | "sold" | "unsold" =
    currentLot?.status === "sold" ? "sold" : currentLot?.status === "unsold" ? "unsold" : "pending";
  const isShuffling = currentLot?.status === "shuffling";

  const winningTeam = currentLot?.winningTeamId
    ? auction.teams.find((t) => t.supabaseId === currentLot.winningTeamId) ?? null
    : null;
  const nextBidAmount = currentLot ? getNextBidAmount(currentLot.currentBid, auction.rules.tiers) : 0;

  const shotClockColor = clockPct < 25 ? "#ef4444" : clockPct < 50 ? "#f59e0b" : "#c9971f";

  function spawnParticles(colors: string[]) {
    const created: Particle[] = Array.from({ length: 40 }, () => {
      const id = pid++;
      return { id, tx: (Math.random() - 0.5) * 800, ty: (Math.random() - 0.5) * 800, duration: 1 + Math.random() * 1.2, color: colors[Math.floor(Math.random() * colors.length)] };
    });
    setParticles((p) => [...p, ...created]);
    created.forEach((p) => setTimeout(() => setParticles((prev) => prev.filter((x) => x.id !== p.id)), p.duration * 1000));
  }

  function handleStartNext() {
    if (currentLot && currentLot.status !== "sold" && currentLot.status !== "unsold") return;
    demoModel.startShuffle();
    setTimeout(() => demoModel.revealLot(), 2000);
  }
  function handleHammerSold() {
    if (!currentLot || soldState !== "pending" || !currentLot.winningTeamId) return;
    demoModel.hammerSold();
    setFlashActive(true); setGlowActive(true);
    spawnParticles(SOLD_COLORS);
    setTimeout(() => setFlashActive(false), 120);
  }
  function handleMarkUnsold() {
    if (!currentLot || soldState !== "pending") return;
    demoModel.markUnsold();
    spawnParticles(UNSOLD_COLORS);
  }

  const totalSlotsLeft = auction.teams.reduce((sum, t) => {
    const purse = teamPurses[t.supabaseId];
    return sum + Math.max(0, auction.rules.teamSize - (purse?.roster ?? 0));
  }, 0);
  const avgPurse = auction.teams.length
    ? Math.round(auction.teams.reduce((s, t) => s + (teamPurses[t.supabaseId]?.remaining ?? auction.rules.totalPoints), 0) / auction.teams.length)
    : 0;

  return (
    <div
      data-demo-panel="auctioneer"
      className="relative bg-background text-on-background overflow-hidden h-full flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif", background: "#0d1117" }}
    >
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        .font-archivo { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }
        .glass-panel { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .auction-particle { position: absolute; pointer-events: none; z-index: 100; border-radius: 50%; width: 8px; height: 8px; animation-name: particle-fly; animation-timing-function: cubic-bezier(0.1,0.8,0.3,1); animation-fill-mode: forwards; }
        @keyframes particle-fly { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; } }
        .auction-sold-stamp { transform: rotate(-13deg); animation: sold-land 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes sold-land { 0% { opacity:0; transform: rotate(-13deg) scale(2.2); filter: blur(14px); } 55% { opacity:1; filter: blur(0);} 100% { transform: rotate(-13deg) scale(1); } }
        .sold-stamp-face { position: relative; padding: 16px 40px 14px; border: 4px solid #A87815; border-radius: 4px; overflow: hidden; background: rgba(201,151,31,0.07); }
        .sold-inner-ring { position: absolute; inset: 5px; border: 1px solid rgba(201,151,31,0.32); border-radius: 2px; pointer-events: none; }
        .sold-hatch-layer { position: absolute; inset: 0; background: repeating-linear-gradient(108deg, transparent 0px, transparent 13px, rgba(232,196,104,0.07) 13px, rgba(232,196,104,0.07) 14px); }
        .sold-word { font-family: 'Archivo Narrow', sans-serif; font-size: 52px; font-weight: 700; font-style: italic; letter-spacing: 0.14em; text-transform: uppercase; color: #E8C468; line-height: 1; display: block; position: relative; z-index: 2; text-shadow: 0 0 40px rgba(232,196,104,0.25); }
        .sold-dots { display: flex; gap: 6px; justify-content: center; margin-top: 8px; position: relative; z-index: 2; }
        .sold-dot { display: block; width: 5px; height: 5px; border-radius: 50%; background: rgba(232,196,104,0.45); }
        .sold-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: #A87815; }
        .auction-unsold-stamp { transform: rotate(13deg); animation: unsold-land 0.55s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
        @keyframes unsold-land { 0% { opacity:0; transform: rotate(13deg) scale(2.2); filter: blur(14px);} 55% {opacity:1; filter: blur(0);} 100% { transform: rotate(13deg) scale(1);} }
        .unsold-stamp-face { position: relative; padding: 16px 30px 14px; border: 4px solid #718096; border-radius: 4px; overflow: hidden; background: rgba(74,85,104,0.08); }
        .unsold-inner-ring { position: absolute; inset: 5px; border: 1px solid rgba(113,128,150,0.30); border-radius: 2px; }
        .unsold-hatch-layer { position: absolute; inset: 0; background: repeating-linear-gradient(-45deg, transparent 0px, transparent 6px, rgba(113,128,150,0.08) 6px, rgba(113,128,150,0.08) 7px); }
        .unsold-word { font-family: 'Archivo Narrow', sans-serif; font-size: 40px; font-weight: 700; font-style: italic; letter-spacing: 0.12em; text-transform: uppercase; color: #A0AEC0; line-height: 1; display: block; position: relative; z-index: 2; }
        .unsold-sub { display: block; text-align: center; font-family: 'Geist Mono', monospace; font-size: 8px; font-weight: 500; letter-spacing: 0.35em; text-transform: uppercase; color: rgba(160,174,192,0.55); margin-top: 6px; position: relative; z-index: 2; }
      `}</style>

      <DemoCursor cursor={snap.cursors["auctioneer"]} />

      {particles.map((p) => (
        <span key={p.id} className="auction-particle" style={{ left: "50%", top: "50%", backgroundColor: p.color, "--tx": `${p.tx}px`, "--ty": `${p.ty}px`, animationDuration: `${p.duration}s` } as React.CSSProperties} />
      ))}

      <div className={`absolute inset-0 pointer-events-none z-[60] transition-opacity duration-75 ${soldState === "sold" ? "bg-theme-orange/10" : soldState === "unsold" ? "bg-slate-400/5" : ""} ${flashActive ? "opacity-100" : "opacity-0"}`} style={{ background: soldState === "sold" ? "rgba(201,151,31,0.1)" : "rgba(148,163,184,0.05)" }} />
      <div className={`absolute inset-0 pointer-events-none z-[55] flex items-center justify-center transition-opacity duration-500 ${glowActive ? "opacity-100" : "opacity-0"}`}>
        <div className="w-[400px] h-[400px] rounded-full blur-[100px]" style={{ background: soldState === "sold" ? "rgba(201,151,31,0.18)" : "rgba(113,128,150,0.12)" }} />
      </div>

      {/* TOP BAR */}
      <header className="shrink-0 flex justify-between items-center px-6 h-14 glass-panel border-b border-white/10">
        <div className="flex items-center gap-3">
          <h1 className="font-archivo text-lg font-bold italic tracking-tighter text-theme-orange uppercase" style={{ color: "#c9971f" }}>
            {auction.session.auctionName}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {currentLot && soldState === "pending" && !isShuffling && (
            <div className="flex items-center gap-2">
              <span className="font-mono-geist text-[9px] uppercase tracking-[0.1em]" style={{ color: shotClockColor }}>{isLocked ? "Locked" : "Clock"}</span>
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-100" style={{ width: `${clockPct}%`, background: shotClockColor }} />
              </div>
            </div>
          )}
          <div className="font-mono-geist text-[9px] text-right">
            <div className="text-white/40 uppercase tracking-[0.1em]">Lot</div>
            <div className="font-bold" style={{ color: "#c9971f" }}>#{lotNumber} / {auction.players.length + auction.rules.teamSize}</div>
          </div>
          <button className="bg-white/5 text-white/60 px-4 py-1.5 rounded font-mono-geist font-bold uppercase tracking-[0.2em] text-[10px] border border-white/10">Pause</button>
          <button className="bg-red-500/10 text-red-300 px-4 py-1.5 rounded font-mono-geist font-bold uppercase tracking-[0.2em] text-[10px] border border-white/10">Complete</button>
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-[22%_53%_25%] overflow-hidden">
        {/* LEFT: queue */}
        <aside className="flex flex-col h-full bg-black/20 border-r border-white/5 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-white/5">
            <div className="flex justify-between items-center">
              <h3 className="font-mono-geist text-[10px] text-white/50 uppercase font-bold tracking-[0.2em]">Remaining Pool</h3>
              <span className="bg-white/5 px-2 py-0.5 rounded font-mono-geist text-[9px] font-bold tracking-widest">{auction.players.length} PENDING</span>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
            {auction.players.map((p) => (
              <div key={p.supabaseId} className="p-2.5 rounded flex items-center gap-3 hover:bg-white/5">
                <span className="w-2 h-2 rounded-full bg-white/20" />
                <div>
                  <p className="font-archivo text-xs font-bold uppercase text-white/70">{p.name}</p>
                  <p className="font-mono-geist text-[9px] text-white/40">{p.role} | {p.country}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER */}
        <section className="flex flex-col h-full p-4 gap-3 overflow-hidden">
          <div className="glass-panel rounded-2xl flex flex-row relative overflow-hidden p-4 gap-5 flex-1">
            {soldState === "sold" && !isShuffling && <AuctionStamp state="sold" />}
            {soldState === "unsold" && !isShuffling && <AuctionStamp state="unsold" />}

            <div className="relative shrink-0">
              <div className="w-44 h-44 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl relative bg-white/5 flex items-center justify-center">
                <span className="material-symbols-outlined text-white/15" style={{ fontSize: 56 }}>{isShuffling ? "casino" : "person"}</span>
                {currentLot && soldState === "pending" && !isShuffling && (
                  <div className="absolute bottom-0 left-0 right-0 h-1">
                    <div className="h-full transition-all duration-100" style={{ width: `${clockPct}%`, background: shotClockColor }} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 w-full mt-3">
                {isShuffling ? (
                  <div className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono-geist text-[9px] uppercase tracking-[0.2em]" style={{ background: "rgba(201,151,31,0.06)", border: "1px solid rgba(201,151,31,0.2)", color: "#c9971f" }}>
                    Revealing on broadcast…
                  </div>
                ) : soldState === "pending" && currentLot ? (
                  <>
                    <button id="demo-hammer-btn" onClick={handleHammerSold} disabled={!currentLot.winningTeamId}
                      className="flex items-center justify-center gap-1 py-2.5 rounded-lg font-mono-geist text-[9px] font-bold uppercase tracking-[0.2em] disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg,#A87815,#E8C468)", color: "#1a1304" }}>
                      Hammer Sold
                    </button>
                    <button onClick={handleMarkUnsold} className="flex items-center justify-center gap-1 py-2.5 rounded-lg font-mono-geist text-[9px] uppercase tracking-[0.2em] text-white/60 border border-white/10">
                      Mark Unsold
                    </button>
                  </>
                ) : (
                  <button id="demo-start-btn" onClick={handleStartNext} disabled={auction.players.length === 0}
                    className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono-geist text-[9px] font-bold uppercase tracking-[0.2em] disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#A87815,#E8C468)", color: "#1a1304" }}>
                    {currentLot ? "Next Player" : "Start Next Player"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <span className="font-mono-geist text-[10px] tracking-[0.3em] uppercase font-bold block" style={{ color: isShuffling ? "#c9971f" : soldState === "sold" ? "#c9971f" : soldState === "unsold" ? "#718096" : isLocked ? "#ef4444" : "#c9971f" }}>
                {isShuffling ? "Revealing Player…" : soldState === "sold" ? "Auction Finalized" : soldState === "unsold" ? "Marked Unsold" : currentLot ? (isLocked ? "Bidding Locked — Make Decision" : "Currently on Block") : "Awaiting First Lot"}
              </span>
              <h2 className="font-archivo text-3xl text-white tracking-tight font-bold italic uppercase">
                {isShuffling ? "???" : currentLot?.playerName ?? "—"}
              </h2>
              {!isShuffling && currentLot && (
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="px-2.5 py-0.5 bg-white/10 rounded font-mono-geist text-[9px] uppercase tracking-[0.18em]">{currentLot.playerRole} | {currentLot.playerCountry}</span>
                  <span className="px-2.5 py-0.5 bg-white/10 rounded font-mono-geist text-[9px] uppercase tracking-[0.18em]">Base: {fmtPts(currentLot.basePrice)} pts</span>
                </div>
              )}
              {currentLot && !isShuffling && (
                <div className="p-3 glass-panel rounded-xl">
                  <div className="flex items-end justify-between mb-1">
                    <div>
                      <p className="font-mono-geist text-[8px] text-white/40 uppercase tracking-[0.18em] mb-1">Current High Bid</p>
                      <p className="font-archivo text-2xl font-bold" style={{ color: "#c9971f" }}>{fmtPts(currentLot.currentBid)}<span className="text-xs opacity-50 ml-1">pts</span></p>
                    </div>
                    {winningTeam && (
                      <div className="text-right">
                        <p className="font-mono-geist text-[8px] text-white/40 uppercase tracking-[0.1em] mb-1">Leading</p>
                        <p className="font-archivo text-lg font-bold text-white">{winningTeam.code}</p>
                      </div>
                    )}
                  </div>
                  {soldState === "pending" && !isLocked && (
                    <p className="font-mono-geist text-[9px] text-white/50">Next bid: <span className="font-bold" style={{ color: "#c9971f" }}>{fmtPts(nextBidAmount)} pts</span></p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bid log */}
          <div className="flex-1 min-h-0 glass-panel rounded-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-mono-geist text-[10px] text-white uppercase font-bold tracking-[0.2em]">Live Bidding Feed</h3>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-2">
              {bidHistory.length === 0 ? (
                <div className="flex items-center justify-center h-full"><p className="font-mono-geist text-[10px] text-white/30 uppercase tracking-widest">{isShuffling ? "Awaiting reveal" : "No bids yet"}</p></div>
              ) : (
                <table className="w-full text-left border-separate border-spacing-y-1.5">
                  <tbody className="font-mono-geist text-[11px]">
                    {bidHistory.map((b, i) => (
                      <tr key={b.id} className="text-white/60">
                        <td className="px-4 py-2"><span className="w-2 h-2 rounded-full inline-block mr-2" style={{ background: b.teamColor }} /><span className="font-archivo font-semibold">{b.teamName}</span></td>
                        <td className="px-4 py-2 font-archivo font-semibold" style={{ color: "#c9971f" }}>{fmtPts(b.amount)} pts</td>
                        <td className="px-4 py-2 text-right opacity-40 italic">{i === 0 ? "Leading" : "Outbid"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: teams */}
        <aside className="flex flex-col h-full bg-black/10 border-l border-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <h3 className="font-mono-geist text-[10px] text-white/50 uppercase font-bold tracking-[0.2em] mb-3">Financial Dashboard</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 glass-panel rounded-lg flex flex-col gap-1">
                <span className="font-mono-geist text-[9px] text-white/40 uppercase tracking-[0.1em]">Avg Purse</span>
                <span className="font-archivo text-base font-bold text-white leading-none">{fmtPts(avgPurse)}</span>
              </div>
              <div className="p-3 glass-panel rounded-lg flex flex-col gap-1">
                <span className="font-mono-geist text-[9px] text-white/40 uppercase tracking-[0.1em]">Slots Left</span>
                <span className="font-archivo text-base font-bold text-white leading-none">{totalSlotsLeft}</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {auction.teams.map((team) => {
              const purse = teamPurses[team.supabaseId];
              const roster = purse?.roster ?? 0;
              const remaining = purse?.remaining ?? auction.rules.totalPoints;
              const pctFilled = Math.round((remaining / Math.max(auction.rules.totalPoints, 1)) * 100);
              return (
                <div key={team.supabaseId} className="p-4 glass-panel rounded-xl">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs font-archivo" style={{ background: team.color, color: "#fff" }}>{team.code}</div>
                      <div>
                        <span className="block font-archivo text-xs font-bold text-white uppercase leading-tight">{team.name}</span>
                        <span className="font-mono-geist text-[9px] text-white/40 font-bold uppercase tracking-[0.1em]">Squad: {roster}/{auction.rules.teamSize}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between font-mono-geist text-[9px] uppercase tracking-[0.1em] font-bold">
                      <span className="text-white/40">Remaining Budget</span>
                      <span className="font-archivo text-[12px] font-semibold text-white">{fmtPts(remaining)} pts</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full transition-all duration-1000" style={{ width: `${pctFilled}%`, background: "linear-gradient(90deg,#A87815,#E8C468)" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
}