"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { demoOrchestrator } from "@/lib/demo/demoOrchestrator";
import { demoInteractiveController } from "@/lib/demo/demoInteractiveController";
import { demoModel, getDemoSnapshot } from "@/lib/demo/demoModel";
import { DesktopFrame, MobileFrame } from "@/components/demo/DeviceFrames";
import DemoAuctioneerPage from "@/components/demo/DemoAuctioneerPage";
import DemoOwnerBidPage from "@/components/demo/DemoOwnerBidPage";
import DemoWatchPage from "@/components/demo/DemoWatchPage";

type PanelKey = "auctioneer" | "watch" | "ownerA" | "ownerB";
const DESKTOP: PanelKey[] = ["auctioneer", "watch"];
const MOBILE: PanelKey[] = ["ownerA", "ownerB"];
const PANEL_ORDER: PanelKey[] = ["auctioneer", "watch", "ownerA", "ownerB"];

// Watch is spectator-only in every mode — nothing to click there, so it's
// excluded from the clickable-chip behavior even in interactive mode.
const CONTROLLABLE: PanelKey[] = ["auctioneer", "ownerA", "ownerB"];

const OWNER_DISPLAY_NAME: Record<"ownerA" | "ownerB", string> = {
  ownerA: "Owner A",
  ownerB: "Owner B",
};

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
    mode: snap.mode,
    autoFocusEnabled: snap.autoFocusEnabled,
    teams: snap.auction.teams,
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

// Right-edge vertical stepper for the two owner panels — two nodes joined
// by a connecting line, each colored to its team. Doubles as a mini legend
// as well as the switch control. Only relevant in interactive mode, and
// only while at least one owner panel is part of the current spotlight —
// during shuffle/sold/unsold beats (auctioneer + watch only) there's
// nothing to switch to yet, so it stays hidden rather than dangling
// irrelevant.
function OwnerDotSwitcher({
  mode,
  active,
  teams,
  onSelect,
}: {
  mode: "demo" | "interactive";
  active: PanelKey[];
  teams: { supabaseId: string; code: string; name: string; color: string }[];
  onSelect: (owner: "ownerA" | "ownerB") => void;
}) {
  const hasA = active.includes("ownerA");
  const hasB = active.includes("ownerB");
  if (mode !== "interactive" || (!hasA && !hasB)) return null;

  const teamFor = (owner: "ownerA" | "ownerB") =>
    teams.find((t) => t.supabaseId === (owner === "ownerA" ? "tA" : "tB"));

  const colorA = teamFor("ownerA")?.color ?? "var(--color-outline)";
  const colorB = teamFor("ownerB")?.color ?? "var(--color-outline)";
  const activeColor = hasA ? colorA : colorB;

  return (
    <div
      className="fixed right-5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center"
      style={{
        background: "rgba(10,10,10,0.6)",
        border: "1px solid var(--color-border-overlay)",
        borderRadius: 999,
        padding: "18px 11px",
        backdropFilter: "blur(6px)",
      }}
    >
      {(["ownerA", "ownerB"] as const).map((owner, i) => {
        const isActive = active.includes(owner);
        const team = teamFor(owner);
        const color = team?.color ?? "var(--color-outline)";
        return (
          <div key={owner} className="flex flex-col items-center">
            <button
              onClick={() => onSelect(owner)}
              title={team?.name ?? OWNER_DISPLAY_NAME[owner]}
              className="group relative flex items-center justify-center"
              style={{ cursor: isActive ? "default" : "pointer", width: 26, height: 26 }}
            >
              <span
                className="absolute right-full mr-2.5 px-1.5 py-0.5 rounded text-[8px] uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{
                  fontFamily: "var(--font-label-mono)",
                  letterSpacing: "0.08em",
                  background: "rgba(10,10,10,0.9)",
                  border: `1px solid color-mix(in srgb, ${color} 50%, transparent)`,
                  color: "var(--color-on-surface)",
                }}
              >
                {team?.name ?? OWNER_DISPLAY_NAME[owner]}
              </span>
              {/* Outer ring only lights up on the active step, like a
                  progress-stepper node. */}
              <span
                className="absolute rounded-full transition-all"
                style={{
                  width: isActive ? 26 : 0,
                  height: isActive ? 26 : 0,
                  border: `1.5px solid ${color}`,
                  opacity: isActive ? 0.5 : 0,
                }}
              />
              <span
                className="rounded-full transition-all"
                style={{
                  width: isActive ? 15 : 8,
                  height: isActive ? 15 : 8,
                  background: color,
                  boxShadow: isActive
                    ? `0 0 10px 1px color-mix(in srgb, ${color} 70%, transparent)`
                    : "none",
                  border: isActive ? "none" : `1px solid color-mix(in srgb, ${color} 55%, transparent)`,
                }}
              />
            </button>
            {/* Connecting rail between the two steps. */}
            {i === 0 && (
              <span
                className="w-px"
                style={{
                  height: 22,
                  margin: "6px 0",
                  background: `linear-gradient(180deg, ${colorA}, ${colorB})`,
                  opacity: 0.35,
                }}
              />
            )}
          </div>
        );
      })}

      <span
        className="mt-2 text-[7px] uppercase"
        style={{
          fontFamily: "var(--font-label-mono)",
          letterSpacing: "0.14em",
          color: activeColor,
          opacity: 0.85,
        }}
      >
        {(hasA ? teamFor("ownerA")?.code : teamFor("ownerB")?.code) ?? ""}
      </span>
    </div>
  );
}

