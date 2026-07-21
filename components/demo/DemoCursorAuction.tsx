"use client";

import React from "react";

// Shape written by demoModel.setCursor(actor, {...}) in demoOrchestrator.ts /
// demoInteractiveController.ts, and read back via snap.cursors[key] in
// DemoOwnerBidPage / DemoAuctioneerPage. x/y are LOCAL offsets relative to
// the panel's own [data-demo-panel] container (computed in
// getLocalOffset()), so this component must render as an absolutely
// positioned child of that same container — both page roots already carry
// `relative` + `data-demo-panel={...}`, so no extra wrapper is needed here.
export type DemoCursorState = {
  panel: string;
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
  label: string;
  color: string;
};

export default function DemoCursor({
  cursor,
}: {
  cursor: DemoCursorState | null | undefined;
}) {
  // Cursor may be undefined until the orchestrator's first setCursor call
  // for this actor, or explicitly absent for actors that never appear on
  // this panel (e.g. watch). Render nothing rather than a cursor frozen
  // at (0,0).
  if (!cursor) return null;

  const { x, y, visible, clicking, label, color } = cursor;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-[999]"
      style={{
        // translate3d instead of left/top so the browser can animate on
        // the compositor — this is what actually moves the cursor smoothly
        // between moveCursor() calls instead of teleporting.
        transform: `translate3d(${x}px, ${y}px, 0) translate(-3px, -2px) scale(${clicking ? 0.86 : 1})`,
        opacity: visible ? 1 : 0,
        transition: visible
          ? "transform 550ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease"
          : "opacity 180ms ease",
        willChange: "transform, opacity",
      }}
    >
      {/* Click ripple — keyed by `clicking` toggling true so it replays
          every time demoOrchestrator's click() fires, not just once. */}
      {clicking && (
        <span
          key={`${x}-${y}-ripple`}
          className="absolute rounded-full"
          style={{
            left: 3,
            top: 2,
            width: 24,
            height: 24,
            marginLeft: -12,
            marginTop: -12,
            border: `2px solid ${color}`,
            animation: "demo-cursor-ripple 650ms ease-out",
          }}
        />
      )}

      {/* Arrow glyph */}
      <svg
        width="20"
        height="24"
        viewBox="0 0 20 24"
        fill="none"
        style={{
          filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.5))",
          transition: "transform 120ms ease",
          transform: clicking ? "scale(0.92)" : "scale(1)",
        }}
      >
        <path
          d="M1 1L1 19L5.6 15.2L8.6 22.2L11.7 20.9L8.7 14.1L14.6 14.1L1 1Z"
          fill={color}
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>

      {/* Actor label pill */}
      {label && (
        <span
          className="absolute whitespace-nowrap rounded-full px-2 py-[3px] text-[9px] font-bold uppercase text-white"
          style={{
            left: 18,
            top: 12,
            letterSpacing: "0.08em",
            background: color,
            fontFamily: "'Geist Mono', monospace",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {label}
        </span>
      )}

      <style jsx global>{`
        @keyframes demo-cursor-ripple {
          0% {
            opacity: 0.85;
            transform: scale(0.4);
          }
          100% {
            opacity: 0;
            transform: scale(1.9);
          }
        }
      `}</style>
    </div>
  );
}