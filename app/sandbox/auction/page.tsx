"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { Shield } from "lucide-react";
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

const DESKTOP_W = 1280;
const DESKTOP_H = 800;
const DESKTOP_CHROME_H = 26;
const MOBILE_W = 390;
const MOBILE_H = 650;
const ZOOM_TRANSITION = "500ms cubic-bezier(0.22,1,0.36,1)";

/**
 * Given the set of currently-highlighted panels, returns each panel's
 * share of screen width (0–100). Panels not present in the result get 0
 * (collapsed, not just dimmed) so whatever IS highlighted can use every
 * spare pixel.
 *
 * Returns {} when nothing is highlighted — caller should fall back to the
 * neutral overview grid in that case.
 */
function computeSpotlightLayout(highlighted: PanelKey[]): Partial<Record<PanelKey, number>> {
  const desktopHi = highlighted.filter((p) => DESKTOP.includes(p));
  const mobileHi = highlighted.filter((p) => MOBILE.includes(p));

  if (desktopHi.length === 0 && mobileHi.length === 0) return {};

  // One desktop alone -> fill the screen.
  if (desktopHi.length === 1 && mobileHi.length === 0) {
    return { [desktopHi[0]]: 100 };
  }

  // One desktop + one mobile -> 75 / 25.
  if (desktopHi.length === 1 && mobileHi.length === 1) {
    return { [desktopHi[0]]: 75, [mobileHi[0]]: 25 };
  }

  // One desktop + two mobiles -> 75 / 12.5 / 12.5.
  if (desktopHi.length === 1 && mobileHi.length === 2) {
    return { [desktopHi[0]]: 75, [mobileHi[0]]: 12.5, [mobileHi[1]]: 12.5 };
  }

  // Two mobiles, no desktop -> side by side, 50 / 50.
  if (desktopHi.length === 0 && mobileHi.length === 2) {
    return { [mobileHi[0]]: 50, [mobileHi[1]]: 50 };
  }

  // One mobile, no desktop highlighted -> mobile gets a quarter, Watch
  // (the always-on spectator screen) takes the rest. Auctioneer stays
  // hidden here since it isn't part of this beat.
  if (desktopHi.length === 0 && mobileHi.length === 1) {
    return { [mobileHi[0]]: 25, watch: 75 };
  }

  // Two desktops highlighted together — not produced by the orchestrator
  // today, kept here so the function is ready if that ever changes.
  if (desktopHi.length === 2 && mobileHi.length === 0) return { auctioneer: 50, watch: 50 };
  if (desktopHi.length === 2 && mobileHi.length === 1) return { auctioneer: 37.5, watch: 37.5, [mobileHi[0]]: 25 };
  if (desktopHi.length === 2 && mobileHi.length === 2) return { auctioneer: 25, watch: 25, ownerA: 25, ownerB: 25 };

  return {};
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
 */
function useCellFit(naturalWidth: number, naturalHeight: number) {
  const [scale, setScale] = useState(0.3);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const recompute = useCallback(() => {
    const el = nodeRef.current;
    if (!el) return;
    const s = Math.min(el.clientWidth / naturalWidth, el.clientHeight / naturalHeight) * 0.995;
    setScale(Math.max(Math.min(s, 1), 0.05));
  }, [naturalWidth, naturalHeight]);

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
      }
    },
    [recompute]
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref: setRef, scale, boxW: naturalWidth * scale, boxH: naturalHeight * scale };
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

/** One column in the row layout. Collapses to 0 width + opacity 0 rather
 * than unmounting, so cursor state / component state survives being
 * hidden and reappearing. */
function Cell({
  pct,
  isSyncing,
  children,
}: {
  pct: number;
  isSyncing: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`min-w-0 h-full flex items-center justify-center overflow-hidden ${isSyncing ? "panel-sync-ring" : ""}`}
      style={{
        flex: `0 0 ${pct}%`,
        opacity: pct > 0 ? 1 : 0,
        pointerEvents: pct > 0 ? "auto" : "none",
        transition: `flex-basis ${ZOOM_TRANSITION}, opacity ${ZOOM_TRANSITION}`,
      }}
    >
      {children}
    </div>
  );
}

