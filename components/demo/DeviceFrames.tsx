"use client";

import { ReactNode } from "react";

const GOLD = "#f5a623";

export function DesktopFrame({
  children,
  width = 1440,
  height = 900,
  scale,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  scale: number;
}) {
  return (
    <div
      className="relative rounded-md overflow-hidden shrink-0"
      style={{
        width: width * scale + 12,
        height: height * scale + 12,
        padding: 6,
        background: "linear-gradient(180deg, #24272b, #16181b)",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 0 30px -12px ${GOLD}22`,
      }}
    >
      <div className="overflow-hidden" style={{ width: width * scale, height: height * scale, background: "#000" }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}

export function MobileFrame({
  children,
  width = 390,
  height = 844,
  scale,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  scale: number;
}) {
  return (
    <div
      className="relative rounded-md overflow-hidden shrink-0"
      style={{
        width: width * scale + 12,
        height: height * scale + 12,
        padding: 6,
        background: "linear-gradient(180deg, #26292d, #17191c)",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 0 30px -14px ${GOLD}22`,
      }}
    >
      {/* Small rectangular camera bar instead of a rounded notch —
          keeps the whole frame's corners square so nothing clips. */}
      <div
        className="absolute left-1/2 top-[3px] -translate-x-1/2 bg-black z-10"
        style={{ width: width * scale * 0.22, height: 5 }}
      />
      <div className="overflow-hidden" style={{ width: width * scale, height: height * scale, background: "#000" }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}