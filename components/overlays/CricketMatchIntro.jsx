"use client";

import { Trophy } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ambientGlow } from "@/lib/overlayTokens";

// ---- Fallback match data ----
// These are the same values that used to be hardcoded as TEAM_A/TEAM_B/
// TOURNAMENT/MATCH_META. They're now defaults only — real values come
// from the `matchSetup` prop (and the `tournament` / `matchMeta`
// override props for the couple of fields matchSetup doesn't carry),
// so the panel shows whatever was actually configured in Match Setup
// instead of always showing the Coastal Sharks vs Desert Falcons demo.
const TEAM_VISUAL_DEFAULTS = {
  teamA: { name: "COASTAL SHARKS", short: "CS", image: "/Franchises/CSK.png", color: "#3B8BD4" },
  teamB: { name: "DESERT FALCONS", short: "DF", image: "/Franchises/RCB.png", color: "#2A9D5C" },
};

const TOURNAMENT_DEFAULTS = {
  name: "MOON KNIGHT CUP",
  edition: "SEASON 7 · T20",
  logo: "/valiant-league-logo.png",
};

const MATCH_META_DEFAULTS = {
  venue: "Meridian Stadium",
  format: "20 OVERS",
};

// A color hex like "#3B8BD4" -> "rgba(59,139,212,0.22)" for the soft glow
// behind each crest. Falls back to a neutral gold-tinted glow if the hex
// doesn't parse, so a malformed color value never breaks the render.
function softGlowFromHex(hex) {
  const fallback = "rgba(201,151,31,0.18)";
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.22)`;
}

// Total time the exit choreography needs before we actually unmount.
// Keep this in sync with the longest exit animation + its delay below.
const EXIT_DURATION_MS = 420;

/**
 * CricketMatchIntro — self-contained trigger button + modal panel, now
 * remote-controllable, same pattern as PointsTable:
 *   - `show` (boolean | undefined): when provided, drives the panel
 *     open/closed externally (e.g. from a bus event). When omitted
 *     (undefined), the component behaves exactly as before — purely
 *     driven by its own trigger button.
 *   - `hideTrigger`: hides the on-screen "Match Center" trigger button,
 *     for use on the OBS-facing overlay page where there's no one to
 *     click it.
 *   - `matchSetup`: the MatchSetup object from the admin panel. Drives
 *     team names/short codes/colors/logos and the format-derived overs
 *     label, so this panel shows whatever was actually configured in
 *     Match Setup instead of the hardcoded demo teams.
 *   - `tournament` / `matchMeta`: optional overrides for tournament
 *     branding, venue, format, or kickoff time — for cases where you
 *     want to show something other than what's on matchSetup. Anything
 *     not passed falls back to matchSetup or the defaults above.
 */
export default function CricketMatchIntro({ show, hideTrigger = false, matchSetup, tournament, matchMeta }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false); // panel is in the DOM
  const [closing, setClosing] = useState(false); // panel is mid exit-animation
  const closeTimer = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openPanel = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClosing(false);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setClosing((alreadyClosing) => {
      if (alreadyClosing) return true;
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, EXIT_DURATION_MS);
      return true;
    });
  }, []);

  const toggle = useCallback(() => {
    if (open && !closing) closePanel();
    else if (!open) openPanel();
  }, [open, closing, openPanel, closePanel]);

  // External control — only takes effect when `show` is actually passed.
  useEffect(() => {
    if (show === undefined) return;
    if (show) openPanel();
    else closePanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Escape closes it too, since there's no dedicated close button.
  useEffect(() => {
    if (!open || closing) return;
    const onKey = (e) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closing, closePanel]);

  // ---- Derive team cards + tournament/match meta from matchSetup ----
  // Falls back to the original hardcoded demo values field-by-field, so
  // if matchSetup (or a particular field on it) isn't provided yet, the
  // panel renders exactly as it always did.
  const TEAM_A = {
    name: matchSetup?.teamA?.name || TEAM_VISUAL_DEFAULTS.teamA.name,
    short: matchSetup?.teamA?.shortCode || TEAM_VISUAL_DEFAULTS.teamA.short,
    image: matchSetup?.teamA?.logoUrl || TEAM_VISUAL_DEFAULTS.teamA.image,
    color: matchSetup?.teamA?.color || TEAM_VISUAL_DEFAULTS.teamA.color,
    colorSoft: softGlowFromHex(matchSetup?.teamA?.color || TEAM_VISUAL_DEFAULTS.teamA.color),
  };
  const TEAM_B = {
    name: matchSetup?.teamB?.name || TEAM_VISUAL_DEFAULTS.teamB.name,
    short: matchSetup?.teamB?.shortCode || TEAM_VISUAL_DEFAULTS.teamB.short,
    image: matchSetup?.teamB?.logoUrl || TEAM_VISUAL_DEFAULTS.teamB.image,
    color: matchSetup?.teamB?.color || TEAM_VISUAL_DEFAULTS.teamB.color,
    colorSoft: softGlowFromHex(matchSetup?.teamB?.color || TEAM_VISUAL_DEFAULTS.teamB.color),
  };

  // Tournament name/logo come from MatchSetup; `edition` is built from
  // season + format since MatchSetup has no single "edition" string.
  const TOURNAMENT = {
    name: matchSetup?.tournamentName || TOURNAMENT_DEFAULTS.name,
    edition:
      [matchSetup?.season && `SEASON ${matchSetup.season}`, matchSetup?.format].filter(Boolean).join(" · ") ||
      TOURNAMENT_DEFAULTS.edition,
    logo: matchSetup?.tournamentLogoUrl || TOURNAMENT_DEFAULTS.logo,
    ...tournament,
  };

  const formatLabel =
    matchSetup?.format === "T20"
      ? "20 OVERS"
      : matchSetup?.format === "ODI"
      ? "50 OVERS"
      : matchSetup?.format === "Test"
      ? "TEST"
      : MATCH_META_DEFAULTS.format;

  // Venue comes from MatchSetup. Kickoff time also comes from MatchSetup
  // now that it's a real field there — `time` stays undefined when it's
  // not set, which is what the footer below checks before rendering the
  // Kickoff block at all.
  const MATCH_META = {
    venue: matchSetup?.venue || MATCH_META_DEFAULTS.venue,
    format: formatLabel,
    time: matchSetup?.kickoffTime || undefined,
    ...matchMeta,
  };

  return (
    <>
      {/* Trigger Button — also toggles closed, since the panel no longer
          has its own close control. Hidden entirely on the OBS-facing
          overlay page via hideTrigger. */}
      {!hideTrigger && (
        <button
          onClick={toggle}
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
      )}

      {mounted &&
        open &&
        createPortal(
          <>
            {/* Backdrop — click anywhere outside the card to dismiss */}
            <div
              className="fixed inset-0 backdrop-blur-sm z-[100] mki-backdrop"
              style={{
                background: "rgba(0,0,0,0.8)",
                animation: closing
                  ? "mkiFadeOut 0.32s ease-in 0.1s both"
                  : "mkiFadeIn 0.3s ease-out both",
              }}
              onClick={closePanel}
            />

            {/* Panel container — covers a region of the screen, not the whole viewport */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
              <div
                className="pointer-events-auto w-full max-w-4xl relative mki-card"
                style={{
                  animation: closing
                    ? "mkiCardExit 0.32s cubic-bezier(0.4,0,1,1) 0.06s both"
                    : "mkiCardEnter 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.03s both",
                }}
              >
                {/* Ambient glow behind the card — gold-led, team colors kept
                    subtle. Now sourced from the shared overlayTokens
                    ambientGlow() helper instead of a locally hand-typed
                    duplicate of the same gradient. */}
                <div
                  className="absolute -inset-6 blur-3xl rounded-[40px]"
                  style={{
                    background: ambientGlow(TEAM_A, TEAM_B),
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
                        left/right chips. Drops in just after the frame lands. */}
                    <div
                      className="relative z-10 flex items-center justify-center gap-4 pt-7 pb-5 px-6 sm:px-10 mki-header"
                      style={{
                        borderBottom: "1px solid var(--color-border-overlay)",
                        animation: closing
                          ? "mkiHeaderOut 0.2s ease-in 0.12s both"
                          : "mkiHeaderIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.15s both",
                      }}
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
                      {/* Emblem watermark — opacity/contrast raised so it actually
                          reads as a background crest rather than a barely-there
                          smudge. Blend mode instead of a flat opacity so it sits
                          into the dark surface as texture, not a washed-out layer. */}
                      <div
                        className="absolute inset-0 sm:-inset-2 flex items-center justify-center pointer-events-none select-none"
                        aria-hidden="true"
                        style={{
                          animation: closing
                            ? "mkiFadeOut 0.22s ease-in both"
                            : "mkiFadeIn 0.6s ease-out 0.3s both",
                        }}
                      >
                        <img
                          src={TOURNAMENT.logo}
                          alt=""
                          className="w-full h-full object-contain"
                          style={{
                            opacity: 0.56,
                            mixBlendMode: "soft-light",
                            filter: "grayscale(1) contrast(1.3) brightness(1.6)",
                          }}
                        />
                      </div>

                      {/* Team A — slides in from off-frame left with a slight
                          rotation, like it's swinging into place on a hinge. */}
                      <div
                        className="relative z-10 flex flex-col items-center gap-4 mki-team-a"
                        style={{
                          animation: closing
                            ? "mkiTeamAOut 0.22s ease-in 0.05s both"
                            : "mkiTeamAIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.24s both",
                        }}
                      >
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

                      {/* Divider — simple vertical line replacing the VS crest.
                          Draws itself top-to-bottom-out-from-center, with a
                          gold accent dot popping in once the line is drawn. */}
                      <div
                        className="relative z-10 shrink-0 self-stretch flex items-center justify-center mki-divider"
                        style={{
                          transformOrigin: "center",
                          animation: closing
                            ? "mkiDividerOut 0.18s ease-in 0.05s both"
                            : "mkiDividerIn 0.4s ease-out 0.34s both",
                        }}
                      >
                        <div
                          className="w-px h-full"
                          style={{
                            background:
                              "linear-gradient(180deg, transparent 0%, var(--color-border-overlay) 20%, rgba(201,151,31,0.55) 50%, var(--color-border-overlay) 80%, transparent 100%)",
                          }}
                        />
                        <span
                          className="absolute w-2 h-2 rounded-full"
                          style={{
                            background: "var(--color-theme-orange)",
                            boxShadow: "0 0 8px 2px var(--color-bid-glow)",
                            animation: closing
                              ? "mkiFadeOut 0.15s ease-in both"
                              : "mkiFadeIn 0.3s ease-out 0.58s both",
                          }}
                        />
                      </div>

                      {/* Team B — mirrors Team A in from the right */}
                      <div
                        className="relative z-10 flex flex-col items-center gap-4 mki-team-b"
                        style={{
                          animation: closing
                            ? "mkiTeamBOut 0.22s ease-in 0.05s both"
                            : "mkiTeamBIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.24s both",
                        }}
                      >
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

                    {/* Footer — ticket stub. Notches are cut into the card's own
                        edges (using its overflow-hidden to fake a real perforation),
                        so the divider is a physical detail of "a match ticket," not a
                        UI motif. Slides up last, like it's being torn onto the
                        bottom of the card. */}
                    <div
                      className="glass-panel relative z-10 mki-footer"
                      style={{
                        borderLeft: "none",
                        borderRight: "none",
                        borderBottom: "none",
                        animation: closing
                          ? "mkiFooterOut 0.2s ease-in both"
                          : "mkiFooterIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.42s both",
                      }}
                    >
                      {/* Bite notches at the tear-line */}
                      <div
                        className="absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                        style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset -2px 0 4px rgba(0,0,0,0.5)" }}
                      />
                      <div
                        className="absolute -right-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                        style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset 2px 0 4px rgba(0,0,0,0.5)" }}
                      />
                      {/* Dashed tear-line between the notches */}
                      <div
                        className="absolute left-3 right-3 top-0 h-px -translate-y-1/2"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, var(--color-outline) 0 5px, transparent 5px 11px)",
                          opacity: 0.5,
                        }}
                      />

                      <div className="flex flex-col sm:flex-row">
                        {/* Main stub — venue always shows; Kickoff only
                            renders when matchSetup.kickoffTime is actually
                            set, so there's no more hardcoded "19:30 LOCAL"
                            standing in for real data. */}
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
                          {MATCH_META.time && (
                            <>
                              <div
                                className="w-px self-stretch my-1"
                                style={{ background: "var(--color-border-overlay)" }}
                              />
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
                            </>
                          )}
                        </div>

                        {/* Stub compartment — faint warm paper tint distinguishes it as its
                            own piece of stock, torn from the main ticket body on the left */}
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

        /* ---- Entrance / exit choreography ----
           Each region gets its own enter/exit keyframes so the whole panel
           reads as one orchestrated sequence: frame lands first, header
           settles, both team badges swing in as the divider draws itself,
           then the ticket stub slides up last. Exit reverses the order and
           runs about twice as fast, so it feels like the ticket is being
           pulled back rather than just cut. */

        @keyframes mkiFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes mkiFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes mkiCardEnter {
          from { opacity: 0; transform: scale(0.86) translateY(-26px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes mkiCardExit {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.92) translateY(12px); }
        }

        @keyframes mkiHeaderIn {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mkiHeaderOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }

        @keyframes mkiTeamAIn {
          from { opacity: 0; transform: translateX(-56px) rotate(-7deg) scale(0.82); }
          to { opacity: 1; transform: translateX(0) rotate(0deg) scale(1); }
        }
        @keyframes mkiTeamAOut {
          from { opacity: 1; transform: translateX(0) rotate(0deg) scale(1); }
          to { opacity: 0; transform: translateX(-44px) rotate(-8deg) scale(0.85); }
        }

        @keyframes mkiTeamBIn {
          from { opacity: 0; transform: translateX(56px) rotate(7deg) scale(0.82); }
          to { opacity: 1; transform: translateX(0) rotate(0deg) scale(1); }
        }
        @keyframes mkiTeamBOut {
          from { opacity: 1; transform: translateX(0) rotate(0deg) scale(1); }
          to { opacity: 0; transform: translateX(44px) rotate(8deg) scale(0.85); }
        }

        @keyframes mkiDividerIn {
          from { opacity: 0; transform: scaleY(0); }
          to { opacity: 1; transform: scaleY(1); }
        }
        @keyframes mkiDividerOut {
          from { opacity: 1; transform: scaleY(1); }
          to { opacity: 0; transform: scaleY(0); }
        }

        @keyframes mkiFooterIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mkiFooterOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(22px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .mki-backdrop,
          .mki-card,
          .mki-header,
          .mki-team-a,
          .mki-team-b,
          .mki-divider,
          .mki-footer {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
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
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}