"use client";
import { ReactNode } from "react";

const ACCENT = "var(--color-theme-orange)";
const BORDER_OVERLAY = "var(--color-border-overlay)";
const SURFACE_LOW = "var(--color-surface-container-low)";
const SURFACE_DIM = "var(--color-surface-dim)";

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="w-2 h-2 rounded-full bg-white/15" />
      <span className="w-2 h-2 rounded-full bg-white/15" />
      <span className="w-2 h-2 rounded-full bg-white/15" />
    </div>
  );
}

function ChromeLabel({ label }: { label: string }) {
  return (
    <span
      className="text-[9px] uppercase truncate"
      style={{
        fontFamily: "var(--font-label-mono)",
        letterSpacing: "0.15em",
        color: `color-mix(in srgb, ${ACCENT} 70%, transparent)`,
      }}
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
      className="relative overflow-hidden shrink-0 rounded-lg"
      style={{
        width: width * scale,
        height: height * scale + chromeH,
        background: `linear-gradient(180deg, ${SURFACE_LOW}, ${SURFACE_DIM})`,
        boxShadow: `inset 0 0 0 1px ${BORDER_OVERLAY}, 0 0 32px -14px color-mix(in srgb, ${ACCENT} 45%, transparent)`,
      }}
    >
      <div
        className="flex items-center justify-between px-3 border-b pt-2"
        style={{ height: chromeH, borderColor: BORDER_OVERLAY }}
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
  width = 450,
  height = 750,
  scale,
  label,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  scale: number;
  label?: string;
}) {
  // Mobile frames define strict visual bounds so the inner app will
  // stretch to match these exactly.
  return (
    <div
      className="relative shrink-0 overflow-hidden flex"
      style={{
        width: width * scale,
        height: height * scale,
        borderRadius: (width * scale) * 0.13, 
        border: `${Math.max(3, (width * scale) * 0.022)}px solid #18181b`,  // navy blue
        boxShadow: `0 0 32px -14px color-mix(in srgb, ${ACCENT} 45%, transparent)`,
        background: `linear-gradient(180deg, ${SURFACE_LOW}, ${SURFACE_DIM})`,
      }}
    >
      {/* w-full h-full guarantees child components fill the entire remaining frame real estate */}
      <div className="w-full h-full overflow-hidden relative">
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
           {children}
        </div>
      </div>
    </div>
  );
}