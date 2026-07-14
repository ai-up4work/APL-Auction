// components/demo/DeviceFrames.tsx
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
        className="flex items-center justify-between px-3 border-b"
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

/**
 * Uses the exact same "contain" fit model as DesktopFrame — box is
 * width*scale x height*scale, guaranteed to fit fully inside whatever
 * cell it's rendered into. This is deliberate: page.tsx used to pass a
 * "height"-only fit for owner panels, which let the phone grow wider
 * than its cell (by design, to avoid letterboxing) — but that meant the
 * rounded corners and border/glow, which sit right at the box edges,
 * got clipped off by the parent Cell's overflow-hidden. The frame was
 * rendering, just invisibly, as a flat borderless slab. Containing
 * guarantees the full rounded, bordered device chrome is always
 * visible, matching DesktopFrame's treatment, at the cost of small
 * letterbox bars above/below in narrow columns instead.
 */
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
  const boxW = width * scale;
  const boxH = height * scale;

  const outerRadius = boxW * 0.13;
  const bezel = Math.max(3, boxW * 0.022);
  const innerRadius = Math.max(0, outerRadius - bezel * 0.6);
  const islandW = boxW * 0.28;
  const islandH = Math.max(5, boxH * 0.014);
  const buttonW = Math.max(2, boxW * 0.012);

  // The screen is the bezel box's *content* area — its actual pixel size
  // is the outer box minus the bezel padding on every side, not boxW x
  // boxH. Content must be scaled to fit THIS size, not the outer box:
  // scaling it to the outer box size (the old bug) made it bezel-amount
  // too big for the screen it renders into, so the screen's own
  // overflow-hidden silently sliced off whatever spilled past the
  // right/bottom edge — the dynamic-island overlap and the clipped
  // bid button were both this, not a coincidence.
  const screenW = Math.max(1, boxW - bezel * 2);
  const screenH = Math.max(1, boxH - bezel * 2);
  const contentScale = Math.min(screenW / width, screenH / height);

  return (
    <div className="relative shrink-0" style={{ width: boxW, height: boxH }}>
      {/* side buttons */}
      <div
        className="absolute rounded-l-sm"
        style={{
          left: -buttonW,
          top: boxH * 0.16,
          width: buttonW,
          height: boxH * 0.05,
          background: `linear-gradient(180deg, ${SURFACE_LOW}, ${SURFACE_DIM})`,
          boxShadow: `inset 0 0 0 1px ${BORDER_OVERLAY}`,
        }}
      />
      <div
        className="absolute rounded-l-sm bg-red-500"
        style={{
          left: -buttonW,
          top: boxH * 0.24,
          width: buttonW,
          height: boxH * 0.08,
          background: `linear-gradient(180deg, ${SURFACE_LOW}, ${SURFACE_DIM})`,
          boxShadow: `inset 0 0 0 1px ${BORDER_OVERLAY}`,
        }}
      />
      <div
        className="absolute rounded-r-sm"
        style={{
          right: -buttonW,
          top: boxH * 0.18,
          width: buttonW,
          height: boxH * 0.09,
          background: `linear-gradient(180deg, ${SURFACE_LOW}, ${SURFACE_DIM})`,
          boxShadow: `inset 0 0 0 1px ${BORDER_OVERLAY}`,
        }}
      />

      {/* bezel */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: outerRadius,
          background: `linear-gradient(155deg, ${SURFACE_LOW}, ${SURFACE_DIM})`,
          boxShadow: `inset 0 0 0 1px ${BORDER_OVERLAY}, 0 10px 36px -10px rgba(0,0,0,0.85), 0 0 40px -16px color-mix(in srgb, ${ACCENT} 40%, transparent)`,
          padding: bezel,
        }}
      >
        {/* screen — this is the real available area; content must be
            scaled and centered to fit inside IT, not the outer box */}
        <div
          className="relative overflow-hidden w-full h-full flex items-center justify-center"
          style={{ borderRadius: innerRadius, background: "#000" }}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2 z-10 rounded-full"
            style={{
              top: boxH * 0.014,
              width: islandW,
              height: islandH,
              background: "#000",
              boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 1px color-mix(in srgb, ${ACCENT} 20%, transparent)`,
            }}
          />

          {label && (
            <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: islandH + boxH * 0.03 }}>
              <ChromeLabel label={label} />
            </div>
          )}

          <div
            className="absolute rounded-full bg-white/25 z-10"
            style={{
              left: "50%",
              transform: "translateX(-50%)",
              bottom: boxH * 0.012,
              width: boxW * 0.32,
              height: Math.max(2, boxH * 0.006),
            }}
          />

          <div
            style={{
              width,
              height,
              transform: `scale(${contentScale})`,
              transformOrigin: "top left",
              // shift the top-left-originated content so its scaled
              // result lands centered in the screen instead of pinned
              // to the top-left corner
              marginLeft: (screenW - width * contentScale) / 2,
              marginTop: (screenH - height * contentScale) / 2,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}