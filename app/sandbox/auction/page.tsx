// app/sandbox/auction/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { demoOrchestrator } from "@/lib/demo/demoOrchestrator";
import { demoModel, getDemoSnapshot } from "@/lib/demo/demoModel";
import { DesktopFrame, MobileFrame } from "@/components/demo/DeviceFrames";
import DemoAuctioneerPage from "@/components/demo/DemoAuctioneerPage";
import DemoOwnerBidPage from "@/components/demo/DemoOwnerBidPage";
import DemoWatchPage from "@/components/demo/DemoWatchPage";

type PanelKey = "auctioneer" | "watch" | "ownerA" | "ownerB";
const DESKTOP: PanelKey[] = ["auctioneer", "watch"];
const MOBILE: PanelKey[] = ["ownerA", "ownerB"];
// Fixed left-to-right render order so panels never swap sides when they
// appear/disappear — only their width changes.
const PANEL_ORDER: PanelKey[] = ["auctioneer", "watch", "ownerA", "ownerB"];

const DESKTOP_W = 1350;
const DESKTOP_H = 800;
const DESKTOP_CHROME_H = 26;
const MOBILE_W = 400;
const MOBILE_H = 750;
const ZOOM_TRANSITION = "500ms cubic-bezier(0.22,1,0.36,1)";

// ── Multiview tally bar meta — numbers + labels for the four feeds ────────
const PANEL_META: Record<PanelKey, { num: string; label: string }> = {
  auctioneer: { num: "01", label: "Auctioneer" },
  watch: { num: "02", label: "Broadcast" },
  ownerA: { num: "03", label: "Owner A" },
  ownerB: { num: "04", label: "Owner B" },
};

/**
 * Given the set of currently-highlighted panels, returns each panel's
 * share of screen width (0–100). Always returns all four keys — panels
 * not in use collapse to 0 (not just dimmed) so whatever IS in use can
 * take every spare pixel, and so a panel animates smoothly in/out of the
 * row instead of the whole layout mode swapping.
 *
 * Empty `highlighted` is the neutral/idle state: just the two
 * broadcast-facing desktop feeds (Auctioneer, Watch). Owner phones only
 * enter once the orchestrator actually spotlights a bidder.
 */
function computeLayout(highlighted: PanelKey[]): Record<PanelKey, number> {
  const base: Record<PanelKey, number> = { auctioneer: 0, watch: 0, ownerA: 0, ownerB: 0 };
  const desktopHi = highlighted.filter((p) => DESKTOP.includes(p));
  const mobileHi = highlighted.filter((p) => MOBILE.includes(p));

  if (desktopHi.length === 0 && mobileHi.length === 0) {
    return { ...base, auctioneer: 50, watch: 50 };
  }

  // One desktop alone -> pair it with a bidder panel instead of letting
  // the desktop fill the whole screen. A bid page should always be
  // visible alongside the auctioneer/broadcast view, even during beats
  // (shuffle, reveal) where no owner has been focused yet.
  if (desktopHi.length === 1 && mobileHi.length === 0) {
    return { ...base, [desktopHi[0]]: 75, ownerA: 25 };
  }

  // One desktop + one mobile -> 75 / 25.
  if (desktopHi.length === 1 && mobileHi.length === 1) {
    return { ...base, [desktopHi[0]]: 75, [mobileHi[0]]: 25 };
  }

  // One desktop + two mobiles -> 75 / 12.5 / 12.5.
  if (desktopHi.length === 1 && mobileHi.length === 2) {
    return { ...base, [desktopHi[0]]: 75, [mobileHi[0]]: 12.5, [mobileHi[1]]: 12.5 };
  }

  // Two mobiles, no desktop -> side by side, 50 / 50.
  if (desktopHi.length === 0 && mobileHi.length === 2) {
    return { ...base, [mobileHi[0]]: 50, [mobileHi[1]]: 50 };
  }

  // One mobile, no desktop highlighted -> mobile gets a quarter, Watch
  // (the always-on spectator screen) takes the rest. Auctioneer stays
  // hidden here since it isn't part of this beat.
  if (desktopHi.length === 0 && mobileHi.length === 1) {
    return { ...base, [mobileHi[0]]: 25, watch: 75 };
  }

  // Two desktops highlighted together, no mobile in this beat (e.g. the
  // shuffle/reveal beat, which spotlights only Auctioneer + Watch) — show
  // the two desktop feeds cleanly, 50/50. Don't force a bidder panel in
  // here; no owner has been spotlighted yet during this beat, so pulling
  // one in just shows an idle "awaiting lot" phone alongside two full
  // desktop feeds.
  if (desktopHi.length === 2 && mobileHi.length === 0) return { ...base, auctioneer: 50, watch: 50 };

  // Two desktops + one mobile -> keep both desktops prominent and add the
  // spotlighted bidder's phone alongside.
  if (desktopHi.length === 2 && mobileHi.length === 1)
    return { ...base, auctioneer: 37.5, watch: 37.5, [mobileHi[0]]: 25 };
  if (desktopHi.length === 2 && mobileHi.length === 2)
    return { ...base, auctioneer: 25, watch: 25, ownerA: 25, ownerB: 25 };

  return { ...base, auctioneer: 50, watch: 50 };
}

