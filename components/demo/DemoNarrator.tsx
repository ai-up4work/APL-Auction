"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { demoModel } from "@/lib/demo/demoModel";

const GOLD = "#f5a623";

export default function DemoNarrator() {
  const snap = useSyncExternalStore(demoModel.subscribe.bind(demoModel), demoModel.getSnapshot.bind(demoModel));
  const [displayText, setDisplayText] = useState(snap.narratorText);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (snap.narratorText === displayText || !snap.narratorText) return;
    setFading(true);
    const t = setTimeout(() => {
      setDisplayText(snap.narratorText);
      setFading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [snap.narratorText, displayText]);

  return (
    <div className="shrink-0 flex items-center justify-center px-6 pb-3 relative z-10">
      <div
        className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border transition-all duration-200 max-w-[90vw]"
        style={{
          borderColor: `${GOLD}40`,
          background: "rgba(0,0,0,0.6)",
          boxShadow: `0 0 24px -10px ${GOLD}66`,
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(-3px)" : "translateY(0)",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: GOLD }} />
        <span
          className="font-mono text-[11px] text-white/80 tracking-wide whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {displayText}
        </span>
      </div>
    </div>
  );
}