export default function SandboxPage() {
  const { activePanels, syncPanels } = useSpotlight();

  const auctioneerCell = useCellFit(DESKTOP_W + 12, DESKTOP_H + DESKTOP_CHROME_H + 12);
  const watchCell = useCellFit(DESKTOP_W + 12, DESKTOP_H + DESKTOP_CHROME_H + 12);
  const ownerACell = useCellFit(MOBILE_W + 12, MOBILE_H + 12);
  const ownerBCell = useCellFit(MOBILE_W + 12, MOBILE_H + 12);

  useEffect(() => {
    demoOrchestrator.start();
    return () => demoOrchestrator.stop();
  }, []);

  const highlighted: PanelKey[] = activePanels;
  const layout = computeSpotlightLayout(highlighted);
  const isDefault = Object.keys(layout).length === 0;

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
    <div className="h-screen w-screen bg-black overflow-hidden relative flex flex-col">
      <style jsx global>{`
        @keyframes panel-sync-pulse {
          0% { box-shadow: 0 0 0 0 rgba(245,166,35,0.6); }
          70% { box-shadow: 0 0 0 14px rgba(245,166,35,0); }
          100% { box-shadow: 0 0 0 0 rgba(245,166,35,0); }
        }
        .panel-sync-ring { animation: panel-sync-pulse 0.9s ease-out; }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(1200px 500px at 50% 0%, rgba(245,166,35,0.08), transparent 60%), radial-gradient(1000px 500px at 50% 100%, rgba(245,166,35,0.05), transparent 60%)",
        }}
      />

      {isDefault ? (
        // ── Neutral state: nothing highlighted ── two balanced bands,
        // mobiles on top, desktops on bottom — same as the original.
        <>
          <div
            className="min-h-0 flex items-center justify-center bg-black relative z-10 gap-10 overflow-hidden"
            style={{ flex: "42 1 0%" }}
          >
            <div ref={ownerACell.ref} className="flex items-center justify-center overflow-hidden h-full" style={{ aspectRatio: `${MOBILE_W} / ${MOBILE_H}` }}>
              {frames.ownerA}
            </div>
            <div className="shrink-0 flex flex-col items-center justify-center px-6">
              <Shield className="w-5 h-5 text-gold mb-2" />
              <p className="font-cinzel font-bold uppercase tracking-wider text-white text-lg leading-none text-center whitespace-nowrap">
                Valiant <span className="text-gold">League</span>
              </p>
              <p className="font-mono uppercase tracking-[0.3em] text-gold/50 text-[9px] mt-2 whitespace-nowrap">
                Live Auction Room
              </p>
            </div>
            <div ref={ownerBCell.ref} className="flex items-center justify-center overflow-hidden h-full" style={{ aspectRatio: `${MOBILE_W} / ${MOBILE_H}` }}>
              {frames.ownerB}
            </div>
          </div>
          <div className="h-px bg-gold/10 shrink-0 relative z-10" />
          <div
            className="min-h-0 flex gap-px bg-gold/10 overflow-hidden relative z-10"
            style={{ flex: "58 1 0%" }}
          >
            <div ref={auctioneerCell.ref} className="bg-black flex-1 flex items-center justify-center overflow-hidden">
              {frames.auctioneer}
            </div>
            <div ref={watchCell.ref} className="bg-black flex-1 flex items-center justify-center overflow-hidden">
              {frames.watch}
            </div>
          </div>
        </>
      ) : (
        // ── Spotlight state: single full-bleed row, panels sized by
        // computeSpotlightLayout(). Hidden panels collapse to 0 instead
        // of unmounting so cursor state survives.
        <div className="flex-1 min-h-0 flex relative z-10">
          {PANEL_ORDER.map((key) => (
            <Cell key={key} pct={pctOf(key)} isSyncing={syncPanels.includes(key)}>
              <div ref={cellRefs[key]} className="w-full h-full flex items-center justify-center overflow-hidden">
                <div
                  style={{ width: cellDims[key].w, height: cellDims[key].h }}
                  className="overflow-hidden flex items-center justify-center"
                >
                  {frames[key]}
                </div>
              </div>
            </Cell>
          ))}
        </div>
      )}
    </div>
  );
}