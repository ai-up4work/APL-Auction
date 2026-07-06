// lib/overlayTokens.js
//
// Shared visual tokens — bezel gradients and clip-path shapes reused across
// the overlay card family. Previously each of PointsTable, CricketScorecard,
// MatchBoundaries, and TournamentBoundaries hand-wrote its own copy of the
// same gradient string or the same polygon() formula. Tune the "metal
// frame" or the "wedge cut" once, here, instead of in four places.

export const GOLD_BEZEL =
  "linear-gradient(135deg, #f1efe9 0%, #b8ad93 14%, #6b6455 28%, #c9971f 42%, #4a453a 56%, #b8ad93 72%, #f1efe9 86%, #8a8272 100%)";

export const STEEL_BEZEL =
  "linear-gradient(135deg, #eef1f6 0%, #b9c3d9 14%, #5f6b85 28%, #6f86c9 42%, #333a4d 56%, #b9c3d9 72%, #eef1f6 86%, #7c879e 100%)";

/**
 * Cut-corner "plaque" outline — used by any full modal card (PointsTable,
 * CricketScorecard) that should read as a struck medallion rather than a
 * plain rounded rectangle. Call it twice per card: once for the outer
 * bezel, once for the inner content layer with a couple px shaved off so
 * it sits inside the bezel's own border thickness.
 *
 *   plaqueClip(30)  → outer bezel
 *   plaqueClip(27)  → inner content, 3px inset
 */
export function plaqueClip(corner) {
  return `polygon(${corner}px 0, calc(100% - ${corner}px) 0, 100% ${corner}px, 100% calc(100% - ${corner}px), calc(100% - ${corner}px) 100%, ${corner}px 100%, 0 calc(100% - ${corner}px), 0 ${corner}px)`;
}

/**
 * One-sided wedge cut — the diagonal left edge used by MatchBoundaries and
 * TournamentBoundaries. `slantPx` is how far the diagonal edge leans;
 * `edgePx` is the small cut-corner on the opposite (right) side.
 *
 *   wedgeClip(30, 10) → outer bezel
 *   wedgeClip(28, 9)  → inner content, inset to match the bezel thickness
 */
export function wedgeClip(slantPx, edgePx = 10) {
  return `polygon(${slantPx}px 0, calc(100% - ${edgePx}px) 0, 100% ${edgePx}px, 100% calc(100% - ${edgePx}px), calc(100% - ${edgePx}px) 100%, 0 100%)`;
}

/**
 * One-sided rhombus cut used by LiveScoreBar's TeamBlock — the outer edge
 * (against the bar's rounded corner) stays vertical, the inner edge
 * (facing the score/center) is cut on a diagonal. `align` mirrors it for
 * the left vs right team panel.
 */
export function teamBlockClip(slantPx, align) {
  return align === "right"
    ? `polygon(${slantPx}px 0, 100% 0, 100% 100%, 0 100%)`
    : `polygon(0 0, 100% 0, calc(100% - ${slantPx}px) 100%, 0 100%)`;
}

/**
 * The gold-led ambient glow blurred behind every modal card — team color
 * on each side, a warm gold seam down the middle. Was copy-pasted
 * identically (only the two team refs changed) in CricketScorecard and
 * CricketMatchIntro; PointsTable and the boundary cards used the same
 * pattern too.
 */
export function ambientGlow(teamA, teamB) {
  return `linear-gradient(90deg, ${teamA.colorSoft}, rgba(201,151,31,0.16), ${teamB.colorSoft})`;
}