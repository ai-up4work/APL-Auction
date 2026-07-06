// components/overlays/admin/ProgramMonitor.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

export default function ProgramMonitor({ overlayUrl }: { overlayUrl: string }) {
  const [copied, setCopied] = useState(false);
  const monitorScreenRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const el = monitorScreenRef.current;
      if (!el) return;
      const scaleX = el.clientWidth / 1920;
      const scaleY = el.clientHeight / 1080;
      setPreviewScale(Math.min(scaleX, scaleY));
    }

    updateScale();

    const ro = new ResizeObserver(updateScale);
    if (monitorScreenRef.current) ro.observe(monitorScreenRef.current);

    window.addEventListener("resize", updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  function copyUrl() {
    navigator.clipboard?.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      {/* ── Source plate ─────────────────────────────────────────────── */}
      <div className="rack-panel p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-1.5">2 · OBS Browser Source</div>
          <code className="font-mono-geist text-xs text-theme-orange break-all">{overlayUrl || "…"}</code>
        </div>
        <div className="flex items-center gap-3">
          <span className="eyebrow">1920×1080 · transparent bg</span>
          <button onClick={copyUrl} className="talk-btn">
            {copied ? "Copied ✓" : "Copy URL"}
          </button>
        </div>
      </div>

      {/* ── Program monitor ──────────────────────────────────────────── */}
      <div className="rack-panel p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Program Monitor</div>
          <span className="eyebrow">scaled preview</span>
        </div>
        <div className="monitor-frame">
          <div className="monitor-screen" ref={monitorScreenRef}>
            <div className="monitor-corner tl" />
            <div className="monitor-corner tr" />
            <div className="monitor-corner bl" />
            <div className="monitor-corner br" />
            {overlayUrl && (
              <iframe
                src={overlayUrl}
                title="Overlay preview"
                style={{
                  width: "1920px",
                  height: "1080px",
                  border: "none",
                  transform: `scale(${previewScale})`,
                  transformOrigin: "center center",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}