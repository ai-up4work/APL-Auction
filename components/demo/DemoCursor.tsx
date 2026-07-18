"use client";

// Floating "ghost cursor" for the auto-demo driver. Portaled straight
// to document.body and positioned with `position: fixed` in real
// viewport coordinates, at a z-index above every modal in the app
// (WicketDetailDialog / EndInningsDialog / RestartMatchDialog all sit
// at z-index 9000 via ViewportPortal). Previously this rendered inside
// LiveStatePanelAuto's own wrapper at a lower stacking level, so it was
// invisible any time a dialog was open — the click was genuinely
// landing, you just couldn't see it happen.

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface CursorState {
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
  color: string;
  label: string;
}

const CURSOR_Z_INDEX = 999999;

export default function DemoCursor({
  cursor,
}: {
  cursor: CursorState;
  // Accepted for backward compatibility with existing call sites.
  // No longer used for positioning now that the cursor is
  // viewport-fixed rather than scaled relative to a frame.
  frameWidth?: number;
  frameHeight?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined" || !cursor.visible) return null;

  return createPortal(
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        transform: `translate(${cursor.x}px, ${cursor.y}px)`,
        transition: "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
        pointerEvents: "none",
        zIndex: CURSOR_Z_INDEX,
        willChange: "transform",
      }}
    >
      <div style={{ position: "relative", transform: "translate(-6px, -6px)" }}>
        <svg
          width="26"
          height="26"
          viewBox="0 0 26 26"
          style={{
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
            transform: cursor.clicking ? "scale(0.85)" : "scale(1)",
            transition: "transform 140ms ease-out",
          }}
        >
          <path
            d="M4 2 L4 20 L9 15.5 L12.5 22.5 L15.5 21 L12 14 L18.5 14 Z"
            fill={cursor.color}
            stroke="rgba(0,0,0,0.55)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>

        {cursor.clicking && (
          <span
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              width: 18,
              height: 18,
              borderRadius: "999px",
              border: `2px solid ${cursor.color}`,
              animation: "demoCursorPulse 480ms ease-out",
            }}
          />
        )}

        {cursor.label && (
          <span
            style={{
              position: "absolute",
              top: 24,
              left: 20,
              whiteSpace: "nowrap",
              fontFamily: "var(--font-label-mono, ui-monospace, monospace)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#fff",
              background: "rgba(8,8,8,0.9)",
              border: `1px solid ${cursor.color}`,
              borderRadius: 5,
              padding: "3px 7px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            }}
          >
            {cursor.label}
          </span>
        )}
      </div>

      <style jsx global>{`
        @keyframes demoCursorPulse {
          0% { transform: scale(0.4); opacity: 0.9; }
          100% { transform: scale(1.9); opacity: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
}