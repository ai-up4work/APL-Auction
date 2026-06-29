import { useEffect, useRef, useState } from "react";

interface BudgetRingProps {
  startAmount?: number;
  endAmount?:   number;
  utilization?: number;
  currency?:    string;
  duration?:    number;
}

export default function BudgetRing({
  startAmount = 30_000,
  endAmount   = 32_400,
  utilization = 64.8,
  currency    = "PTS",
  duration    = 1500,
}: BudgetRingProps) {
  const [amount, setAmount] = useState(startAmount);
  const [size, setSize] = useState(160);
  const rootRef = useRef<HTMLDivElement>(null);

  // Count-up animation
  useEffect(() => {
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / duration, 1);
      setAmount(Math.floor(p * (endAmount - startAmount) + startAmount));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [startAmount, endAmount, duration]);

  // Scale to fill container with padding
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const PADDING = 12; // px each side
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const available = Math.min(width, height) - PADDING * 2;
      setSize(Math.max(80, available));
    });
    obs.observe(parent);
    return () => obs.disconnect();
  }, []);

  const pct = Math.min(Math.max(utilization, 0), 100);
  const fontSize = {
    label: Math.max(8,  Math.round(size * 0.072)),
    value: Math.max(18, Math.round(size * 0.22)),
    util:  Math.max(8,  Math.round(size * 0.072)),
  };

  return (
    <div ref={rootRef} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
      <div
        style={{
          width:        size,
          height:       size,
          borderRadius: "8%",
          background:   `conic-gradient(#e45d35 ${pct}%, #2a2e2f 0)`,
          boxShadow:    "0 0 32px rgba(228,93,53,0.35)",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          flexShrink:   0,
        }}
      >
        {/* Inner circle mask */}
        <div
          style={{
            width:           "78%",
            height:          "78%",
            borderRadius:    "50%",
            background:      "#101415",
            display:         "flex",
            flexDirection:   "column",
            alignItems:      "center",
            justifyContent:  "center",
            gap:             Math.max(2, size * 0.015),
          }}
        >
          <span style={{
            fontFamily:    "'Geist', sans-serif",
            fontSize:      fontSize.label,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color:         "#c6c6cd",
          }}>
            Remaining
          </span>
          <span style={{
            fontFamily:    "'Archivo Narrow', sans-serif",
            fontSize:      fontSize.value,
            fontWeight:    700,
            color:         "#dae2fd",
            lineHeight:    1,
            letterSpacing: "-0.02em",
          }}>
            {amount.toLocaleString()}
          </span>
          <span style={{
            fontFamily:    "'Geist', sans-serif",
            fontSize:      fontSize.util,
            fontWeight:    500,
            color:         "#e45d35",
            letterSpacing: "0.05em",
          }}>
            {pct}% used
          </span>
        </div>
      </div>
    </div>
  );
}