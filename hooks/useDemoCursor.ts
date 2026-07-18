"use client";

// Drives a DemoCursor-shaped state object to real DOM elements — looked
// up by plain, globally-unique `id="demo-xxx"` attributes — and fires
// REAL interactions on them (click / native value-setter + change /
// native value-setter + input), rather than calling engine functions
// directly.
//
// COORDINATE SPACE: cursor coordinates are viewport-relative
// (getBoundingClientRect() as-is), matching DemoCursor.tsx rendering via
// a portal straight to document.body with `position: fixed` — same
// trick the app's own dialogs use (WicketDetailDialog / EndInningsDialog
// / RestartMatchDialog all portal to document.body at z-index 9000), so
// the cursor renders above them instead of being clipped underneath.
//
// CLICK VISIBILITY: the ghost cursor alone isn't enough for a viewer to
// tell *which exact control* just got hit, especially on small buttons
// or when several sit close together. Every interaction here now also
// applies a real, brief flash directly to the target DOM element itself
// (a ring + scale pulse via an injected global stylesheet), so the
// button/input visibly reacts on its own, independent of whatever
// hover/active styles the component already defines.
//
// All driver "steps" are serialized through a promise chain so two
// scripted actions never race.

import { useCallback, useRef, useState } from "react";
import type { CursorState } from "@/components/demo/DemoCursor";

const TRAVEL_MS = 1400;
const HOLD_MS = 600;
const SCROLL_SETTLE_MS = 550;
const VIEWPORT_MARGIN = 40;

// How long the on-element flash stays visible. Kept a bit shorter than
// HOLD_MS so it reads as "this just got hit" rather than lingering.
const FLASH_MS = 520;

let flashStylesInjected = false;
function ensureFlashStyles() {
  if (flashStylesInjected || typeof document === "undefined") return;
  flashStylesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-demo-cursor-flash", "true");
  style.textContent = `
    @keyframes demoElementFlashRing {
      0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.0), 0 0 0 0 var(--demo-flash-color, #c9971f); }
      12%  { box-shadow: 0 0 0 3px rgba(255,255,255,0.35), 0 0 0 5px var(--demo-flash-color, #c9971f); }
      100% { box-shadow: 0 0 0 3px rgba(255,255,255,0), 0 0 0 5px rgba(0,0,0,0); }
    }
    @keyframes demoElementFlashScale {
      0%   { transform: scale(1); }
      15%  { transform: scale(0.94); }
      40%  { transform: scale(1.045); }
      100% { transform: scale(1); }
    }
    .demo-click-flash {
      animation: demoElementFlashRing ${FLASH_MS}ms cubic-bezier(0.22,1,0.36,1),
                 demoElementFlashScale ${FLASH_MS}ms cubic-bezier(0.22,1,0.36,1);
      border-radius: inherit;
      position: relative;
      z-index: 2;
    }
  `;
  document.head.appendChild(style);
}

function flashElement(el: HTMLElement, color: string) {
  ensureFlashStyles();
  el.style.setProperty("--demo-flash-color", color);
  // Restart the animation even if it's still running from a very fast
  // prior step on the same element (rare, but happens with the extras
  // segmented control).
  el.classList.remove("demo-click-flash");
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  void el.offsetWidth; // force reflow so the class removal registers
  el.classList.add("demo-click-flash");
  setTimeout(() => el.classList.remove("demo-click-flash"), FLASH_MS + 40);
}

function isInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return (
    rect.top >= VIEWPORT_MARGIN &&
    rect.left >= VIEWPORT_MARGIN &&
    rect.bottom <= vh - VIEWPORT_MARGIN &&
    rect.right <= vw - VIEWPORT_MARGIN &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function ensureVisible(el: HTMLElement): Promise<void> {
  if (isInViewport(el)) return Promise.resolve();
  el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  return new Promise((resolve) => setTimeout(resolve, SCROLL_SETTLE_MS));
}

export interface DemoCursorController {
  cursor: CursorState;
  click: (id: string, label: string, color?: string) => Promise<boolean>;
  selectOption: (id: string, value: string, label: string, color?: string) => Promise<boolean>;
  clickByText: (containerId: string, text: string, label: string, color?: string) => Promise<boolean>;
  // Types real text into a text <input> via the native value setter +
  // a dispatched "input" event (so any onChange handler sees it), used
  // for the Fielder (if any) field on run-outs / catches / stumpings.
  typeText: (id: string, text: string, label: string, color?: string) => Promise<boolean>;
  wait: (ms: number) => Promise<void>;
  hide: () => void;
  reset: () => void;
}

export function useDemoCursor(_containerRef?: React.RefObject<HTMLElement | null>): DemoCursorController {
  const [cursor, setCursor] = useState<CursorState>({
    x: 40,
    y: 40,
    visible: false,
    clicking: false,
    color: "#c9971f",
    label: "",
  });

  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const cancelledRef = useRef(false);
  const generationRef = useRef(0);

  const positionFor = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  function chain(fn: () => Promise<boolean>): Promise<boolean> {
    const gen = generationRef.current;
    const p = chainRef.current.then(
      () =>
        new Promise<boolean>((resolve) => {
          if (cancelledRef.current || gen !== generationRef.current) return resolve(false);
          fn().then(resolve);
        })
    );
    chainRef.current = p.then(() => undefined);
    return p;
  }

  const click = useCallback(
    (id: string, label: string, color = "#c9971f") =>
      chain(
        () =>
          new Promise<boolean>((resolve) => {
            const el = document.getElementById(id);
            if (!el) return resolve(false);

            const proceed = () => {
              if (cancelledRef.current) return resolve(false);
              const pos = positionFor(el);
              setCursor((c) => ({ ...c, visible: true, x: pos.x, y: pos.y, label, color, clicking: false }));
              setTimeout(() => {
                if (cancelledRef.current) return resolve(false);
                setCursor((c) => ({ ...c, clicking: true }));
                flashElement(el, color);
                el.click();
                setTimeout(() => {
                  setCursor((c) => ({ ...c, clicking: false }));
                  resolve(true);
                }, HOLD_MS);
              }, TRAVEL_MS);
            };

            ensureVisible(el).then(proceed);
          })
      ),
    [positionFor]
  );

  const selectOption = useCallback(
    (id: string, value: string, label: string, color = "#c9971f") =>
      chain(
        () =>
          new Promise<boolean>((resolve) => {
            const el = document.getElementById(id) as HTMLSelectElement | null;
            if (!el) return resolve(false);

            const proceed = () => {
              if (cancelledRef.current) return resolve(false);
              const pos = positionFor(el);
              setCursor((c) => ({ ...c, visible: true, x: pos.x, y: pos.y, label, color, clicking: false }));

              setTimeout(() => {
                if (cancelledRef.current) return resolve(false);
                setCursor((c) => ({ ...c, clicking: true }));
                flashElement(el, color);

                const proto = window.HTMLSelectElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
                if (setter) {
                  setter.call(el, value);
                } else {
                  el.value = value;
                }
                el.dispatchEvent(new Event("change", { bubbles: true }));

                setTimeout(() => {
                  setCursor((c) => ({ ...c, clicking: false }));
                  resolve(true);
                }, HOLD_MS);
              }, TRAVEL_MS);
            };

            ensureVisible(el).then(proceed);
          })
      ),
    [positionFor]
  );

  const typeText = useCallback(
    (id: string, text: string, label: string, color = "#c9971f") =>
      chain(
        () =>
          new Promise<boolean>((resolve) => {
            const el = document.getElementById(id) as HTMLInputElement | null;
            if (!el) return resolve(false);

            const proceed = () => {
              if (cancelledRef.current) return resolve(false);
              const pos = positionFor(el);
              setCursor((c) => ({ ...c, visible: true, x: pos.x, y: pos.y, label, color, clicking: false }));

              setTimeout(() => {
                if (cancelledRef.current) return resolve(false);
                setCursor((c) => ({ ...c, clicking: true }));
                flashElement(el, color);

                el.focus();
                const proto = window.HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
                if (setter) {
                  setter.call(el, text);
                } else {
                  el.value = text;
                }
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));

                setTimeout(() => {
                  setCursor((c) => ({ ...c, clicking: false }));
                  resolve(true);
                }, HOLD_MS);
              }, TRAVEL_MS);
            };

            ensureVisible(el).then(proceed);
          })
      ),
    [positionFor]
  );

  const clickByText = useCallback(
    (containerId: string, text: string, label: string, color = "#c9971f") =>
      chain(
        () =>
          new Promise<boolean>((resolve) => {
            const container = document.getElementById(containerId);
            if (!container) return resolve(false);
            const candidates = Array.from(container.querySelectorAll<HTMLElement>("button, [role='button']"));
            const target = candidates.find((n) => n.textContent?.trim() === text);
            if (!target) return resolve(false);

            const proceed = () => {
              if (cancelledRef.current) return resolve(false);
              const pos = positionFor(target);
              setCursor((c) => ({ ...c, visible: true, x: pos.x, y: pos.y, label, color, clicking: false }));

              setTimeout(() => {
                if (cancelledRef.current) return resolve(false);
                setCursor((c) => ({ ...c, clicking: true }));
                flashElement(target, color);
                target.click();
                setTimeout(() => {
                  setCursor((c) => ({ ...c, clicking: false }));
                  resolve(true);
                }, HOLD_MS);
              }, TRAVEL_MS);
            };

            ensureVisible(target).then(proceed);
          })
      ),
    [positionFor]
  );

  const wait = useCallback(
    (ms: number) => chain(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), ms))).then(() => undefined),
    []
  );

  const hide = useCallback(() => setCursor((c) => ({ ...c, visible: false })), []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    generationRef.current += 1;
    chainRef.current = Promise.resolve();
    queueMicrotask(() => {
      cancelledRef.current = false;
    });
  }, []);

  return { cursor, click, selectOption, clickByText, typeText, wait, hide, reset };
}