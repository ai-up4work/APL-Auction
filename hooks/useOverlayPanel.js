"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useOverlayPanel — shared enter/exit state machine for every overlay card.
 *
 * Every one of LiveScoreBar, CricketScorecard, and CricketMatchIntro used
 * to hand-roll the identical four pieces: `mounted`/`open`/`closing` state,
 * a `closeTimer` ref, `openPanel`/`closePanel`/`toggle` callbacks, and an
 * effect that syncs to an externally-controlled `show` prop. Only the exit
 * duration (and the default `open` state) differed between them. This
 * hook is that logic, written once.
 *
 * @param {boolean|undefined} show
 *   External control, same contract as before: when `undefined`, the panel
 *   manages itself (toggle() is the only way in/out). When a boolean is
 *   passed, every change to it drives open/close directly.
 * @param {number} exitMs
 *   How long the component's own CSS exit animation takes, so unmount is
 *   delayed until the animation has actually finished playing.
 * @param {object} [opts]
 * @param {boolean} [opts.defaultOpen=false]
 *   Initial `open` value when `show` is undefined (LiveScoreBar wants
 *   `true` here since it opens itself on mount; the modal-style overlays
 *   want `false` since they start closed behind a trigger button).
 * @param {boolean} [opts.escapeToClose=false]
 *   Wire up an Escape-key listener that closes the panel while it's open.
 *   Both CricketScorecard and CricketMatchIntro had this inline; folded in
 *   here as an opt-in so components without a dedicated close affordance
 *   (modals) can ask for it and simple bars can skip it.
 */
export function useOverlayPanel(show, exitMs, opts = {}) {
  const { defaultOpen = false, escapeToClose = false } = opts;

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(show ?? defaultOpen);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openPanel = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClosing(false);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setClosing((alreadyClosing) => {
      if (alreadyClosing) return true;
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, exitMs);
      return true;
    });
  }, [exitMs]);

  const toggle = useCallback(() => {
    if (open && !closing) closePanel();
    else if (!open) openPanel();
  }, [open, closing, openPanel, closePanel]);

  // External control — only takes effect once `show` is actually passed.
  useEffect(() => {
    if (show === undefined) return;
    if (show) openPanel();
    else closePanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  useEffect(() => {
    if (!escapeToClose || !open || closing) return;
    const onKey = (e) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escapeToClose, open, closing, closePanel]);

  return { mounted, open, closing, openPanel, closePanel, toggle };
}