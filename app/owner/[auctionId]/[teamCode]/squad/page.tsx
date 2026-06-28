"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import BottomNavBar from "@/components/BottomNavBar";
import squadData from "@/public/squad.json";

const { playersBought, totalSlots, slotsRemaining, nextPickCountdown, composition, players } =
  squadData.squad;

const progressPct = (playersBought / totalSlots) * 100;

// ── tiny style helpers ──────────────────────────────────────────────────────
const CARD_BG        = "rgba(16, 20, 21, 0.6)";
const CARD_BG_GLASS  = "rgba(16, 20, 21, 0.6)";
const CARD_BORDER    = "1px solid rgba(255,255,255,0.07)";
const ORANGE         = "#e45d35";
const TEXT_DIM       = "#7a7d88";
const TEXT_MID       = "#9a9aa3";
const TEXT_WHITE     = "#e8ecf0";
const TEXT_BLUE      = "#dae2fd";

export default function SquadPage() {
  const [bright, setBright] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBright((p) => !p), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <MobileOnlyWrapper>
      <div style={{ background: "#101415", color: "#e0e3e4", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>

        {/* ── Top App Bar ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "#101415",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "#8b2200",
              boxShadow: "0 0 18px rgba(228,93,53,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1", fontSize: 20, color: "#fff" }}
              >stars</span>
            </div>
            <span style={{
              fontFamily: "'Archivo Narrow', sans-serif",
              fontSize: 26, fontWeight: 700, color: TEXT_BLUE,
              letterSpacing: "-0.5px", textTransform: "uppercase",
            }}>MY SQUAD</span>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {["notifications", "settings"].map((icon) => (
              <span key={icon} className="material-symbols-outlined"
                style={{ color: TEXT_MID, fontSize: 24 }}>{icon}</span>
            ))}
          </div>
        </header>

        {/* ── Scroll body ── */}
        <main style={{ padding: "14px 14px 100px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ── Players Bought Card (glass bg, left border only) ── */}
          <div style={{
            background: CARD_BG_GLASS,
            borderTop: `1px solid ${ORANGE}`,
            borderRight: `1px solid ${ORANGE}`,
            borderBottom: `1px solid ${ORANGE}`,
            borderLeft: `4px solid ${ORANGE}`,
            borderRadius: 14,
            padding: "18px 18px 16px",
          }}>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11, fontWeight: 600,
              letterSpacing: "0.13em", textTransform: "uppercase",
              color: TEXT_MID, marginBottom: 6,
            }}>Players Bought</p>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <span style={{
                  fontFamily: "'Archivo Narrow', sans-serif",
                  fontSize: 68, fontWeight: 700, color: TEXT_BLUE, lineHeight: 1,
                }}>{playersBought}</span>
                <span style={{
                  fontFamily: "'Archivo Narrow', sans-serif",
                  fontSize: 28, fontWeight: 600, color: "#6b6e7a",
                }}>/{totalSlots}</span>
              </div>

              {/* Rounded-square spinner */}
              <div style={{
                width: 54, height: 54, borderRadius: 14,
                border: "2.5px solid rgba(228,93,53,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 4,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  border: "2px solid transparent",
                  borderTopColor: ORANGE,
                  animation: "squadSpin 1.2s linear infinite",
                }} />
              </div>
            </div>

            {/* Progress bar */}
            <div style={{
              marginTop: 14, background: "#272b2c",
              borderRadius: 99, height: 5, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 99, background: ORANGE,
                width: `${progressPct}%`,
                boxShadow: "0 0 8px rgba(228,93,53,0.5)",
              }} />
            </div>
          </div>

          {/* ── Composition 2×2 grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {composition.map(({ label, icon, value }: { label: string; icon: string; value: number | string }) => (
              <div key={label} style={{
                background: CARD_BG, border: CARD_BORDER,
                borderRadius: 12, padding: "14px 14px 12px",
              }}>
                <p style={{
                  fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: TEXT_DIM, marginBottom: 8,
                }}>{label}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span className="material-symbols-outlined"
                    style={{ color: ORANGE, fontSize: 17 }}>{icon}</span>
                  <span style={{
                    fontFamily: "'Archivo Narrow', sans-serif",
                    fontSize: 30, fontWeight: 700, color: TEXT_WHITE, lineHeight: 1,
                  }}>{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Section header ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              fontFamily: "'Archivo Narrow', sans-serif",
              fontSize: 18, fontWeight: 700, textTransform: "uppercase",
              color: TEXT_WHITE, letterSpacing: "-0.2px",
            }}>Recent Acquisitions</span>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
              textTransform: "uppercase", color: TEXT_MID,
              background: "#242829", border: CARD_BORDER,
              borderRadius: 6, padding: "4px 9px",
            }}>Sort by: Price</span>
          </div>

          {/* ── Player Cards ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {players.map(({ name, role, origin, price, img, alt }: {
              name: string; role: string; origin: string;
              price: string; img: string; alt: string;
            }) => (
              <div key={name} style={{
                background: CARD_BG, border: CARD_BORDER,
                borderRadius: 12, overflow: "hidden",
                display: "flex", height: 108,
              }}>
                {/* Photo */}
                <div style={{ width: 90, height: "100%", position: "relative", flexShrink: 0, overflow: "hidden" }}>
                  <Image src={img} alt={alt} fill
                    style={{ objectFit: "cover", objectPosition: "top center" }}
                    referrerPolicy="no-referrer"
                  />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to right, transparent 40%, #161b1c 100%)",
                  }} />
                </div>

                {/* Info */}
                <div style={{
                  flex: 1, padding: "13px 14px",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  minWidth: 0,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Archivo Narrow', sans-serif",
                        fontSize: 19, fontWeight: 700, color: TEXT_WHITE,
                        lineHeight: 1.1, textTransform: "uppercase",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{name}</div>
                      <div style={{
                        fontSize: 10, fontWeight: 600,
                        letterSpacing: "0.1em", textTransform: "uppercase",
                        color: ORANGE, marginTop: 3,
                      }}>{role} · {origin}</div>
                    </div>
                    <span className="material-symbols-outlined"
                      style={{ fontSize: 18, color: "#3d4047", flexShrink: 0 }}>verified</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, letterSpacing: "0.09em",
                      textTransform: "uppercase", color: TEXT_DIM,
                    }}>Sold for</span>
                    <span style={{
                      fontFamily: "'Archivo Narrow', sans-serif",
                      fontSize: 24, fontWeight: 700, color: TEXT_BLUE,
                    }}>{price}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty state */}
            <div style={{
              border: "1.5px dashed rgba(255,255,255,0.15)",
              borderRadius: 14, padding: "32px 20px",
              display: "flex", flexDirection: "column",
              alignItems: "center", textAlign: "center", gap: 8,
            }}>
              <span className="material-symbols-outlined"
                style={{ fontSize: 38, color: "#6b6e7a" }}>person_add</span>
              <p style={{ fontSize: 14, color: TEXT_MID, lineHeight: 1.6 }}>
                {slotsRemaining} Slots remaining in squad.<br />
                Next pick in{" "}
                <span style={{
                  color: ORANGE, fontWeight: 700,
                  opacity: bright ? 1 : 0.55,
                  transition: "opacity 0.3s",
                }}>{nextPickCountdown}</span>
              </p>
            </div>
          </div>
        </main>

        <style>{`@keyframes squadSpin { to { transform: rotate(360deg); } }`}</style>

        <BottomNavBar />
      </div>
    </MobileOnlyWrapper>
  );
}