function MultiviewBar({
  active,
  syncing,
  mode,
  autoFocusEnabled,
  onToggleMode,
}: {
  active: PanelKey[];
  syncing: PanelKey[];
  mode: "demo" | "interactive";
  autoFocusEnabled: boolean;
  onToggleMode: () => void;
}) {
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

        {mode === "interactive" && !autoFocusEnabled && (
          <button
            onClick={() => demoModel.resumeAutoFocus()}
            className="ml-1 px-2 py-0.5 rounded-full text-[8px] uppercase"
            style={{
              fontFamily: "var(--font-label-mono)",
              letterSpacing: "0.1em",
              background: "color-mix(in srgb, var(--color-theme-orange) 15%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-theme-orange) 40%, transparent)",
              color: "var(--color-theme-orange)",
              cursor: "pointer",
            }}
          >
            Resume auto-switch
          </button>
        )}

      </div>

      <div className="flex items-center gap-2">
        {PANEL_ORDER.map((key) => {
          const isLive = active.includes(key);
          const isSync = syncing.includes(key);
          const clickable = mode === "interactive" && CONTROLLABLE.includes(key);
          return (
            <div
              key={key}
              onClick={clickable ? () => demoModel.toggleActivePanel(key) : undefined}
              className="flex items-center gap-1.5 px-2 py-1 rounded"
              style={{
                background: isLive
                  ? "color-mix(in srgb, var(--color-theme-orange) 12%, transparent)"
                  : "rgba(255,255,255,0.02)",
                border: `1px solid ${
                  isLive
                    ? "color-mix(in srgb, var(--color-theme-orange) 45%, transparent)"
                    : "var(--color-border-overlay)"
                }`,
                animation: isSync ? "panel-sync-pulse 0.9s ease-out" : undefined,
                cursor: clickable ? "pointer" : "default",
              }}
            >
              <span
                className="w-[6px] h-[6px] rounded-full shrink-0"
                style={{ background: isLive ? "var(--color-theme-orange)" : "var(--color-outline)" }}
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

        <button
          onClick={onToggleMode}
          className="ml-2 px-2.5 py-1 rounded text-[8px] uppercase"
          style={{
            fontFamily: "var(--font-label-mono)",
            letterSpacing: "0.1em",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--color-border-overlay)",
            color: "var(--color-on-surface)",
            cursor: "pointer",
          }}
        >
          {mode === "demo" ? "Watching demo — Try it yourself" : "Playing — Watch demo"}
        </button>
      </div>
    </div>
  );
}

export default function SandboxPage() {
  const { activePanels, syncPanels, mode, autoFocusEnabled, teams } = useSpotlight();

  const auctioneerCell = useCellFit(DESKTOP_W, DESKTOP_H + DESKTOP_CHROME_H);
  const watchCell = useCellFit(DESKTOP_W, DESKTOP_H + DESKTOP_CHROME_H);
  // Fit both dimensions ("contain") so the mobile frame never overflows its
  // flex cell, no matter how narrow that cell gets.
  const ownerACell = useCellFit(MOBILE_W, MOBILE_H, "contain");
  const ownerBCell = useCellFit(MOBILE_W, MOBILE_H, "contain");

  const cellReady: Record<PanelKey, boolean> = {
    auctioneer: auctioneerCell.ready,
    watch: watchCell.ready,
    ownerA: ownerACell.ready,
    ownerB: ownerBCell.ready,
  };

  // Starts in demo (bot-driven) mode, same as it always did. Switching
  // modes tears down whichever driver was running and reset()s the model
  // so the two never overlap or fight over state.
  useEffect(() => {
    demoOrchestrator.start();
    return () => {
      demoOrchestrator.stop();
      demoInteractiveController.stop();
    };
  }, []);

  const handleToggleMode = useCallback(() => {
    const next = mode === "demo" ? "interactive" : "demo";
    if (next === "interactive") {
      demoOrchestrator.stop();
      demoInteractiveController.start();
    } else {
      demoInteractiveController.stop();
      demoOrchestrator.start();
    }
  }, [mode]);

  // globals.css forces `html { overflow-y: scroll }` site-wide so the
  // marketing pages never jump-shift. This page is a fixed single
  // viewport, so we suppress that just while mounted and put it back
  // on unmount rather than touching the global rule.
  useEffect(() => {
    const html = document.documentElement;
    const prevHtmlOverflow = html.style.overflowY;
    const prevBodyOverflow = document.body.style.overflow;
    html.style.overflowY = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflowY = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const highlighted: PanelKey[] = activePanels;
  const layout = computeLayout(highlighted);

  const pctOf = (key: PanelKey) => layout[key] ?? 0;

  // Exactly one owner spotlighted → offer a button to flip to the other one.
  // Both, neither, or the owner-picking UI already visible (chips) covers
  // every other case, so the button only appears in the single-owner state.
  const hasA = highlighted.includes("ownerA");
  const hasB = highlighted.includes("ownerB");
  const switchToOwner: "ownerA" | "ownerB" | null = hasA && !hasB ? "ownerB" : hasB && !hasA ? "ownerA" : null;

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

      <MultiviewBar
        active={highlighted}
        syncing={syncPanels}
        mode={mode}
        autoFocusEnabled={autoFocusEnabled}
        onToggleMode={handleToggleMode}
        switchToOwner={switchToOwner}
        onSwitchOwner={() => switchToOwner && demoModel.focusOwner(switchToOwner)}
      />

      <OwnerDotSwitcher
        mode={mode}
        active={highlighted}
        teams={teams}
        onSelect={(owner) => demoModel.focusOwner(owner)}
      />

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