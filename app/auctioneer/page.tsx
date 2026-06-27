"use client";

/**
 * Auction Admin Console — Next.js page
 *
 * Wrapped with DesktopOnlyWrapper so phones and tablets (< 1024px)
 * see a styled blocker screen instead of the admin UI.
 *
 * Color system:
 *   --sold:   Amber-gold  (#C9920A / #F5B400)
 *   --unsold: Slate-cool  (#4A5568 / #A0AEC0)
 *   --accent: Crimson     (#9B1C1C / #E53E3E)
 *
 * Typography:
 *   Archivo Narrow  → display / headlines / team names / bid amounts
 *   Geist Mono      → labels, mono data, tracking caps, badge text
 *   Inter           → base body font
 */

import React, { useEffect, useRef, useState } from "react";
import DesktopOnlyWrapper from "@/components/DesktopOnlyWrapper";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
type BidRow = {
  id: number;
  time: string;
  team: string;
  color: string;
  amount: string;
};

export type SoldState = "pending" | "sold" | "unsold";

type Particle = {
  id: number;
  tx: number;
  ty: number;
  color: string;
  duration: number;
};

type QueuedPlayer = {
  id: number;
  name: string;
  role: string;
  country: string;
};

type TeamCard = {
  id: string;
  abbr: string;
  name: string;
  squad: string;
  remaining: string;
  pctFilled: number;
  swatch: string;
  full?: boolean;
};

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const TEAMS = [
  { name: "Delhi Capitals",       color: "bg-blue-400" },
  { name: "Gujarat Titans",       color: "bg-teal-500" },
  { name: "Lucknow Super Giants", color: "bg-cyan-600" },
  { name: "Rajasthan Royals",     color: "bg-pink-500" },
];

const PARTICLE_COLORS_SOLD   = ["#F5B400", "#C9920A", "#FDECC8", "#ffffff"];
const PARTICLE_COLORS_UNSOLD = ["#718096", "#A0AEC0", "#CBD5E0", "#E2E8F0"];

const INITIAL_QUEUE: QueuedPlayer[] = [
  { id: 1,  name: "Pat Cummins",    role: "BOWL", country: "Australia"    },
  { id: 2,  name: "Rashid Khan",    role: "ALL",  country: "Afghanistan"  },
  { id: 3,  name: "Shubman Gill",   role: "BAT",  country: "India"        },
  { id: 4,  name: "Ben Stokes",     role: "ALL",  country: "England"      },
  { id: 5,  name: "Jasprit Bumrah", role: "BOWL", country: "India"        },
  { id: 6,  name: "David Warner",   role: "BAT",  country: "Australia"    },
  { id: 7,  name: "Andre Russell",  role: "ALL",  country: "West Indies"  },
  { id: 8,  name: "Rashid Khan",    role: "ALL",  country: "Afghanistan"  },
  { id: 9,  name: "Shreyas Iyer",   role: "BAT",  country: "India"        },
  { id: 10, name: "Kagiso Rabada",  role: "BOWL", country: "South Africa" },
  { id: 11, name: "Glenn Maxwell",  role: "ALL",  country: "Australia"    },
  { id: 12, name: "Rashid Khan",    role: "ALL",  country: "Afghanistan"  },
  { id: 13, name: "Shubman Gill",   role: "BAT",  country: "India"        },
  { id: 14, name: "Ben Stokes",     role: "ALL",  country: "England"      },
  { id: 15, name: "Jasprit Bumrah", role: "BOWL", country: "India"        },
];

