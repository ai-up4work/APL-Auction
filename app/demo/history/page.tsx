"use client";
import React, { useState } from "react";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import BottomNavBar from "@/components/BottomNavBar";
import Image from "next/image";
import historyData from "@/public/history.json";

// ── style tokens ─────────────────────────────────────────────────────────────
const BG           = "#101415";
const CARD_BG      = "rgba(16, 20, 21, 0.6)";
const CARD_BORDER  = "1px solid rgba(255, 255, 255, 0.1)";
const ORANGE       = "#e45d35";
const ERROR        = "#ffb4ab";
const TEXT_WHITE   = "#e0e3e4";
const TEXT_DIM     = "#c6c6cd";
const TEXT_MUTED   = "rgba(198,198,205,0.6)";
const TEXT_BLUE    = "#dae2fd";
const TEXT_TERT    = "#d8e2ff";
const SURFACE_HIGH = "#272b2c";
const OUTLINE_VAR  = "#45464d";

const PAGE_SIZE = 5;

// Map JSON event type → dot color / glow
function dotProps(type: string) {
  switch (type) {
    case "BOUGHT":      return { dot: TEXT_BLUE,                   dotGlow: "0 0 8px rgba(218,226,253,0.5)" };
    case "OUTBID":      return { dot: ORANGE,                      dotGlow: undefined };
    case "BIDDING WAR": return { dot: "rgba(218,226,253,0.4)",     dotGlow: undefined };
    case "WITHDRAWN":   return { dot: ERROR,                       dotGlow: undefined };
    default:            return { dot: "#c6c6cd",                   dotGlow: undefined };
  }
}

