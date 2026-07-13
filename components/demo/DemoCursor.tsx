"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { CursorState } from "@/lib/demo/demoStore";

// Frame dimensions the cursor coordinates are expressed in — used only to
// decide which side to flip the label toward near edges.
const FRAME_W = 390;
const FRAME_H = 650;
const LABEL_FLIP_MARGIN = 90; // roughly the label's rendered width/height

export default function DemoCursor({ cursor }: { cursor: CursorState | undefined }) {
  if (!cursor || !cursor.visible) return null;

  const flipX = cursor.x > FRAME_W - LABEL_FLIP_MARGIN;
  const flipY = cursor.y > FRAME_H - LABEL_FLIP_MARGIN;

  return (
    <motion.div
      className="pointer-events-none absolute z-[500]"
      animate={{ x: cursor.x, y: cursor.y }}
      transition={{ type: "spring", stiffness: 42, damping: 16, mass: 1.1 }}
      style={{ left: 0, top: 0 }}
    >
      <div className="relative -translate-x-1 -translate-y-1">
        <svg width="22" height="22" viewBox="0 0 22 22" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}>
          <path d="M2 2 L2 18 L7 14 L10 20 L13 18.5 L10 12.5 L16 12.5 Z" fill={cursor.color} stroke="#000000" strokeWidth="1" />
        </svg>

        <AnimatePresence>
          {cursor.clicking && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
              className="absolute left-0 top-0 w-5 h-5 rounded-full"
              style={{ border: `2px solid ${cursor.color}` }}
            />
          )}
        </AnimatePresence>

        {/* label — anchored near the cursor tip, flipped to whichever side
            keeps it inside the frame instead of covering nearby UI */}
        <div
          className="absolute whitespace-nowrap px-2 py-1 rounded-md text-[10px] font-bold uppercase font-mono flex items-center gap-1"
          style={{
            letterSpacing: "0.1em",
            background: "rgba(0,0,0,0.92)",
            color: cursor.color,
            border: `1px solid ${cursor.color}66`,
            boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
            left: flipX ? "auto" : 20,
            right: flipX ? 20 : "auto",
            top: flipY ? "auto" : 16,
            bottom: flipY ? 16 : "auto",
            flexDirection: flipX ? "row-reverse" : "row",
          }}
        >
          {/* small dot ties the label visually back to the cursor, since
              the flip means it's no longer always adjacent to the tip */}
          <span className="w-1 h-1 rounded-full shrink-0" style={{ background: cursor.color }} />
          {cursor.label}
        </div>
      </div>
    </motion.div>
  );
}