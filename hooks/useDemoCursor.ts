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
// OCCLUSION FIX: `ensureVisible` doesn't just trust
// getBoundingClientRect() to decide "is this on screen" — a sticky
// section header can sit at a higher z-index directly over a target
// whose rect nonetheless reports as "within the viewport". Checking
// document.elementFromPoint() at the target's center catches that and
// forces a scroll + resettle instead of clicking/flashing blind.
//
// CENTERING FIX: scrollIntoView({block:"center"}) is unreliable once the
// page has nested `overflow-auto` scroll containers (the scoring
// console sits inside its own scrollable wrapper div rather than the
// window scrolling directly) — browsers vary on whether "center" is
// computed against the nested container, the outer window, or both, and
// the error is most visible when the target starts far above/below the
// current scroll position. Fixed by manually finding the real scrollable
// ancestor and computing the exact scroll offset needed to put the
// element's midpoint at that container's midpoint, then also nudging
// the outer window scroll to center it there too.
//
// STALE-POSITION FIX: previously the cursor's on-screen (x, y) was
// computed exactly once, right when travel toward the target began, and
// never touched again until the click actually fired a full TRAVEL_MS
// later. If anything reflowed the page during that ~1.4s window — the
// Event Feed pushing new lines, a player carousel re-rendering after an
// assignment, the sticky score readout updating — the real target moved
// but the cursor's stored (x, y) didn't, so the ghost cursor visibly
// froze at a stale position (sometimes far from the actual button) even
// though el.click() still correctly fired on the real, moved element —
// which is why scoring kept working while the cursor looked broken.
// Fixed by recomputing the element's rect right before the click is
// actually dispatched (after the travel delay), not only at the start
// of it, in click / selectOption / typeText / clickByText alike.
//
// SCROLL-SETTLE FIX: previously `ensureVisible` called
// `scrollIntoView({ behavior: "smooth" })` and then just waited a fixed
// SCROLL_SETTLE_MS before reading the element's position. Smooth-scroll
// duration isn't fixed, though — it varies with scroll distance, and it
// can also get bumped by unrelated layout shifts happening at the same
// moment. Fixed by polling the element's real getBoundingClientRect()
// across consecutive animation frames and only proceeding once it's
// stopped moving, with a generous timeout as a safety net.
//
// CLICK VISIBILITY: every interaction also applies a real, brief flash
// directly to the target DOM element itself (a ring + scale pulse via
// an injected global stylesheet), so the button/input visibly reacts on
// its own, independent of whatever hover/active styles the component
// already defines.
//
// All driver "steps" are serialized through a promise chain so two
// scripted actions never race.

import { useCallback, useRef, useState } from "react";
import type { CursorState } from "@/components/demo/DemoCursor";

const TRAVEL_MS = 1400;
const HOLD_MS = 600;
const VIEWPORT_MARGIN = 40;

// Bounds for the rect-stability poll used by ensureVisible below.
const SETTLE_MAX_WAIT_MS = 1600;
const SETTLE_STABLE_FRAMES_NEEDED = 3;
const SETTLE_EPSILON_PX = 0.5;

// After the first settle pass, if the target is still covered by
// something else at its own center point, retry the scroll+settle this
// many times total before giving up and clicking anyway.
const MAX_ENSURE_VISIBLE_ATTEMPTS = 3;

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

// Real occlusion check: is the topmost element at this target's own
// center point the target itself (or something inside/around it)? If
// something else is on top, geometry alone (isInViewport) isn't enough
// to call this "clickable".
function isTrulyClickable(el: HTMLElement): boolean {
  if (typeof document === "undefined" || !document.elementFromPoint) return true;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const cx = Math.min(Math.max(rect.left + rect.width / 2, 0), vw - 1);
  const cy = Math.min(Math.max(rect.top + rect.height / 2, 0), vh - 1);
  const topEl = document.elementFromPoint(cx, cy);
  if (!topEl) return false;
  return topEl === el || el.contains(topEl) || topEl.contains(el);
}

function rectsClose(a: DOMRect, b: DOMRect): boolean {
  return (
    Math.abs(a.top - b.top) < SETTLE_EPSILON_PX &&
    Math.abs(a.left - b.left) < SETTLE_EPSILON_PX &&
    Math.abs(a.width - b.width) < SETTLE_EPSILON_PX &&
    Math.abs(a.height - b.height) < SETTLE_EPSILON_PX
  );
}