/**
 * Measures the available box for a panel and returns both the scale
 * factor AND the exact pixel width/height that scaled content should
 * occupy (naturalWidth * scale, naturalHeight * scale).
 *
 * IMPORTANT: this returns a *callback ref*, not a RefObject. The panel
 * this hook backs gets mounted onto structurally different DOM elements
 * depending on layout mode (neutral overview grid vs. spotlight row), so
 * the underlying node identity changes across renders. A plain
 * `useRef` + `useEffect(..., [naturalWidth, naturalHeight])` would set
 * up a ResizeObserver once and never notice the swap, leaving it
 * watching a detached node forever and freezing `scale` at a stale,
 * usually-too-small value (this was the "tiny floating box" bug — the
 * observer kept watching a removed node from the neutral layout after
 * the app switched into the spotlight layout). A callback ref re-fires
 * on every attach/detach, so the observer always tracks the node that's
 * actually on screen.
 *
 * `fit` controls how the scale is derived from the available box:
 *  - "contain" (default): scale = min(widthRatio, heightRatio) — the
 *    whole natural box is guaranteed to fit inside the container, but
 *    if the container's aspect ratio doesn't match the natural aspect
 *    ratio, you get empty letterboxing on one axis. This is what
 *    desktop frames use, since we never want the browser chrome cut off.
 *  - "height": scale = heightRatio only — the panel fills the container
 *    top-to-bottom, growing width along with it even if that means the
 *    frame is wider than its cell (the parent Cell has overflow-hidden
 *    and centers the content, so the overflow is clipped symmetrically
 *    left/right rather than leaving dead space above/below). This is
 *    what phone panels use: a phone mockup is meant to look like a
 *    full-height device, not a shrunken thumbnail with letterboxing.
 */
function useCellFit(naturalWidth: number, naturalHeight: number, fit: "contain" | "height" = "contain") {
  const [scale, setScale] = useState(0);
  const [ready, setReady] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const recompute = useCallback(() => {
    const el = nodeRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    // Skip zero/near-zero reads — these happen on first paint before
    // layout settles, and mid-transition while a cell is collapsing
    // toward 0% flex-basis. Recomputing on them would either flash a
    // bogus near-zero scale or (on the way back up) briefly overwrite a
    // good scale with a stale small one before the animation finishes.
    if (cw < 2 || ch < 2) return;
    const widthRatio = cw / naturalWidth;
    const heightRatio = ch / naturalHeight;
    const raw = fit === "height" ? heightRatio : Math.min(widthRatio, heightRatio);
    // No upper clamp: mobile columns are routinely taller than the
    // phone's natural 650px, so capping at 1x left it rendered at native
    // size and centered in a much bigger cell — that dead space around
    // it was the "gap" between the mobile and desktop panels. This is a
    // live DOM re-render scaled via CSS transform, not a raster image,
    // so scaling past 1x doesn't blur — it just fills the column.
    const s = raw * 0.998;
    setScale(Math.max(s, 0.05));
    setReady(true);
  }, [naturalWidth, naturalHeight, fit]);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      nodeRef.current = el;
      if (el) {
        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(el);
        observerRef.current = ro;
      } else {
        // Node detached (panel remounted onto a different element as
        // layout mode changed) — drop readiness so the next attach
        // can't paint a stale scale from the old node for even one
        // frame while waiting on its first real measurement.
        setReady(false);
      }
    },
    [recompute]
  );

  useEffect(() => {
    window.addEventListener("resize", recompute);
    const raf1 = requestAnimationFrame(() => {
      recompute();
      requestAnimationFrame(recompute);
    });
    return () => {
      window.removeEventListener("resize", recompute);
      cancelAnimationFrame(raf1);
    };
  }, [recompute]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref: setRef, scale, ready, boxW: naturalWidth * scale, boxH: naturalHeight * scale };
}

function useSpotlight() {
  const snap = useSyncExternalStore(
    demoModel.subscribe.bind(demoModel),
    getDemoSnapshot,
    getDemoSnapshot
  );
  return {
    activePanels: snap.activePanels as PanelKey[],
    syncPanels: snap.syncPanels as PanelKey[],
  };
}