const TEAM_CARDS: TeamCard[] = [
  { id: "mi",  abbr: "MI",  name: "Mumbai Indians",        squad: "6/16",  remaining: "₹32.40 CR", pctFilled: 32, swatch: "bg-blue-600"   },
  { id: "csk", abbr: "CSK", name: "Chennai Super Kings",   squad: "16/16", remaining: "₹4.10 CR",  pctFilled: 95, swatch: "bg-yellow-500", full: true },
  { id: "kkr", abbr: "KKR", name: "Kolkata Knight Riders", squad: "12/16", remaining: "₹18.20 CR", pctFilled: 55, swatch: "bg-purple-600"  },
  { id: "lsg", abbr: "LSG", name: "Lucknow Super Giants",  squad: "9/16",  remaining: "₹22.50 CR", pctFilled: 40, swatch: "bg-cyan-600"    },
  { id: "gt",  abbr: "GT",  name: "Gujarat Titans",        squad: "11/16", remaining: "₹19.80 CR", pctFilled: 50, swatch: "bg-teal-500"    },
  { id: "rr",  abbr: "RR",  name: "Rajasthan Royals",      squad: "10/16", remaining: "₹21.00 CR", pctFilled: 45, swatch: "bg-pink-500"    },
];

const PLAYER_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBb3lLGTIwc8DK62j9gHGsRo75zbQ8gDbSMwBMqiyzl8eUQgtVGN0HZRC2OD9yUYDypZApfd1D0c2U5pTqF6j4LHfIP4SV0bEkeNClIlGm1Q5QfsWbXyDQesV9Kx6xP8R49ceVR9Oa3roIr35Lxh_m9UVaUMsxY47UaagTuH9yOsj_MuQeg5HCiYR1cDQdGn0acIa4OE8LJEm3v3ehyhGrPpbgZnY6z3KcZJuStu62-DesfQTbrZisMeiCgJcs8DIDRG8RPH-E9POw";

let bidIdCounter  = 1000;
let particleIdCtr = 0;

function nowLabel() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function seedBids(): BidRow[] {
  const seed: Array<{ team: string; color: string; amount: string }> = [
    { team: "Rajasthan Royals",     color: "bg-pink-500", amount: "₹14.86 CR" },
    { team: "Lucknow Super Giants", color: "bg-cyan-600", amount: "₹14.87 CR" },
    { team: "Gujarat Titans",       color: "bg-teal-500", amount: "₹14.79 CR" },
    { team: "Rajasthan Royals",     color: "bg-pink-500", amount: "₹14.69 CR" },
    { team: "Lucknow Super Giants", color: "bg-cyan-600", amount: "₹14.99 CR" },
    { team: "Delhi Capitals",       color: "bg-blue-400", amount: "₹14.76 CR" },
  ];
  return seed.map((s) => ({ id: bidIdCounter++, time: nowLabel(), ...s }));
}

