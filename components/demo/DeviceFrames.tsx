"use client";

import { ReactNode } from "react";

const GOLD = "#f5a623";

/**
 * Small macOS-style traffic light cluster, dimmed to sit quietly in the
 * gold/black chrome rather than reading as a literal browser screenshot.
 */
function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="w-2 h-2 rounded-full bg-white/15" />
      <span className="w-2 h-2 rounded-full bg-white/15" />
      <span className="w-2 h-2 rounded-full bg-white/15" />
    </div>
  );
}

/** Uppercase mono badge, same visual language as the landing page's MODULE tags. */
function ChromeLabel({ label }: { label: string }) {
  return (
    <span
      className="font-mono text-[9px] tracking-[2px] text-gold/70 uppercase truncate"
      style={{ letterSpacing: "0.15em" }}
    >
      {label}
    </span>
  );
}

export function DesktopFrame({
  children,
  width = 1440,
  height = 900,
  scale,
  label,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  scale: number;
  label?: string;
}) {
  const chromeH = 26;

  return (
    <div
      className="relative rounded-lg overflow-hidden shrink-0 border border-gold/20"
      style={{
        width: width * scale + 12,
        height: height * scale + chromeH + 12,
        padding: "6px 6px 6px 6px",
        background: "linear-gradient(180deg, #141414, #000000)",
        boxShadow: `0 0 0 1px rgba(245,166,35,0.05), 0 0 32px -14px ${GOLD}55`,
      }}
    >
      {/* chrome bar */}
      <div
        className="flex items-center justify-between px-3 border-b border-gold/10"
        style={{ height: chromeH }}
      >
        <TrafficLights />
        {label ? <ChromeLabel label={label} /> : <span />}
        <div className="w-8" />
      </div>

      <div
        className="overflow-hidden"
        style={{ width: width * scale, height: height * scale, background: "#000" }}
      >
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function MobileFrame({
  children,
  width = 390,
  height = 650,
  scale,
  label,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  scale: number;
  label?: string;
}) {
  return (
    <div
      className="relative rounded-[28px] overflow-hidden shrink-0"
      style={{
        width: width * scale + 16,
        height: height * scale + 16,
        padding: 8,
        background: "linear-gradient(180deg, #1c1c1c, #050505)",
        border: "1px solid rgba(245,166,35,0.35)",
        boxShadow: `0 0 0 1px rgba(0,0,0,0.6), 0 8px 32px -8px rgba(0,0,0,0.8), 0 0 40px -16px ${GOLD}66`,
      }}
    >
      {/* camera notch — bumped up in size/contrast so it's actually visible */}
      <div
        className="absolute left-1/2 top-[6px] -translate-x-1/2 z-10 rounded-full"
        style={{
          width: width * scale * 0.24,
          height: 6,
          background: "#000",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />

      {label && (
        <div className="absolute left-1/2 top-[16px] -translate-x-1/2 z-10">
          <ChromeLabel label={label} />
        </div>
      )}

      <div
        className="overflow-hidden rounded-[20px]"
        style={{ width: width * scale, height: height * scale, background: "#000" }}
      >
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}