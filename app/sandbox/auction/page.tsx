"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Shield } from "lucide-react";
import { demoOrchestrator } from "@/lib/demo/demoOrchestrator";
import { demoModel } from "@/lib/demo/demoModel";
import { DesktopFrame, MobileFrame } from "@/components/demo/DeviceFrames";
import DemoAuctioneerPage from "@/components/demo/DemoAuctioneerPage";
import DemoOwnerBidPage from "@/components/demo/DemoOwnerBidPage";
import DemoWatchPage from "@/components/demo/DemoWatchPage";

function useCellFit(naturalWidth: number, naturalHeight: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function recompute() {
      if (!el) return;
      const s = Math.min(el.clientWidth / naturalWidth, el.clientHeight / naturalHeight) * 0.98;
      setScale(Math.max(Math.min(s, 1), 0.1));
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidth, naturalHeight]);

  return { ref, scale };
}

function useSpotlight() {
  const snap = useSyncExternalStore(demoModel.subscribe.bind(demoModel), demoModel.getSnapshot.bind(demoModel));
  return { activePanel: snap.activePanel, syncPanels: snap.syncPanels };
}

function Spotlight({
  panelKey,
  activePanel,
  syncPanels,
  children,
}: {
  panelKey: string;
  activePanel: string | null;
  syncPanels: string[];
  children: React.ReactNode;
}) {
  const isActive = activePanel === panelKey;
  const isSyncing = syncPanels.includes(panelKey);
  const isDimmed = activePanel !== null && !isActive && !isSyncing;

  return (
    <div
      className={`transition-all duration-500 ease-out ${isSyncing ? "panel-sync-ring" : ""}`}
      style={{
        transform: isActive ? "scale(1.03)" : isDimmed ? "scale(0.96)" : "scale(1)",
        opacity: isDimmed ? 0.35 : 1,
        filter: isDimmed ? "saturate(0.5)" : "saturate(1)",
        zIndex: isActive ? 30 : isSyncing ? 20 : 1,
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

const DESKTOP_W = 1280;
const DESKTOP_H = 800;
const DESKTOP_CHROME_H = 26; // height of the traffic-light bar added to DesktopFrame
const MOBILE_W = 390;
const MOBILE_H = 650;

// Shared timing for every size/opacity change driven by spotlight state,
// so the whole layout reflows as one coordinated "zoom" rather than
// several independently-timed transitions.
const ZOOM_TRANSITION = "500ms cubic-bezier(0.22,1,0.36,1)";

export default function SandboxPage() {
  const { activePanel, syncPanels } = useSpotlight();

  const auctioneerCell = useCellFit(DESKTOP_W + 12, DESKTOP_H + DESKTOP_CHROME_H + 12);
  const watchCell = useCellFit(DESKTOP_W + 12, DESKTOP_H + DESKTOP_CHROME_H + 12);
  const ownerACell = useCellFit(MOBILE_W + 12, MOBILE_H + 12);
  const ownerBCell = useCellFit(MOBILE_W + 12, MOBILE_H + 12);

  useEffect(() => {
    demoOrchestrator.start();
    return () => demoOrchestrator.stop();
  }, []);

  const topIsActive = activePanel === "ownerA" || activePanel === "ownerB";
  const bottomIsActive = activePanel === "auctioneer" || activePanel === "watch";

  // Band heights: whichever band holds the spotlighted panel grows to ~80%,
  // the other collapses to a thin dock strip. With nothing spotlighted we
  // fall back to the original 42/58 split.
  const topBandPct = topIsActive ? 80 : bottomIsActive ? 13 : 42;
  const bottomBandPct = 100 - topBandPct;

  // Within the mobile row, the non-active phone shrinks further so the
  // active one visibly dominates even though both share the same band height.
  const ownerAHeightPct = activePanel === "ownerB" ? 55 : 100;
  const ownerBHeightPct = activePanel === "ownerA" ? 55 : 100;

  // Within the desktop row, bias flex-grow toward whichever is active.
  const auctioneerGrow = activePanel === "auctioneer" ? 3 : activePanel === "watch" ? 1 : 1;
  const watchGrow = activePanel === "watch" ? 3 : activePanel === "auctioneer" ? 1 : 1;

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

      {/* ambient gold vignette, same restrained accent language as the
          landing page's section-gradient / hero-gradient washes */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(1200px 500px at 50% 0%, rgba(245,166,35,0.08), transparent 60%), radial-gradient(1000px 500px at 50% 100%, rgba(245,166,35,0.05), transparent 60%)",
        }}
      />

      {/* TOP BAND: mobile pair. Height and per-phone size respond to activePanel. */}
      <div
        className="min-h-0 flex items-center justify-center bg-black relative z-10 gap-10 overflow-hidden"
        style={{ height: `${topBandPct}%`, transition: `height ${ZOOM_TRANSITION}` }}
      >
        <div
          ref={ownerACell.ref}
          className="flex items-center justify-center overflow-hidden"
          style={{
            height: `${ownerAHeightPct}%`,
            aspectRatio: `${MOBILE_W} / ${MOBILE_H}`,
            transition: `height ${ZOOM_TRANSITION}`,
          }}
        >
          <Spotlight panelKey="ownerA" activePanel={activePanel} syncPanels={syncPanels}>
            <MobileFrame width={MOBILE_W} height={MOBILE_H} scale={ownerACell.scale}>
              <DemoOwnerBidPage teamId="tA" cursorKey="ownerA" />
            </MobileFrame>
          </Spotlight>
        </div>

        {/* title sits in the natural gap between the phones; steps aside once a
            desktop panel takes over the band so it doesn't get crushed */}
        <div
          className="shrink-0 flex flex-col items-center justify-center px-6 overflow-hidden"
          style={{
            opacity: bottomIsActive ? 0 : 1,
            maxWidth: bottomIsActive ? 0 : 240,
            transition: `opacity ${ZOOM_TRANSITION}, max-width ${ZOOM_TRANSITION}`,
          }}
        >
          <Shield className="w-5 h-5 text-gold mb-2" />
          <p className="font-cinzel font-bold uppercase tracking-wider text-white text-lg leading-none text-center whitespace-nowrap">
            Valiant <span className="text-gold">League</span>
          </p>
          <p className="font-mono uppercase tracking-[0.3em] text-gold/50 text-[9px] mt-2 whitespace-nowrap">
            Live Auction Room
          </p>
        </div>

        <div
          ref={ownerBCell.ref}
          className="flex items-center justify-center overflow-hidden"
          style={{
            height: `${ownerBHeightPct}%`,
            aspectRatio: `${MOBILE_W} / ${MOBILE_H}`,
            transition: `height ${ZOOM_TRANSITION}`,
          }}
        >
          <Spotlight panelKey="ownerB" activePanel={activePanel} syncPanels={syncPanels}>
            <MobileFrame width={MOBILE_W} height={MOBILE_H} scale={ownerACell.scale} >
              <DemoOwnerBidPage teamId="tB" cursorKey="ownerB" />
            </MobileFrame>
          </Spotlight>
        </div>
      </div>

      <div className="h-px bg-gold/10 shrink-0 relative z-10" />

      {/* BOTTOM BAND: desktop pair. Height and per-panel flex-grow respond to activePanel. */}
      <div
        className="min-h-0 flex gap-px bg-gold/10 overflow-hidden relative z-10"
        style={{ height: `${bottomBandPct}%`, transition: `height ${ZOOM_TRANSITION}` }}
      >
        <div
          ref={auctioneerCell.ref}
          className="bg-black flex items-center justify-center overflow-hidden"
          style={{ flexGrow: auctioneerGrow, flexBasis: 0, transition: `flex-grow ${ZOOM_TRANSITION}` }}
        >
          <Spotlight panelKey="auctioneer" activePanel={activePanel} syncPanels={syncPanels}>
            <DesktopFrame width={DESKTOP_W} height={DESKTOP_H} scale={auctioneerCell.scale} label="Auctioneer Console">
              <DemoAuctioneerPage />
            </DesktopFrame>
          </Spotlight>
        </div>

        <div
          ref={watchCell.ref}
          className="bg-black flex items-center justify-center overflow-hidden"
          style={{ flexGrow: watchGrow, flexBasis: 0, transition: `flex-grow ${ZOOM_TRANSITION}` }}
        >
          <Spotlight panelKey="watch" activePanel={activePanel} syncPanels={syncPanels}>
            <DesktopFrame width={DESKTOP_W} height={DESKTOP_H} scale={watchCell.scale} label="Broadcast Overlay">
              <DemoWatchPage />
            </DesktopFrame>
          </Spotlight>
        </div>
      </div>
    </div>
  );
}