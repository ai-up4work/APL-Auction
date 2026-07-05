"use client";

import { Trophy, MapPin, Clock3, Swords } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// ---- Hardcoded match data ----
// Team art is hardcoded here (icon + colors) rather than generated from
// initials, so each side reads as a distinct, fixed identity.
const TEAM_A = {
  name: "COASTAL SHARKS",
  short: "CS",
  image: "/Franchises/CSK.png",
  color: "#3B8BD4", // aplBlue
  colorSoft: "rgba(59,139,212,0.22)",
};

const TEAM_B = {
  name: "DESERT FALCONS",
  short: "DF",
  image: "/Franchises/RCB.png",
  color: "#2A9D5C", // aplGreen
  colorSoft: "rgba(42,157,92,0.2)",
};

const TOURNAMENT = {
  name: "MOON KNIGHT CUP",
  edition: "SEASON 7 · T20",
  logo: "/moon-knight-logo.png",
};

const MATCH_META = {
  venue: "Meridian Stadium",
  format: "20 OVERS",
  time: "19:30 LOCAL",
};

export default function CricketMatchIntro() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const targetRef = useRef(Date.now() + 2 * 60 * 60 * 1000 + 14 * 60 * 1000); // 2h14m from load

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Trigger Button — also toggles closed, since the panel no longer
          has its own close control */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{ color: "var(--color-on-surface-variant)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-theme-orange)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-on-surface-variant)")}
      >
        <Trophy className="w-5 h-5" />
        <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">
          Match Center
        </span>
        <span
          className="absolute -top-1 -right-1 h-3 w-3 rounded-full animate-pulse"
          style={{
            background: "var(--color-theme-orange)",
            boxShadow: "0 0 10px 2px var(--color-bid-glow)",
          }}
        />
      </button>

      {mounted &&
        isOpen &&
        createPortal(
          <>
            {/* Backdrop — click anywhere outside the card to dismiss */}
            <div
              className="fixed inset-0 backdrop-blur-sm z-[100] animate-fadeIn"
              style={{ background: "rgba(0,0,0,0.8)" }}
              onClick={() => setIsOpen(false)}
            />

            {/* Panel container — covers a region of the screen, not the whole viewport */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-4xl animate-systemAppear relative">
                {/* Ambient glow behind the card — gold-led, team colors kept subtle */}
                <div
                  className="absolute -inset-6 blur-3xl rounded-[40px]"
                  style={{
                    background: `linear-gradient(90deg, ${TEAM_A.colorSoft}, rgba(201,151,31,0.16), ${TEAM_B.colorSoft})`,
                  }}
                />

                {/* Border layer — thin gradient frame via padding trick */}
                <div
                  className="relative p-[1.5px] rounded-[28px] shadow-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(201,151,31,0.4), var(--color-border-overlay), rgba(201,151,31,0.4))",
                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
                  }}
                >
                  {/* Content layer */}
                  <div
                    className="relative rounded-[26px] overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-container-lowest) 100%)",
                    }}
                  >
                    {/* Localized glows behind each team side */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 18% 55%, ${TEAM_A.colorSoft} 0%, transparent 32%), radial-gradient(circle at 82% 55%, ${TEAM_B.colorSoft} 0%, transparent 32%)`,
                      }}
                    />

                    {/* Header — tournament identity centered like a crest banner,
                        flanked by hairlines instead of split into unrelated
                        left/right chips. No close/broadcast chip clutter. */}
                    <div
                      className="relative z-10 flex items-center justify-center gap-4 pt-7 pb-5 px-6 sm:px-10"
                      style={{ borderBottom: "1px solid var(--color-border-overlay)" }}
                    >
                      <div
                        className="hidden sm:block h-px flex-1"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent, rgba(201,151,31,0.5))",
                        }}
                      />
                      <div className="flex items-center gap-3 shrink-0">                       
                        <div className="leading-tight text-center">
                          <p
                            className="font-heading font-black text-sm sm:text-lg tracking-wide"
                            style={{ color: "var(--color-on-surface)" }}
                          >
                            {TOURNAMENT.name}
                          </p>
                          <p
                            className="text-[9px] font-bold tracking-[0.3em] uppercase"
                            style={{ color: "var(--color-theme-orange)" }}
                          >
                            {TOURNAMENT.edition}
                          </p>
                        </div>
                      </div>
                      <div
                        className="hidden sm:block h-px flex-1"
                        style={{
                          background:
                            "linear-gradient(90deg, rgba(201,151,31,0.5), transparent)",
                        }}
                      />
                    </div>

                    {/* VS Section — sized with a real min-height so the emblem
                        watermark has room to sit fully inside the rounded card
                        instead of being clipped by it. */}
                    <div className="relative min-h-[300px] sm:min-h-[400px] flex items-center justify-center gap-8 sm:gap-24 px-4 py-6">
                      {/* Emblem watermark — scoped to this section so object-contain
                          sizes it against real available space and it never gets
                          cropped by the card's rounded corners. */}
                      <div
                        className="absolute inset-0 sm:-inset-2 flex items-center justify-center pointer-events-none select-none"
                        aria-hidden="true"
                      >
                        <img
                          src={TOURNAMENT.logo}
                          alt=""
                          className="w-full h-full object-contain"
                          style={{
                            opacity: 0.16,
                            filter: "grayscale(1) contrast(1.1) brightness(1.3)",
                          }}
                        />
                      </div>

                      {/* Team A */}
                      <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="relative">
                          <div
                            className="absolute -inset-4 rounded-full blur-xl"
                            style={{ background: TEAM_A.colorSoft }}
                          />
                          <div className="shine-ring shine-ring-blue" />
                          {/* Metal bezel — layered rings simulate a struck coin/medallion:
                              outer dark ring, brushed-metal gradient, inner shadow, and a
                              soft top-lit gloss so the badge reads as an object, not a flat crop. */}
                          <div
                            className="relative w-36 h-36 sm:w-48 sm:h-48 rounded-full p-[3px] shadow-2xl"
                            style={{
                              background:
                                "linear-gradient(145deg, var(--color-surface-container-high) 0%, var(--color-outline) 45%, var(--color-surface-container-lowest) 100%)",
                            }}
                          >
                            <div className="relative w-full h-full rounded-full overflow-hidden bg-black">
                              <img
                                src={TEAM_A.image}
                                alt={TEAM_A.name}
                                className="w-full h-full object-cover"
                              />
                              {/* gloss highlight */}
                              <div
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{
                                  background:
                                    "linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 30%, transparent 55%)",
                                }}
                              />
                              <div
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{ boxShadow: "inset 0 -6px 10px rgba(0,0,0,0.45)" }}
                              />
                            </div>
                          </div>                         
                        </div>
                        <div className="flex flex-col items-center mt-1">
                          <span
                            className="font-heading font-extrabold text-xs sm:text-base tracking-wide text-center leading-tight"
                            style={{ color: "var(--color-on-surface)" }}
                          >
                            {TEAM_A.name}
                          </span>
                          <div
                            className="h-[2px] w-full mt-1.5"
                            style={{ background: `linear-gradient(90deg, ${TEAM_A.color}, transparent)` }}
                          />
                        </div>
                      </div>

                      {/* VS diamond — gold-led so it reads as the focal point,
                          instead of navy-on-navy which barely registered */}
                      <div className="relative z-10 shrink-0">
                        <div
                          className="absolute -inset-2 rounded-lg blur-md rotate-45"
                          style={{ background: "rgba(201,151,31,0.35)" }}
                        />
                        <div
                          className="relative w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center rounded-lg transform rotate-45"
                          style={{
                            background:
                              "linear-gradient(135deg, var(--color-theme-orange) 0%, #8a6d1f 100%)",
                            border: "2px solid rgba(255,255,255,0.25)",
                            boxShadow:
                              "0 0 28px rgba(201,151,31,0.5), inset 0 0 10px rgba(255,255,255,0.15)",
                          }}
                        >
                          <span
                            className="font-heading text-base sm:text-xl font-black italic -rotate-45 tracking-tighter"
                            style={{ color: "var(--color-surface-container-lowest)" }}
                          >
                            VS
                          </span>
                        </div>
                      </div>

                      {/* Team B */}
                      <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="relative">
                          <div
                            className="absolute -inset-4 rounded-full blur-xl"
                            style={{ background: TEAM_B.colorSoft }}
                          />
                          <div className="shine-ring shine-ring-green" />
                          <div
                            className="relative w-36 h-36 sm:w-48 sm:h-48 rounded-full p-[3px] shadow-2xl"
                            style={{
                              background:
                                "linear-gradient(145deg, var(--color-surface-container-high) 0%, var(--color-outline) 45%, var(--color-surface-container-lowest) 100%)",
                            }}
                          >
                            <div className="relative w-full h-full rounded-full overflow-hidden bg-black">
                              <img
                                src={TEAM_B.image}
                                alt={TEAM_B.name}
                                className="w-full h-full object-cover"
                              />
                              <div
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{
                                  background:
                                    "linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 30%, transparent 55%)",
                                }}
                              />
                              <div
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{ boxShadow: "inset 0 -6px 10px rgba(0,0,0,0.45)" }}
                              />
                            </div>
                          </div>                        
                        </div>
                        <div className="flex flex-col items-center mt-1">
                          <span
                            className="font-heading font-extrabold text-xs sm:text-base tracking-wide text-center leading-tight"
                            style={{ color: "var(--color-on-surface)" }}
                          >
                            {TEAM_B.name}
                          </span>
                          <div
                            className="h-[2px] w-full mt-1.5"
                            style={{ background: `linear-gradient(90deg, transparent, ${TEAM_B.color})` }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Footer — ticket stub. Compartment gets its own faint paper tint so it 
                        reads as a separate piece of stock, and its print switches to monospace 
                        (real ticket printers are always dot-matrix/monospace, never a display face). */}
                    <div
                      className="glass-panel relative z-10"
                      style={{ borderLeft: "none", borderRight: "none", borderBottom: "none" }}
                    >
                      <div
                        className="absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                        style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset -2px 0 4px rgba(0,0,0,0.5)" }}
                      />
                      <div
                        className="absolute -right-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                        style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset 2px 0 4px rgba(0,0,0,0.5)" }}
                      />
                      <div
                        className="absolute left-3 right-3 top-0 h-px -translate-y-1/2"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, var(--color-outline) 0 5px, transparent 5px 11px)",
                          opacity: 0.5,
                        }}
                      />

                      <div className="flex flex-col sm:flex-row">
                        <div className="flex-1 flex items-center gap-8 px-6 sm:px-10 py-6">
                          <div>
                            <span
                              className="block font-bold tracking-[0.25em] uppercase text-[9px]"
                              style={{ color: "var(--color-outline)" }}
                            >
                              Venue
                            </span>
                            <p
                              className="font-heading text-base sm:text-lg font-black uppercase tracking-tight"
                              style={{ color: "var(--color-on-surface)" }}
                            >
                              {MATCH_META.venue}
                            </p>
                          </div>
                          <div className="w-px self-stretch my-1" style={{ background: "var(--color-border-overlay)" }} />
                          <div>
                            <span
                              className="block font-bold tracking-[0.25em] uppercase text-[9px]"
                              style={{ color: "var(--color-outline)" }}
                            >
                              Kickoff
                            </span>
                            <p
                              className="font-heading text-base sm:text-lg font-black tabular-nums"
                              style={{ color: "var(--color-theme-orange)" }}
                            >
                              {MATCH_META.time}
                            </p>
                          </div>
                        </div>

                        {/* Stub compartment — faint warm paper tint distinguishes it as its own 
                            piece of stock, torn from the main ticket body on the left */}
                        <div
                          className="relative flex flex-col justify-center gap-2 px-6 sm:px-8 py-4 sm:w-[220px] shrink-0 border-t sm:border-t-0 sm:border-l border-dashed"
                          style={{
                            borderColor: "var(--color-border-overlay)",
                            background:
                              "linear-gradient(135deg, rgba(201,151,31,0.05), rgba(201,151,31,0.02))",
                          }}
                        >
                          <p
                            className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] leading-relaxed"
                            style={{ color: "var(--color-outline)" }}
                          >
                            {TEAM_A.short}·{TEAM_B.short} — {MATCH_META.format}
                          </p>
                          <div className="flex items-end gap-[2px] h-6" aria-hidden="true">
                            {[3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 1, 2].map((w, idx) => (
                              <span
                                key={idx}
                                style={{
                                  width: w,
                                  height: idx % 4 === 0 ? "100%" : "60%",
                                  background: "var(--color-outline)",
                                  opacity: 0.55,
                                }}
                              />
                            ))}
                          </div>
                          <span
                            className="font-mono text-[8px] tracking-[0.2em]"
                            style={{ color: "var(--color-outline)", opacity: 0.6 }}
                          >
                            NO. 003417
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

      <style jsx>{`
        /* Prefer moving this to your global stylesheet / next/font in layout.tsx —
           kept as a local @import so this component works as a standalone drop-in. */
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes systemAppear {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-systemAppear {
          animation: systemAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Shine ring — rotating conic-gradient arc masked to a thin ring,
           drawn around each team badge. */
        .shine-ring {
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          animation: spin 3.5s linear infinite;
        }
        .shine-ring-blue {
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            transparent 78%,
            rgba(59, 139, 212, 0.9) 92%,
            #9ecbf0 98%,
            transparent 100%
          );
        }
        .shine-ring-green {
          background: conic-gradient(
            from 180deg,
            transparent 0%,
            transparent 78%,
            rgba(42, 157, 92, 0.9) 92%,
            #8fe0b0 98%,
            transparent 100%
          );
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}