// ── component ─────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const allEvents = historyData.events;
  const visibleEvents = allEvents.slice(0, visibleCount);
  const hasMore = visibleCount < allEvents.length;

  return (
    <MobileOnlyWrapper>
      <div style={{
        background: BG, color: TEXT_WHITE, minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        scrollbarWidth: "none",
      }}>
        <style>{`
          ::-webkit-scrollbar { display: none; }
          @keyframes pulseDot {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.8); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes pulseFade {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>

        {/* ── Top App Bar ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          background: BG,
          borderBottom: `1px solid ${OUTLINE_VAR}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px",
        }}>
          <span style={{
            fontFamily: "'Archivo Narrow', sans-serif",
            fontSize: 28, fontWeight: 700, color: TEXT_BLUE,
            letterSpacing: "-0.5px", textTransform: "uppercase",
          }}>APL AUCTION</span>
          <div style={{ display: "flex", gap: 16 }}>
            {["notifications", "settings"].map((icon) => (
              <span key={icon} className="material-symbols-outlined"
                style={{ color: TEXT_DIM, fontSize: 24, cursor: "pointer" }}>{icon}</span>
            ))}
          </div>
        </header>

        {/* ── Main ── */}
        <main style={{ padding: "24px 16px 100px", maxWidth: 512, margin: "0 auto" }}>

          {/* ── Screen Title ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h1 style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: 24, fontWeight: 600, color: TEXT_WHITE,
                letterSpacing: "-0.2px", textTransform: "uppercase", margin: 0,
              }}>AUCTION HISTORY</h1>
              <p style={{
                fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
                textTransform: "uppercase", color: TEXT_DIM,
                marginTop: 4, marginBottom: 0,
              }}>Live Activity Log</p>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: SURFACE_HIGH, borderRadius: 99,
              padding: "4px 12px", border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: ORANGE, display: "inline-block",
                animation: "pulseDot 2s infinite",
              }} />
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: TEXT_WHITE,
              }}>Live</span>
            </div>
          </div>

          {/* ── Summary Stats ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
            <div style={{
              background: CARD_BG, border: CARD_BORDER,
              borderLeft: `2px solid ${ORANGE}`,
              borderRadius: 12, padding: 16,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_DIM }}>
                Total Bids Placed
              </span>
              <span style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: 40, fontWeight: 700, color: TEXT_WHITE,
                lineHeight: 1, marginTop: 8,
              }}>{String(historyData.stats.totalBids).padStart(2, "0")}</span>
            </div>
            <div style={{
              background: CARD_BG, border: CARD_BORDER,
              borderLeft: `2px solid ${TEXT_BLUE}`,
              borderRadius: 12, padding: 16,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_DIM }}>
                Successful Wins
              </span>
              <span style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: 40, fontWeight: 700, color: TEXT_BLUE,
                lineHeight: 1, marginTop: 8,
              }}>{String(historyData.stats.successfulWins).padStart(2, "0")}</span>
            </div>
          </div>

          {/* ── Timeline ── */}
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute", left: 20, top: 0, bottom: 0,
              width: 1, background: "rgba(255,255,255,0.05)", zIndex: 0,
            }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {visibleEvents.map((ev, i) => {
                const { dot, dotGlow } = dotProps(ev.type);
                return (
                  <div key={i} style={{ position: "relative", paddingLeft: 48 }}>
                    <div style={{
                      position: "absolute", left: 14, top: 8,
                      width: 12, height: 12, borderRadius: "50%",
                      background: dot,
                      border: `2px solid ${BG}`,
                      zIndex: 1,
                      boxShadow: dotGlow,
                    }} />
                    <EventCard ev={ev} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Load More / All Loaded ── */}
          {hasMore ? (
            <button
              onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, allEvents.length))}
              style={{
                width: "100%", padding: "16px 0", marginTop: 32,
                background: CARD_BG, border: CARD_BORDER,
                borderRadius: 12, cursor: "pointer",
                fontFamily: "'Geist', monospace",
                fontSize: 14, fontWeight: 500, letterSpacing: "0.05em",
                color: TEXT_DIM,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              LOAD OLDER EVENTS
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>expand_more</span>
            </button>
          ) : (
            <div style={{
              width: "100%", padding: "16px 0", marginTop: 32,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
              <span style={{
                fontFamily: "'Geist', monospace", fontSize: 10,
                letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_MUTED,
              }}>All events loaded</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            </div>
          )}
        </main>

        <BottomNavBar />
      </div>
    </MobileOnlyWrapper>
  );
}

// ── Event Card ────────────────────────────────────────────────────────────────
type RawEvent = typeof historyData.events[number];

function EventCard({ ev }: { ev: RawEvent }) {
  if (ev.type === "BOUGHT") {
    return (
      <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)",
              background: "#313536", flexShrink: 0, position: "relative",
            }}>
              {ev.img && <Image src={ev.img} alt={ev.name} fill style={{ objectFit: "cover" }} referrerPolicy="no-referrer" />}
            </div>
            <div>
              <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: TEXT_WHITE, margin: 0 }}>{ev.name}</h3>
              <p style={{ fontSize: 10, color: TEXT_DIM, margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.sub}</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontFamily: "'Geist', monospace", fontSize: 14, fontWeight: 500, color: TEXT_BLUE, letterSpacing: "0.05em" }}>{ev.price}</span>
            <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.time}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <span style={{
            padding: "4px 8px", borderRadius: 99,
            background: "rgba(218,226,253,0.1)", border: "1px solid rgba(218,226,253,0.2)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: TEXT_BLUE,
          }}>BOUGHT</span>
          <span style={{
            padding: "4px 8px", borderRadius: 99,
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
            fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", color: "#4ade80",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            ACQUIRED
          </span>
        </div>
      </div>
    );
  }

  if (ev.type === "OUTBID") {
    return (
      <div style={{
        background: CARD_BG, border: CARD_BORDER,
        borderLeft: "4px solid rgba(228,93,53,0.5)",
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE }}>{ev.type}</span>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: TEXT_WHITE, margin: "4px 0 0" }}>{ev.name}</h3>
            <p style={{ fontSize: 10, color: TEXT_DIM, margin: "2px 0 0", fontStyle: "italic" }}>{ev.sub}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontFamily: "'Geist', monospace", fontSize: 14, fontWeight: 500, color: TEXT_DIM, letterSpacing: "0.05em" }}>{ev.price}</span>
            <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.time}</p>
          </div>
        </div>
      </div>
    );
  }

  if (ev.type === "UNSOLD") {
    return (
      <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: 16, opacity: 0.7 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_DIM }}>{ev.type}</span>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: TEXT_WHITE, margin: "4px 0 0" }}>{ev.name}</h3>
            <p style={{ fontSize: 10, color: TEXT_DIM, margin: "2px 0 0" }}>{ev.sub}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontFamily: "'Geist', monospace", fontSize: 14, fontWeight: 500, color: TEXT_DIM, letterSpacing: "0.05em" }}>{ev.price}</span>
            <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.time}</p>
          </div>
        </div>
      </div>
    );
  }

  if (ev.type === "BIDDING WAR") {
    return (
      <div style={{ background: "rgba(24,28,29,0.3)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_TERT }}>{ev.type}</span>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: TEXT_WHITE, margin: "4px 0 0" }}>{ev.name}</h3>
            <p style={{ fontSize: 10, color: TEXT_DIM, margin: "2px 0 0", fontStyle: "italic" }}>{ev.sub}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{
              fontFamily: "'Geist', monospace", fontSize: 14, fontWeight: 500,
              color: TEXT_BLUE, letterSpacing: "0.05em",
              animation: "pulseFade 2s infinite", display: "inline-block",
            }}>{ev.price}</span>
            <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.time}</p>
          </div>
        </div>
      </div>
    );
  }

  // WITHDRAWN
  return (
    <div style={{
      background: CARD_BG, border: CARD_BORDER,
      borderLeft: "4px solid rgba(255,180,171,0.3)",
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: ERROR }}>{ev.type}</span>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: TEXT_WHITE, margin: "4px 0 0" }}>{ev.name}</h3>
          <p style={{ fontSize: 10, color: TEXT_DIM, margin: "2px 0 0" }}>{ev.sub}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontFamily: "'Geist', monospace", fontSize: 14, fontWeight: 500, color: "rgba(255,180,171,0.6)", letterSpacing: "0.05em" }}>{ev.price}</span>
          <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.time}</p>
        </div>
      </div>
    </div>
  );
}

//nothing