// ─────────────────────────────────────────────
//  AuctionStamp
// ─────────────────────────────────────────────
export function AuctionStamp({ state }: { state: "sold" | "unsold" }) {
  if (state === "sold") {
    return (
      <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
        <div className="auction-sold-stamp">
          <div className="sold-stamp-face">
            <div className="sold-inner-ring" />
            <div className="sold-hatch-layer" />
            <span className="sold-word">SOLD</span>
            <div className="sold-dots">
              <span className="sold-dot" />
              <span className="sold-dot" />
              <span className="sold-dot" />
            </div>
            <span className="sold-sub">Auction finalized</span>
            <div className="sold-bar" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
      <div className="auction-unsold-stamp">
        <div className="unsold-stamp-face">
          <div className="unsold-inner-ring" />
          <div className="unsold-hatch-layer" />
          <CrossMark className="corner-tl" />
          <CrossMark className="corner-tr" />
          <CrossMark className="corner-bl" />
          <CrossMark className="corner-br" />
          <span className="unsold-word">UNSOLD</span>
          <span className="unsold-sub">No bids accepted</span>
        </div>
      </div>
    </div>
  );
}

function CrossMark({ className }: { className: string }) {
  return (
    <div className={`cross-mark ${className}`}>
      <div className="cross-h" />
      <div className="cross-v" />
    </div>
  );
}

// ─────────────────────────────────────────────
//  Inner admin page (desktop-only content)
// ─────────────────────────────────────────────
function AuctionAdminContent() {
  const [queue,       setQueue]       = useState<QueuedPlayer[]>(INITIAL_QUEUE);
  const [bids,        setBids]        = useState<BidRow[]>(() => seedBids());
  const [soldState,   setSoldState]   = useState<SoldState>("pending");
  const [flashActive, setFlashActive] = useState(false);
  const [glowActive,  setGlowActive]  = useState(false);
  const [particles,   setParticles]   = useState<Particle[]>([]);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-generate bids while pending
  useEffect(() => {
    const interval = setInterval(() => {
      if (soldState !== "pending") return;
      if (Math.random() <= 0.6) return;
      const team   = TEAMS[Math.floor(Math.random() * TEAMS.length)];
      const amount = (14.5 + Math.random() * 0.5).toFixed(2);
      setBids((prev) =>
        [
          {
            id: bidIdCounter++,
            time: nowLabel(),
            team: team.name,
            color: team.color,
            amount: `₹${amount} CR`,
          },
          ...prev,
        ].slice(0, 15)
      );
    }, 3500);
    return () => clearInterval(interval);
  }, [soldState]);

  useEffect(
    () => () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    },
    []
  );

  function spawnParticles(colors: string[]) {
    const created: Particle[] = Array.from({ length: 50 }, () => {
      const id       = particleIdCtr++;
      const tx       = (Math.random() - 0.5) * 1000;
      const ty       = (Math.random() - 0.5) * 1000;
      const duration = 1 + Math.random() * 1.5;
      const color    = colors[Math.floor(Math.random() * colors.length)];
      return { id, tx, ty, color, duration };
    });
    setParticles((prev) => [...prev, ...created]);
    created.forEach((p) => {
      setTimeout(
        () => setParticles((prev) => prev.filter((x) => x.id !== p.id)),
        p.duration * 1000
      );
    });
  }

  function handleHammerSold() {
    if (soldState !== "pending") return;
    setSoldState("sold");
    setFlashActive(true);
    setGlowActive(true);
    spawnParticles(PARTICLE_COLORS_SOLD);
    flashTimeout.current = setTimeout(() => setFlashActive(false), 100);
  }

  function handleMarkUnsold() {
    if (soldState !== "pending") return;
    setSoldState("unsold");
    spawnParticles(PARTICLE_COLORS_UNSOLD);
  }

  function handleNextPlayer() {
    setSoldState("pending");
    setGlowActive(false);
    setQueue((prev) => prev.slice(1));
  }

  const blockLabel =
    soldState === "sold"
      ? "Auction Finalized"
      : soldState === "unsold"
      ? "Marked Unsold"
      : "Currently on Block";

  const currentPlayer = queue[0] ?? { name: "Virat Kohli", role: "BAT", country: "India" };

  return (
    <div
      className="bg-background text-on-background selection:bg-secondary-container selection:text-on-secondary-container overflow-hidden h-screen flex flex-col relative"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Font + global styles ── */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }
        .font-inter      { font-family: 'Inter', sans-serif; }

        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-style: normal; line-height: 1; display: inline-block;
          text-transform: none; letter-spacing: normal; user-select: none;
        }

        .glass-panel {
          background: rgba(16, 20, 21, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .custom-scrollbar::-webkit-scrollbar       { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        /* ── Particle ── */
        .auction-particle {
          position: fixed; pointer-events: none; z-index: 100;
          border-radius: 50%; width: 8px; height: 8px;
          animation-name: particle-fly;
          animation-timing-function: cubic-bezier(0.1, 0.8, 0.3, 1);
          animation-fill-mode: forwards;
        }
        @keyframes particle-fly {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }

        /* ── SOLD stamp ── */
        .auction-sold-stamp {
          transform: rotate(-13deg);
          animation: sold-land 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes sold-land {
          0%   { opacity: 0; transform: rotate(-13deg) scale(2.2); filter: blur(14px); }
          55%  { opacity: 1; filter: blur(0); }
          70%  { transform: rotate(-13deg) scale(0.96); }
          85%  { transform: rotate(-13deg) scale(1.02); }
          100% { transform: rotate(-13deg) scale(1); }
        }
        .sold-stamp-face {
          position: relative; padding: 20px 52px 18px;
          border: 4px solid #C9920A; border-radius: 4px;
          overflow: hidden; background: rgba(197,134,10,0.07);
        }
        .sold-inner-ring {
          position: absolute; inset: 5px;
          border: 1px solid rgba(201,146,10,0.32); border-radius: 2px;
          pointer-events: none; z-index: 1;
        }
        .sold-hatch-layer {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            108deg,
            transparent 0px, transparent 13px,
            rgba(245,180,0,0.07) 13px, rgba(245,180,0,0.07) 14px
          );
          pointer-events: none;
        }
        .sold-word {
          font-family: 'Archivo Narrow', sans-serif;
          font-size: 76px; font-weight: 700; font-style: italic;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: #F5B400; line-height: 1; display: block;
          position: relative; z-index: 2;
          text-shadow: 0 0 60px rgba(245,180,0,0.25);
        }
        .sold-dots {
          display: flex; gap: 6px; justify-content: center;
          margin-top: 8px; position: relative; z-index: 2;
        }
        .sold-dot {
          display: block; width: 5px; height: 5px; border-radius: 50%;
          background: rgba(245,180,0,0.45);
        }
        .sold-sub {
          display: block; text-align: center;
          font-family: 'Geist Mono', monospace;
          font-size: 9px; font-weight: 500;
          letter-spacing: 0.42em; text-transform: uppercase;
          color: rgba(245,180,0,0.6);
          margin-top: 8px; position: relative; z-index: 2;
        }
        .sold-bar {
          position: absolute; left: 0; right: 0; bottom: 0;
          height: 6px; background: #C9920A;
        }

        /* ── UNSOLD stamp ── */
        .auction-unsold-stamp {
          transform: rotate(13deg);
          animation: unsold-land 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
        }
        @keyframes unsold-land {
          0%   { opacity: 0; transform: rotate(13deg) scale(2.2); filter: blur(14px); }
          55%  { opacity: 1; filter: blur(0); }
          70%  { transform: rotate(13deg) scale(0.96); }
          85%  { transform: rotate(13deg) scale(1.02); }
          100% { transform: rotate(13deg) scale(1); }
        }
        .unsold-stamp-face {
          position: relative; padding: 20px 38px 18px;
          border: 4px solid #718096; border-radius: 4px;
          overflow: hidden; background: rgba(74,85,104,0.08);
        }
        .unsold-inner-ring {
          position: absolute; inset: 5px;
          border: 1px solid rgba(113,128,150,0.30); border-radius: 2px;
          pointer-events: none; z-index: 1;
        }
        .unsold-hatch-layer {
          position: absolute; inset: 0;
          background:
            repeating-linear-gradient(-45deg, transparent 0px, transparent 6px, rgba(113,128,150,0.08) 6px, rgba(113,128,150,0.08) 7px),
            repeating-linear-gradient( 45deg, transparent 0px, transparent 6px, rgba(113,128,150,0.05) 6px, rgba(113,128,150,0.05) 7px);
          pointer-events: none;
        }
        .cross-mark { position: absolute; width: 16px; height: 16px; z-index: 3; }
        .cross-h, .cross-v { position: absolute; background: rgba(113,128,150,0.65); border-radius: 1px; }
        .cross-h { width: 100%; height: 2px; top: 50%; transform: translateY(-50%); }
        .cross-v { height: 100%; width: 2px; left: 50%; transform: translateX(-50%); }
        .corner-tl { top: 8px;    left: 8px;    }
        .corner-tr { top: 8px;    right: 8px;   }
        .corner-bl { bottom: 8px; left: 8px;    }
        .corner-br { bottom: 8px; right: 8px;   }
        .unsold-word {
          font-family: 'Archivo Narrow', sans-serif;
          font-size: 58px; font-weight: 700; font-style: italic;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #A0AEC0; line-height: 1; display: block;
          position: relative; z-index: 2;
        }
        .unsold-sub {
          display: block; text-align: center;
          font-family: 'Geist Mono', monospace;
          font-size: 9px; font-weight: 500;
          letter-spacing: 0.35em; text-transform: uppercase;
          color: rgba(160,174,192,0.55);
          margin-top: 8px; position: relative; z-index: 2;
        }
      `}</style>

      {/* Particle burst layer */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="auction-particle"
          style={{
            left: "50%",
            top: "50%",
            backgroundColor: p.color,
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
            animationDuration: `${p.duration}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Flash overlay */}
      <div
        className={`fixed inset-0 pointer-events-none z-[60] transition-opacity duration-75 ${
          soldState === "sold"
            ? "bg-amber-400/10"
            : soldState === "unsold"
            ? "bg-slate-400/5"
            : "bg-white/0"
        } ${flashActive ? "opacity-100" : "opacity-0"}`}
      />

      {/* Radial glow */}
      <div
        className={`fixed inset-0 pointer-events-none z-[55] flex items-center justify-center transition-opacity duration-500 ${
          glowActive ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{
            background:
              soldState === "sold"
                ? "rgba(245,180,0,0.18)"
                : "rgba(113,128,150,0.12)",
          }}
        />
      </div>

      {/* ══════════ TOP BAR ══════════ */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 glass-panel border-b border-white/10">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-amber-400 text-3xl">
            sports_cricket
          </span>
          <h1 className="font-archivo text-2xl font-bold tracking-tighter text-on-background">
            APL <span className="text-amber-400">AUCTION</span>
          </h1>
          <div className="ml-8 flex items-center gap-3 px-4 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono-geist text-xs text-amber-400 uppercase font-bold tracking-[0.18em]">
              Live: Premier 2024
            </span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-on-surface-variant font-mono-geist">
            <span className="material-symbols-outlined text-sm">lock</span>
            <span className="uppercase tracking-[0.12em] text-[10px]">Secure Admin Node</span>
          </div>
          <button className="bg-error-container text-on-error-container px-6 py-2 rounded font-mono-geist font-bold hover:brightness-110 transition-all active:scale-95 border border-white/10 uppercase tracking-[0.2em] text-xs">
            End Session
          </button>
        </div>
      </header>

      <main className="mt-16 h-[calc(100vh-4rem)] overflow-hidden grid grid-cols-[20%_55%_25%]">

        {/* ══════════ LEFT SIDEBAR: Player Queue ══════════ */}
        <aside className="hidden xl:flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant shrink-0 overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-outline-variant">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl border-2 border-amber-400/30 p-0.5">
                <img
                  alt="Admin"
                  className="w-full h-full rounded-full object-cover"
                  src={PLAYER_IMAGE}
                />
              </div>
              <div>
                <p className="font-inter text-on-surface font-bold text-sm">Chief Auctioneer</p>
                <p className="font-mono-geist text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                  Admin Privileges
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <h3 className="font-mono-geist text-xs text-on-surface-variant uppercase font-bold tracking-[0.2em]">
                Next in Queue
              </h3>
              <span className="bg-surface-variant px-2 py-0.5 rounded font-mono-geist text-[10px] font-bold tracking-widest">
                {queue.length} PENDING
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {/* Active row */}
            <div className="p-4 bg-amber-400/10 border-l-4 border-amber-400 rounded-r flex items-center justify-between cursor-default">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-amber-400">play_circle</span>
                <div>
                  <p className="font-archivo text-sm font-bold uppercase text-on-surface">
                    {currentPlayer.name}
                  </p>
                  <p className="font-mono-geist text-[10px] text-on-surface-variant">
                    {currentPlayer.role} | {currentPlayer.country}
                  </p>
                </div>
              </div>
            </div>

            {queue.slice(1).map((p) => (
              <div
                key={p.id}
                className="p-4 hover:bg-white/5 rounded transition-all cursor-pointer group flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface transition-colors">
                    drag_handle
                  </span>
                  <div>
                    <p className="font-archivo text-sm font-bold uppercase text-on-surface-variant group-hover:text-on-surface">
                      {p.name}
                    </p>
                    <p className="font-mono-geist text-[10px] text-on-surface-variant">
                      {p.role} | {p.country}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ══════════ CENTER ══════════ */}
        <section className="flex flex-col h-full p-4 gap-4 overflow-hidden">

          {/* Hero: Current Player On Block */}
          <div
            className={`glass-panel rounded-2xl flex flex-col md:flex-row relative overflow-hidden group items-start transition-all duration-700 p-4 gap-4 ${
              soldState === "sold"
                ? "scale-[1.01] shadow-[0_0_80px_rgba(245,180,0,0.12)]"
                : soldState === "unsold"
                ? "scale-[1.01] shadow-[0_0_60px_rgba(113,128,150,0.1)]"
                : ""
            }`}
          >
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-amber-400/5 blur-[100px] rounded-full" />

            {soldState === "sold"   && <AuctionStamp state="sold"   />}
            {soldState === "unsold" && <AuctionStamp state="unsold" />}

            <div className="flex-1 flex flex-col md:flex-row gap-6 relative z-10 w-full items-start">
              <div className="relative group/img">
                <div className="w-64 h-64 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl relative">
                  <img
                    alt={currentPlayer.name}
                    className="w-full h-full object-cover grayscale-[0.2] group-hover/img:grayscale-0 transition-all duration-500"
                    src={PLAYER_IMAGE}
                  />
                  <div className="absolute top-2 right-2 z-20 bg-white text-black px-2 py-1 rounded font-mono-geist text-[10px] font-bold tracking-[0.32em] shadow-lg">
                    LOT #42
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full mt-3">
                  {soldState === "pending" && (
                    <>
                      <button
                        onClick={handleHammerSold}
                        className="flex items-center justify-center gap-1 py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-lg border border-white/10"
                        style={{
                          background: "linear-gradient(135deg,#C9920A,#F5B400)",
                          color: "#1a0e00",
                        }}
                      >
                        <span className="material-symbols-outlined text-sm">gavel</span>
                        Hammer Sold
                      </button>
                      <button
                        onClick={handleMarkUnsold}
                        className="flex items-center justify-center gap-1 bg-surface-variant text-on-surface-variant py-3 rounded-lg font-mono-geist text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-95 border border-white/5"
                      >
                        <span className="material-symbols-outlined text-sm">close</span> Mark Unsold
                      </button>
                    </>
                  )}

                  {soldState !== "pending" && (
                    <button
                      onClick={handleNextPlayer}
                      className="col-span-2 flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-xl"
                    >
                      Next Player{" "}
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <div className="space-y-1">
                  <span
                    className="font-mono-geist text-xs tracking-[0.3em] uppercase font-bold"
                    style={{
                      color:
                        soldState === "sold"
                          ? "#F5B400"
                          : soldState === "unsold"
                          ? "#718096"
                          : "#e45d35",
                    }}
                  >
                    {blockLabel}
                  </span>
                  <h2 className="font-archivo text-5xl text-white tracking-tight font-bold italic uppercase">
                    {currentPlayer.name}
                  </h2>
                  <div className="flex gap-4 items-center">
                    <span className="px-3 py-1 bg-white/10 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em]">
                      {currentPlayer.role} | {currentPlayer.country}
                    </span>
                    <span className="px-3 py-1 bg-white/10 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em]">
                      Base: ₹2.00 CR
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Bid Log */}
          <div className="flex-1 min-h-0 glass-panel rounded-2xl flex flex-col overflow-hidden bg-surface-container-lowest">
            <div className="px-8 py-5 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-mono-geist text-xs text-on-surface uppercase flex items-center gap-3 font-bold tracking-[0.2em]">
                <span className="material-symbols-outlined text-amber-400 text-lg">monitoring</span>
                Live Bidding Feed
              </h3>
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                <span className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.12em] font-bold">
                  Synchronized
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead className="sticky top-0 bg-surface-container-lowest/80 backdrop-blur-sm font-mono-geist text-[10px] text-on-surface-variant uppercase font-bold tracking-[0.1em]">
                  <tr>
                    <th className="px-6 py-4">Timeline</th>
                    <th className="px-6 py-4">Franchise</th>
                    <th className="px-6 py-4">Bid Amount</th>
                    <th className="px-6 py-4 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="font-mono-geist text-xs">
                  {bids.map((b) => (
                    <tr
                      key={b.id}
                      className="group hover:bg-white/5 transition-all text-on-surface-variant"
                    >
                      <td className="px-6 py-4 opacity-40">{b.time}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${b.color}`} />
                          <span className="font-archivo font-semibold">{b.team}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-archivo font-semibold">{b.amount}</td>
                      <td className="px-6 py-4 text-right opacity-40 italic font-inter text-[10px]">
                        Verifying...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ══════════ RIGHT SIDEBAR: Team Financials ══════════ */}
        <aside className="hidden lg:flex flex-col h-full bg-surface-container-low border-l border-outline-variant shrink-0 overflow-hidden">
          <div className="px-8 py-4 border-b border-outline-variant">
            <h3 className="font-mono-geist text-xs text-on-surface-variant uppercase font-bold tracking-[0.2em] mb-6">
              Financial Dashboard
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 glass-panel rounded-lg flex flex-col gap-1">
                <span className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.1em]">
                  Avg Purse
                </span>
                <span className="font-archivo text-lg font-bold text-on-surface leading-none">
                  ₹24.5C
                </span>
              </div>
              <div className="p-4 glass-panel rounded-lg flex flex-col gap-1">
                <span className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.1em]">
                  Slots Left
                </span>
                <span className="font-archivo text-lg font-bold text-on-surface leading-none">42</span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
            {TEAM_CARDS.map((team) => (
              <div
                key={team.id}
                className={`p-5 glass-panel rounded-xl transition-all relative overflow-hidden group ${
                  team.full
                    ? "opacity-50 grayscale cursor-not-allowed"
                    : "hover:border-amber-400/40 cursor-pointer"
                }`}
              >
                {team.full && <div className="absolute inset-0 bg-black/20 z-10" />}
                {team.full && (
                  <div className="absolute top-2 right-2 z-20 bg-error-container text-on-error-container px-2 py-0.5 rounded font-mono-geist text-[8px] font-bold tracking-[0.12em] uppercase">
                    Squad Full
                  </div>
                )}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${team.swatch} flex items-center justify-center font-bold shadow-lg text-sm ${
                        team.id === "csk" ? "text-black" : "text-white"
                      } font-archivo`}
                    >
                      {team.abbr}
                    </div>
                    <div>
                      <span className="block font-archivo text-sm font-bold text-on-surface uppercase leading-tight">
                        {team.name}
                      </span>
                      <span className="font-mono-geist text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.1em]">
                        Squad: {team.squad}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-amber-400 transition-colors">
                    {team.full ? "lock" : "open_in_new"}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between font-mono-geist text-[10px] uppercase tracking-[0.1em] font-bold">
                    <span className="text-on-surface-variant">Remaining Budget</span>
                    <span className="font-archivo text-[13px] font-semibold text-on-surface">
                      {team.remaining}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        team.full ? "bg-white/20" : ""
                      }`}
                      style={{
                        width: `${team.pctFilled}%`,
                        background: team.full
                          ? undefined
                          : "linear-gradient(90deg,#C9920A,#F5B400)",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Default export — wrapped with DesktopOnlyWrapper
// ─────────────────────────────────────────────
export default function AuctionAdminPage() {
  return (
    <DesktopOnlyWrapper>
      <AuctionAdminContent />
    </DesktopOnlyWrapper>
  );
}