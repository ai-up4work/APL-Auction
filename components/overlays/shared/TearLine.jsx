"use client";

/**
 * TearLine — the "ticket stub" perforation device: two bite-notch circles
 * at the edges plus a dashed line between them. Was copy-pasted verbatim
 * (identical JSX, identical inline styles) inside LiveScoreBar,
 * CricketScorecard, and CricketMatchIntro. Drop this in place of that
 * block; it's absolutely positioned so it expects a `relative` ancestor
 * with the notches meant to bite into that ancestor's own left/right
 * edges (matches how it was used everywhere already).
 *
 * `variant="edge"` (default) — notches sit flush at -9px outside the
 * container, top aligned via -translate-y-1/2 (how LiveScoreBar and
 * CricketMatchIntro/CricketScorecard's outer footer used it — notches
 * biting into the card's own outer edge at the seam's y-position).
 *
 * `variant="inset"` — notches sit a few px inside the container instead
 * (how CricketScorecard's *footer* divider used it, indented from the
 * card edge by `left-3 right-3`).
 */
export default function TearLine({ variant = "edge" }) {
  if (variant === "inset") {
    return (
      <>
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
            backgroundImage: "repeating-linear-gradient(90deg, var(--color-outline) 0 5px, transparent 5px 11px)",
            opacity: 0.5,
          }}
        />
      </>
    );
  }

  return (
    <div className="relative">
      <div
        className="absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
        style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset -2px 0 4px rgba(0,0,0,0.5)" }}
      />
      <div
        className="absolute -right-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
        style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset 2px 0 4px rgba(0,0,0,0.5)" }}
      />
      <div
        className="h-px w-full"
        style={{
          backgroundImage: "repeating-linear-gradient(90deg, var(--color-outline) 0 5px, transparent 5px 11px)",
          opacity: 0.5,
        }}
      />
    </div>
  );
}