// Resolves once `el`'s getBoundingClientRect() has stopped changing for
// a few consecutive animation frames (or SETTLE_MAX_WAIT_MS elapses,
// whichever comes first).
function waitForStableRect(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    let last = el.getBoundingClientRect();
    let stableFrames = 0;

    function tick() {
      const now = el.getBoundingClientRect();
      if (rectsClose(now, last)) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }
      last = now;

      const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - start;
      if (stableFrames >= SETTLE_STABLE_FRAMES_NEEDED || elapsed >= SETTLE_MAX_WAIT_MS) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// Finds the actual scrollable ancestor for `el` — the page uses nested
// `overflow-auto` containers, so the thing that needs to scroll is very
// often NOT `window`. Returns null if nothing scrollable is found
// before reaching the document root, meaning "just use window scrolling".
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScrollY = (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight + 1;
    if (canScrollY) return node;
    node = node.parentElement;
  }
  return null;
}

// Manually centers `el` inside whichever container actually scrolls it
// — rather than relying on scrollIntoView's block:"center", which
// browsers only honor loosely once the scrollable ancestor is a nested
// div rather than the window. This matters most exactly when the target
// is far above/below the current scroll position.
function centerElement(el: HTMLElement) {
  const scrollParent = findScrollParent(el);
  const vh = window.innerHeight || document.documentElement.clientHeight;

  if (scrollParent) {
    const elRect = el.getBoundingClientRect();
    const containerRect = scrollParent.getBoundingClientRect();
    const elTopWithinContainer = elRect.top - containerRect.top + scrollParent.scrollTop;
    const targetScrollTop = elTopWithinContainer - containerRect.height / 2 + elRect.height / 2;
    scrollParent.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: "smooth",
    });
  }

  const rect = el.getBoundingClientRect();
  const elCenterY = rect.top + rect.height / 2;
  const viewportCenterY = vh / 2;
  const delta = elCenterY - viewportCenterY;
  if (Math.abs(delta) > 4) {
    window.scrollBy({ top: delta, behavior: "smooth" });
  }
}

// Always centers the target as much as the viewport allows, re-checking
// real occlusion after each settle and retrying up to
// MAX_ENSURE_VISIBLE_ATTEMPTS times.
async function ensureVisible(el: HTMLElement): Promise<void> {
  for (let attempt = 0; attempt < MAX_ENSURE_VISIBLE_ATTEMPTS; attempt++) {
    const alreadyGood = attempt === 0 && isInViewport(el) && isTrulyClickable(el);
    if (!alreadyGood) {
      centerElement(el);
    }
    await waitForStableRect(el);
    if (isTrulyClickable(el)) return;
  }
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
              const startPos = positionFor(el);
              setCursor((c) => ({ ...c, visible: true, x: startPos.x, y: startPos.y, label, color, clicking: false }));
              setTimeout(() => {
                if (cancelledRef.current) return resolve(false);
                // Recompute right before clicking — the target may
                // have drifted during the travel delay (event feed
                // growing, a carousel re-rendering, the sticky score
                // readout updating). Without this the cursor renders
                // frozen at its pre-travel position even though
                // el.click() still fires correctly on the real element.
                const finalPos = positionFor(el);
                setCursor((c) => ({ ...c, x: finalPos.x, y: finalPos.y, clicking: true }));
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
              const startPos = positionFor(el);
              setCursor((c) => ({ ...c, visible: true, x: startPos.x, y: startPos.y, label, color, clicking: false }));

              setTimeout(() => {
                if (cancelledRef.current) return resolve(false);
                const finalPos = positionFor(el);
                setCursor((c) => ({ ...c, x: finalPos.x, y: finalPos.y, clicking: true }));
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
              const startPos = positionFor(el);
              setCursor((c) => ({ ...c, visible: true, x: startPos.x, y: startPos.y, label, color, clicking: false }));

              setTimeout(() => {
                if (cancelledRef.current) return resolve(false);
                const finalPos = positionFor(el);
                setCursor((c) => ({ ...c, x: finalPos.x, y: finalPos.y, clicking: true }));
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
              const startPos = positionFor(target);
              setCursor((c) => ({ ...c, visible: true, x: startPos.x, y: startPos.y, label, color, clicking: false }));

              setTimeout(() => {
                if (cancelledRef.current) return resolve(false);
                const finalPos = positionFor(target);
                setCursor((c) => ({ ...c, x: finalPos.x, y: finalPos.y, clicking: true }));
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