/** Running broadcast-style timecode (HH:MM:SS:CS), counted from mount. Real
 * telemetry for the multiview bar, not a decorative animation. */
function useTimecode() {
  const [deci, setDeci] = useState(0); // deciseconds since mount
  useEffect(() => {
    const id = setInterval(() => setDeci((d) => d + 1), 100);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const totalSec = Math.floor(deci / 10);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor(totalSec / 60) % 60;
  const s = totalSec % 60;
  const cs = (deci % 10) * 10;
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(cs)}`;
}

/** One column in the row layout. Collapses to 0 width + opacity 0 rather
 * than unmounting, so cursor state / component state survives being
 * hidden and reappearing. */
/** One column in the row layout. Collapses to 0 width + opacity 0 rather
 * than unmounting, so cursor state / component state survives being
 * hidden and reappearing. Also holds opacity at 0 until `ready` is true,
 * so a panel becoming visible never paints its pre-measurement scale
 * (the "ghost" flash) even for a single frame. */
function Cell({
  pct,
  ready,
  isSyncing,
  children,
}: {
  pct: number;
  ready: boolean;
  isSyncing: boolean;
  children: React.ReactNode;
}) {
  const visible = pct > 0 && ready;
  return (
    <div
      className={`min-w-0 h-full flex items-center justify-center overflow-hidden ${isSyncing ? "panel-sync-ring" : ""}`}
      style={{
        flex: `0 0 ${pct}%`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: `flex-basis ${ZOOM_TRANSITION}, opacity ${ZOOM_TRANSITION}`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The page's signature element — a broadcast-truck multiview bar. Turns
 * the abstract spotlight state into literal tally lights instead of
 * decoration: a chip is lit exactly when that feed is currently
 * highlighted, and rings briefly when it's mid-sync (matching the same
 * pulse used on the spotlighted Cell itself).
 */
function MultiviewBar({ active, syncing }: { active: PanelKey[]; syncing: PanelKey[] }) {
  const tc = useTimecode();
  return (
    <div
      className="shrink-0 h-9 flex items-center justify-between px-4 relative z-20"
      style={{
        background: "linear-gradient(180deg, var(--color-surface-container-low), var(--color-surface-dim))",
        borderBottom: "1px solid var(--color-border-overlay)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-1.5 h-1.5 rounded-full bg-red-500"
          style={{ animation: "feedPulse 1.6s ease-in-out infinite" }}
        />
        <span
          className="text-[9px] uppercase"
          style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.22em", color: "var(--color-outline)" }}
        >
          Multiview
        </span>
        <span
          className="text-[11px] tabular-nums"
          style={{
            fontFamily: "var(--font-headline-lg)",
            fontStyle: "italic",
            fontWeight: 700,
            color: "var(--color-on-surface)",
            letterSpacing: "0.02em",
          }}
        >
          {tc}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {PANEL_ORDER.map((key) => {
          const isLive = active.includes(key);
          const isSync = syncing.includes(key);
          return (
            <div
              key={key}
              className="flex items-center gap-1.5 px-2 py-1 rounded"
              style={{
                background: isLive
                  ? "color-mix(in srgb, var(--color-success-green) 12%, transparent)"
                  : "rgba(255,255,255,0.02)",
                border: `1px solid ${
                  isLive
                    ? "color-mix(in srgb, var(--color-success-green) 45%, transparent)"
                    : "var(--color-border-overlay)"
                }`,
                animation: isSync ? "panel-sync-pulse 0.9s ease-out" : undefined,
              }}
            >
              <span
                className="w-[6px] h-[6px] rounded-full shrink-0"
                style={{ background: isLive ? "var(--color-success-green)" : "var(--color-outline)" }}
              />
              <span
                className="text-[8px] uppercase"
                style={{
                  fontFamily: "var(--font-label-mono)",
                  letterSpacing: "0.1em",
                  color: isLive ? "var(--color-on-surface)" : "var(--color-outline)",
                }}
              >
                {PANEL_META[key].num} {PANEL_META[key].label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SandboxPage() {
  const { activePanels, syncPanels } = useSpotlight();

  // Removed the extra "+12" padding on both axes — that padding was
  // being baked directly into the natural size passed to useCellFit,
  // which meant the computed scale always left a visible gap around
  // every desktop frame and shrank the mobile frames unnecessarily.
  // The natural size now matches the frame's real rendered size exactly,
  // so frames fill their cells edge-to-edge.
  const auctioneerCell = useCellFit(DESKTOP_W, DESKTOP_H + DESKTOP_CHROME_H);
  const watchCell = useCellFit(DESKTOP_W, DESKTOP_H + DESKTOP_CHROME_H);
  // Phone panels: fit by height so the device mockup always spans the
  // full available height of its cell instead of shrinking to whichever
  // axis (usually width, in a narrow spotlight column) is tighter.
  const ownerACell = useCellFit(MOBILE_W, MOBILE_H); // default "contain" — keeps the rounded/bordered chrome fully on-screen
  const ownerBCell = useCellFit(MOBILE_W, MOBILE_H);

  const cellReady: Record<PanelKey, boolean> = {
    auctioneer: auctioneerCell.ready,
    watch: watchCell.ready,
    ownerA: ownerACell.ready,
    ownerB: ownerBCell.ready,
  };

  useEffect(() => {
    demoOrchestrator.start();
    return () => demoOrchestrator.stop();
  }, []);

  const highlighted: PanelKey[] = activePanels;
  const layout = computeLayout(highlighted);

  const pctOf = (key: PanelKey) => layout[key] ?? 0;

  const frames: Record<PanelKey, React.ReactNode> = {
    auctioneer: (
      <DesktopFrame width={DESKTOP_W} height={DESKTOP_H} scale={auctioneerCell.scale} label="Auctioneer Console">
        <DemoAuctioneerPage />
      </DesktopFrame>
    ),
    watch: (
      <DesktopFrame width={DESKTOP_W} height={DESKTOP_H} scale={watchCell.scale} label="Broadcast Overlay">
        <DemoWatchPage />
      </DesktopFrame>
    ),
    ownerA: (
      <MobileFrame width={MOBILE_W} height={MOBILE_H} scale={ownerACell.scale}>
        <DemoOwnerBidPage teamId="tA" cursorKey="ownerA" />
      </MobileFrame>
    ),
    ownerB: (
      <MobileFrame width={MOBILE_W} height={MOBILE_H} scale={ownerBCell.scale}>
        <DemoOwnerBidPage teamId="tB" cursorKey="ownerB" />
      </MobileFrame>
    ),
  };

  // Callback refs — same function identity reused across renders (stable
  // from useCallback inside useCellFit), safe to hand straight to `ref`.
  const cellRefs: Record<PanelKey, (el: HTMLDivElement | null) => void> = {
    auctioneer: auctioneerCell.ref,
    watch: watchCell.ref,
    ownerA: ownerACell.ref,
    ownerB: ownerBCell.ref,
  };

  // Exact pixel box each panel's scaled content should occupy — reserved
  // by an inner wrapper so layout space always matches visual scaled
  // size (see useCellFit doc comment above).
  const cellDims: Record<PanelKey, { w: number; h: number }> = {
    auctioneer: { w: auctioneerCell.boxW, h: auctioneerCell.boxH },
    watch: { w: watchCell.boxW, h: watchCell.boxH },
    ownerA: { w: ownerACell.boxW, h: ownerACell.boxH },
    ownerB: { w: ownerBCell.boxW, h: ownerBCell.boxH },
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col">
      <style jsx global>{`
        @keyframes panel-sync-pulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-theme-orange) 55%, transparent); }
          70% { box-shadow: 0 0 0 12px color-mix(in srgb, var(--color-theme-orange) 0%, transparent); }
          100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-theme-orange) 0%, transparent); }
        }

        @keyframes feedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        .sandbox-scanlines {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.012) 0px,
            rgba(255, 255, 255, 0.012) 1px,
            transparent 1px,
            transparent 3px
          );
        }
      `}</style>

      <MultiviewBar active={highlighted} syncing={syncPanels} />

      {/* void background: soft top glow + faint grid + scanlines, anchored
          in the app's own accent rather than a generic radial-blob pair */}
      <div
        className="pointer-events-none absolute inset-0 z-0 sandbox-scanlines"
        style={{
          background:
            "radial-gradient(900px 380px at 50% 0%, color-mix(in srgb, var(--color-theme-orange) 7%, transparent), transparent 65%), " +
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "auto, 48px 48px, 48px 48px",
        }}
      />

      {/* Single full-bleed row, panels sized by computeLayout(). When
          nothing is spotlighted this resolves to Auctioneer 50 / Watch 50
          with both owner phones collapsed to 0 — they only expand in once
          the orchestrator actually spotlights a bidder. Panels collapse to
          0 width rather than unmounting so cursor state survives. */}
      <div className="flex-1 min-h-0 flex relative z-10">
        {PANEL_ORDER.map((key) => (
          <Cell key={key} pct={pctOf(key)} ready={cellReady[key]} isSyncing={syncPanels.includes(key)}>
            <div ref={cellRefs[key]} className="w-full h-full flex items-center justify-center overflow-hidden">
              <div
                style={{ width: cellDims[key].w, height: cellDims[key].h }}
                className="overflow-hidden flex items-center justify-center shrink-0"
              >
                {frames[key]}
              </div>
            </div>
          </Cell>
        ))}
      </div>
    </div>
  );
}