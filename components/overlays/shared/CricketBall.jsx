"use client";

/**
 * CricketBall — the stitched-seam sphere: a radial-gradient fill plus two
 * dashed SVG arcs standing in for the ball's seam. This was the visual
 * core of both:
 *   - LiveScoreBar's BallChip (the small 20px "this over" dots)
 *   - BoundaryCelebration's BallSphere (the big 64px flying ball)
 *
 * The two callers wrapped it very differently (BallChip adds a pulse ring
 * and a run/wicket glyph on top; BallSphere is just the raw sphere flying
 * across the screen), so this component is deliberately just the sphere
 * itself — callers compose their own chrome around it.
 *
 * `fill` lets each caller pick its own gradient stops (BallChip varies
 * fill by outcome — wicket/boundary/extra/dot — while BoundaryCelebration
 * uses one accent color per celebration type), falling back to the
 * standard "leather ball" gradient if omitted.
 */
const DEFAULT_FILL =
  "radial-gradient(circle at 32% 26%, #7a828f 0%, #545a63 45%, #2c2f36 85%, #1b1d22 100%)";

export default function CricketBall({
  size = 20,
  fill = DEFAULT_FILL,
  seamColor = "rgba(255,255,255,0.5)",
  seamWidth = 0.9,
  className = "",
  style = {},
  children, // optional label/glyph rendered centered on top, z-indexed above the seam
}) {
  return (
    <span
      className={`relative inline-block rounded-full overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        background: fill,
        border: "1px solid rgba(0,0,0,0.35)",
        boxShadow:
          "inset 0 -3px 4px rgba(0,0,0,0.5), inset 0 2px 2px rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      <svg viewBox="0 0 20 20" className="absolute inset-0 w-full h-full" style={{ opacity: 0.8 }}>
        <path
          d="M3,2 Q9,10 3,18"
          stroke={seamColor}
          strokeWidth={seamWidth}
          strokeDasharray="1.1 1.3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M17,2 Q11,10 17,18"
          stroke={seamColor}
          strokeWidth={seamWidth}
          strokeDasharray="1.1 1.3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {children && (
        <span className="relative z-10 flex items-center justify-center w-full h-full">{children}</span>
      )}
    </span>
  );
}