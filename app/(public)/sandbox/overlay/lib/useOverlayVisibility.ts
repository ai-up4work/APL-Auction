// File: app/sandbox/overlay/lib/useOverlayVisibility.ts
//
// Same fade-out-before-unmount helper the real overlay display page
// uses. Extracted from page.tsx into its own module so BroadcastSurface
// can use it too (it's needed anywhere an overlay is conditionally shown
// with an exit animation, which is now both the admin page's full "Flip
// to Live" view and the /preview route's iframe content, via
// BroadcastSurface).

"use client";

import { useEffect, useRef, useState } from "react";

export function useOverlayVisibility(show: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      if (timer.current) clearTimeout(timer.current);
      setClosing(false);
      setMounted(true);
    } else if (mounted) {
      setClosing(true);
      timer.current = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, exitMs);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  return { mounted, closing };
}