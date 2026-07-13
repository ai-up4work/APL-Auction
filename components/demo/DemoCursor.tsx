// components/demo/DemoCursor.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { CursorState } from "@/lib/demo/demoStore";

export default function DemoCursor({ cursor }: { cursor: CursorState | undefined }) {
  if (!cursor || !cursor.visible) return null;

  return (
    <motion.div
      className="pointer-events-none absolute z-[500]"
      animate={{ x: cursor.x, y: cursor.y }}
      transition={{ type: "spring", stiffness: 42, damping: 16, mass: 1.1 }}
      style={{ left: 0, top: 0 }}
    >
      <div className="relative -translate-x-1 -translate-y-1">
        <svg width="22" height="22" viewBox="0 0 22 22" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
          <path d="M2 2 L2 18 L7 14 L10 20 L13 18.5 L10 12.5 L16 12.5 Z" fill={cursor.color} stroke="#0d1117" strokeWidth="1" />
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

        <div
          className="absolute left-5 top-4 whitespace-nowrap px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide"
          style={{
            fontFamily: "'Geist Mono', monospace",
            background: "rgba(13,17,23,0.92)",
            color: cursor.color,
            border: `1px solid ${cursor.color}55`,
          }}
        >
          {cursor.label}
        </div>
      </div>
    </motion.div>
  );
}