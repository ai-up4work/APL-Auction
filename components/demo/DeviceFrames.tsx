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
  height = 700,   // was 844 — trimmed to match actual content height, not full iPhone chrome
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
      className="relative rounded-[20px] overflow-hidden shrink-0 border border-gold/20"
      style={{
        width: width * scale + 12,
        height: height * scale + 12,
        padding: 6,
        background: "linear-gradient(180deg, #141414, #000000)",
        boxShadow: `0 0 0 1px rgba(245,166,35,0.05), 0 0 32px -16px ${GOLD}55`,
      }}
    >
      <div
        className="absolute left-1/2 top-[3px] -translate-x-1/2 bg-black z-10 rounded-full"
        style={{ width: width * scale * 0.22, height: 5 }}
      />

      {label && (
        <div className="absolute left-1/2 top-[13px] -translate-x-1/2 z-10">
          <ChromeLabel label={label} />
        </div>
      )}

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