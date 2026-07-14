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
const PANEL_ORDER: PanelKey[] = ["auctioneer", "watch", "ownerA", "ownerB"];

const DESKTOP_W = 1350;
const DESKTOP_H = 800;
const DESKTOP_CHROME_H = 26;
const MOBILE_W = 400;
const MOBILE_H = 750;
const ZOOM_TRANSITION = "500ms cubic-bezier(0.22,1,0.36,1)";

const PANEL_META: Record<PanelKey, { num: string; label: string }> = {
  auctioneer: { num: "01", label: "Auctioneer" },
  watch: { num: "02", label: "Broadcast" },
  ownerA: { num: "03", label: "Owner A" },
  ownerB: { num: "04", label: "Owner B" },
};

function computeLayout(highlighted: PanelKey[]): Record<PanelKey, number> {
  const base: Record<PanelKey, number> = { auctioneer: 0, watch: 0, ownerA: 0, ownerB: 0 };
  const desktopHi = highlighted.filter((p) => DESKTOP.includes(p));
  const mobileHi = highlighted.filter((p) => MOBILE.includes(p));

  if (desktopHi.length === 0 && mobileHi.length === 0) return { ...base, auctioneer: 50, watch: 50 };
  if (desktopHi.length === 1 && mobileHi.length === 0) return { ...base, [desktopHi[0]]: 75, ownerA: 25 };
  if (desktopHi.length === 1 && mobileHi.length === 1) return { ...base, [desktopHi[0]]: 75, [mobileHi[0]]: 25 };
  if (desktopHi.length === 1 && mobileHi.length === 2) return { ...base, [desktopHi[0]]: 75, [mobileHi[0]]: 12.5, [mobileHi[1]]: 12.5 };
  if (desktopHi.length === 0 && mobileHi.length === 2) return { ...base, [mobileHi[0]]: 50, [mobileHi[1]]: 50 };
  if (desktopHi.length === 0 && mobileHi.length === 1) return { ...base, [mobileHi[0]]: 25, watch: 75 };
  if (desktopHi.length === 2 && mobileHi.length === 0) return { ...base, auctioneer: 50, watch: 50 };
  if (desktopHi.length === 2 && mobileHi.length === 1) return { ...base, auctioneer: 37.5, watch: 37.5, [mobileHi[0]]: 25 };
  if (desktopHi.length === 2 && mobileHi.length === 2) return { ...base, auctioneer: 25, watch: 25, ownerA: 25, ownerB: 25 };

  return { ...base, auctioneer: 50, watch: 50 };
}

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
    if (cw < 2 || ch < 2) return;
    const widthRatio = cw / naturalWidth;
    const heightRatio = ch / naturalHeight;
    const raw = fit === "height" ? heightRatio : Math.min(widthRatio, heightRatio);
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

function useTimecode() {
  const [deci, setDeci] = useState(0);
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

function Cell({ pct, ready, isSyncing, children }: { pct: number; ready: boolean; isSyncing: boolean; children: React.ReactNode }) {
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

  const auctioneerCell = useCellFit(DESKTOP_W, DESKTOP_H + DESKTOP_CHROME_H);
  const watchCell = useCellFit(DESKTOP_W, DESKTOP_H + DESKTOP_CHROME_H);
  // Fit by height to allow proper stretching in the cell constraints
  const ownerACell = useCellFit(MOBILE_W, MOBILE_H, "height");
  const ownerBCell = useCellFit(MOBILE_W, MOBILE_H, "height");

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

  const cellRefs: Record<PanelKey, (el: HTMLDivElement | null) => void> = {
    auctioneer: auctioneerCell.ref,
    watch: watchCell.ref,
    ownerA: ownerACell.ref,
    ownerB: ownerBCell.ref,
  };

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

      <div
        className="pointer-events-none absolute inset-0 z-0 sandbox-scanlines"
        style={{
          background:
            "radial-gradient(900px 380px at 50% 0%, color-mix(in srgb, var(--color-theme-orange) 7%, transparent), transparent 65%), " +
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "auto, 48px 48px, 48px 48px",
        }}
      />

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