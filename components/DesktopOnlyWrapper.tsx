"use client";

/**
 * DesktopOnlyWrapper
 *
 * Shows the auction admin page only on desktop/laptop (lg = 1024px+).
 * On mobile phones and tablets (< 1024px) it renders a full-screen
 * blocker styled to match the Moon Knight Super League Auction UI.
 *
 * Usage:
 *   <DesktopOnlyWrapper>
 *     <AuctionAdminPage />
 *   </DesktopOnlyWrapper>
 */

import React, { useEffect, useRef } from "react";

// ─────────────────────────────────────────────
//  Icon font utility strings
// ─────────────────────────────────────────────
const MSYM =
  "font-['Material_Symbols_Outlined'] not-italic normal-case leading-none " +
  "tracking-normal inline-block whitespace-nowrap antialiased [direction:ltr] " +
  "[font-feature-settings:'liga'] " +
  "[font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_24]";

const MSYM_FILLED =
  "font-['Material_Symbols_Outlined'] not-italic normal-case leading-none " +
  "tracking-normal inline-block whitespace-nowrap antialiased [direction:ltr] " +
  "[font-feature-settings:'liga'] " +
  "[font-variation-settings:'FILL'_1,'wght'_400,'GRAD'_0,'opsz'_24]";

// ─────────────────────────────────────────────
//  Blocker shown on phones & tablets (< 1024px)
// ─────────────────────────────────────────────
function PhoneTabletBlocker({ auctionName, auctionLogo }: { auctionName?: string; auctionLogo?: string | null }) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Subtle touch-parallax glow
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const r = card.getBoundingClientRect();
      const x = touch.clientX - r.left;
      const y = touch.clientY - r.top;
      card.style.boxShadow =
        `0 10px 40px -10px rgba(0,0,0,0.5), ` +
        `${x / 12}px ${y / 12}px 80px -40px rgba(201,151,31,0.12)`;
    };
    document.addEventListener("touchmove", onMove, { passive: true });
    return () => document.removeEventListener("touchmove", onMove);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;600;700&family=Inter:wght@400;500&family=Geist+Mono:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap');

        @keyframes apl-blob {
          0%, 100% { opacity: 0.08; filter: blur(60px); }
          50%       { opacity: 0.16; filter: blur(80px); }
        }
        @keyframes apl-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes apl-ping {
          0%        { transform: scale(1); opacity: 0.8; }
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Root: fixed full-screen, dark navy background matching the admin page */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
        style={{ background: "#0c0f17", color: "#e3e6ef", fontFamily: "'Inter', sans-serif" }}
      >
        {/* ── Atmospheric blobs ── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className="absolute -top-[20%] -right-[15%] w-[70vw] h-[70vw] rounded-full"
            style={{ background: "#A87815", animation: "apl-blob 4s ease-in-out infinite" }}
          />
          <div
            className="absolute -bottom-[20%] -left-[15%] w-[80vw] h-[80vw] rounded-full"
            style={{ background: "#5c3d00", animation: "apl-blob 4s ease-in-out infinite 1.2s" }}
          />
        </div>

        {/* ── Header ── */}
        <header
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center"
          style={{
            height: "clamp(56px,8vw,64px)",
            background: "rgba(13,17,23,0.65)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-3">
            <img
              src={auctionLogo || "/moon-knight-logo.png"}
              alt="Auction logo"
              style={{ height: "clamp(45px,6vw,36px)", width: "auto", objectFit: "cover" }}
            />
            <h1
              className="m-0 font-bold uppercase tracking-[0.04em] text-white"
              style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: "clamp(18px,4.5vw,24px)",
              }}
            >
              {auctionName ?? "Auction"}
            </h1>
          </div>
        </header>

        {/* ── Main ── */}
        <main
          className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-5 pb-16"
          style={{ paddingTop: "clamp(72px,10vw,80px)" }}
        >
          {/* Card */}
          <div
            ref={cardRef}
            className="relative w-full flex flex-col items-center gap-6 rounded-2xl transition-shadow duration-300"
            style={{
              maxWidth: 480,
              padding: "clamp(24px,6vw,36px) clamp(20px,5vw,32px)",
              background: "rgba(13,17,23,0.65)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Ambient inner glow */}
            <div
              className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full"
              style={{ background: "rgba(201,151,31,0.07)", filter: "blur(32px)" }}
            />

            {/* Monitor illustration */}
            <div className="relative flex-shrink-0" style={{ marginTop: 8 }}>
              {/* Spinning dashed ring */}
              <div
                className="absolute rounded-[22px]"
                style={{
                  inset: -10,
                  border: "1.5px dashed rgba(201,151,31,0.28)",
                  animation: "apl-spin 24s linear infinite",
                }}
              />
              {/* Monitor body */}
              <div
                className="relative flex flex-col overflow-hidden"
                style={{
                  width: "clamp(130px,32vw,160px)",
                  height: "clamp(96px,24vw,118px)",
                  background: "#0d1117",
                  border: "3px solid #2a2f3d",
                  borderRadius: 12,
                }}
              >
                {/* Title bar */}
                <div
                  className="flex items-center justify-end gap-1 px-2 flex-shrink-0"
                  style={{ height: 16, background: "#141925", borderBottom: "1px solid #232838" }}
                >
                  <div className="w-[5px] h-[5px] rounded-full" style={{ background: "#3c4256" }} />
                  <div className="w-[5px] h-[5px] rounded-full" style={{ background: "#3c4256" }} />
                  <div className="w-[5px] h-[5px] rounded-full" style={{ background: "#c9971f" }} />
                </div>
                {/* Screen content */}
                <div
                  className="flex flex-1 flex-col items-center justify-center gap-2 p-3"
                  style={{ background: "linear-gradient(135deg,#181d29,#0c0f17)" }}
                >
                  <span
                    className={MSYM}
                    style={{ color: "#c9971f", fontSize: "clamp(22px,5vw,28px)" }}
                  >
                    desktop_windows
                  </span>
                  <div
                    className="rounded-full"
                    style={{ width: "60%", height: 3, background: "rgba(201,151,31,0.3)" }}
                  />
                  <div
                    className="rounded-full"
                    style={{ width: "40%", height: 2, background: "rgba(255,255,255,0.1)" }}
                  />
                </div>
              </div>
              {/* Stand */}
              <div
                className="mx-auto rounded-b"
                style={{ width: 34, height: 10, background: "#2a2f3d" }}
              />
              <div
                className="mx-auto rounded"
                style={{ width: 56, height: 4, background: "#3c4256" }}
              />
            </div>

            {/* Live badge */}
            <div
              className="flex items-center gap-2 rounded-full"
              style={{
                padding: "5px 14px",
                background: "rgba(168,120,21,0.18)",
                border: "1px solid rgba(201,151,31,0.2)",
              }}
            >
              <span className="relative flex" style={{ width: 8, height: 8 }}>
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "#c9971f",
                    animation: "apl-ping 1.4s cubic-bezier(0,0,.2,1) infinite",
                  }}
                />
                <span
                  className="relative block w-full h-full rounded-full"
                  style={{ background: "#c9971f" }}
                />
              </span>
              <span
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "#c9971f",
                }}
              >
                Desktop Only
              </span>
            </div>

            {/* Heading + description */}
            <div className="text-center" style={{ marginTop: -4 }}>
              <h2
                className="m-0 font-bold uppercase text-white"
                style={{
                  fontFamily: "'Archivo Narrow', sans-serif",
                  fontSize: "clamp(26px,7vw,34px)",
                  letterSpacing: "0.02em",
                  lineHeight: 1.18,
                }}
              >
                OPEN ON A<br />
                <span style={{ color: "#c9971f" }}>LARGER SCREEN</span>
              </h2>
              <p
                className="mt-3 mb-0"
                style={{
                  color: "#9aa1b5",
                  fontSize: "clamp(13px,3.2vw,14px)",
                  lineHeight: 1.65,
                }}
              >
                The {auctionName ?? "Auction"} Admin Console is a multi-column,
                data-dense environment built for desktop and laptop screens (1024px+).
                Please switch to a computer to access the live auction controls.
              </p>
            </div>

            {/* Requirement pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { icon: "monitor",      label: "Laptop / Desktop" },
                { icon: "open_in_full", label: "≥ 1024 px wide"   },
                { icon: "mouse",        label: "Pointer device"    },
              ].map(({ icon, label }) => (
                <div
                  key={icon}
                  className="flex items-center gap-2 rounded"
                  style={{
                    padding: "6px 12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span className={MSYM} style={{ color: "#c9971f", fontSize: 14 }}>
                    {icon}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#9aa1b5",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bento info cards */}
          <div
            className="w-full grid gap-3"
            style={{ maxWidth: 480, gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            {[
              {
                icon: "gavel",
                title: "Live bidding",
                desc: "3-panel layout needs a wide viewport to run correctly.",
              },
              {
                icon: "monitoring",
                title: "Real-time feed",
                desc: "Bid log, stamps and queue display side-by-side.",
              },
              {
                icon: "admin_panel_settings",
                title: "Admin controls",
                desc: "Hammer and queue controls need precise pointer input.",
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={icon}
                className="flex flex-col gap-2 rounded-xl"
                style={{
                  padding: "clamp(12px,3vw,16px)",
                  background: "rgba(13,17,23,0.6)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <span className={MSYM_FILLED} style={{ color: "#c9971f", fontSize: 20 }}>
                  {icon}
                </span>
                <h4
                  className="m-0 text-white"
                  style={{
                    fontFamily: "'Archivo Narrow', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {title}
                </h4>
                <p style={{ margin: 0, fontSize: 11, color: "#9aa1b5", lineHeight: 1.55 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </main>

        {/* ── Footer ── */}
        <footer
          className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between"
          style={{
            height: 48,
            padding: "0 clamp(16px,4vw,28px)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(13,17,23,0.85)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(154,161,181,0.55)",
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, background: "#22c55e" }}
            />
            Auction Node: Operational
          </div>
          <div
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(154,161,181,0.35)",
            }}
          >
            © 2024 {auctionName ?? "Auction"} · Admin Console V4.2
          </div>
        </footer>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
//  DesktopOnlyWrapper — exported component
// ─────────────────────────────────────────────
/**
 * Wrap any page with this to gate it behind a desktop check.
 *
 *   < lg  (< 1024px)  →  PhoneTabletBlocker (full-screen warning)
 *   ≥ lg  (≥ 1024px)  →  children rendered normally
 */
export default function DesktopOnlyWrapper({
  children,
  auctionName,
}: {
  children: React.ReactNode;
  auctionName?: string;
}) {
  return (
    <>
      {/* Mobile + tablet (< 1024px): show blocker */}
      <div className="block lg:hidden">
        <PhoneTabletBlocker auctionName={auctionName} />
      </div>

      {/* Desktop / laptop (≥ 1024px): render the real page */}
      <div className="hidden lg:block w-full min-h-screen">
        {children}
      </div>
    </>
  );
}