// components/overlays/admin/ProgramMonitor.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Section } from "./ui";

export default function ProgramMonitor({ overlayUrl }: { overlayUrl: string }) {
  const [copied, setCopied] = useState(false);
  const monitorScreenRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
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
    <Section title="Program Monitor" description="OBS browser source · 1920×1080 · transparent background">
      <div className="flex flex-col gap-3">
        <div
          className="relative rounded-lg overflow-hidden"
          style={{ background: "#000", aspectRatio: "16 / 9", border: "1px solid var(--color-border-overlay)" }}
        >
          <div ref={monitorScreenRef} className="w-full h-full flex items-center justify-center">
            {overlayUrl ? (
              <iframe
                src={overlayUrl}
                title="Overlay preview"
                style={{
                  width: "1920px",
                  height: "1080px",
                  border: "none",
                  transform: isMounted ? `scale(${previewScale})` : "scale(1)",
                  transformOrigin: "center center",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2" style={{ color: "var(--color-outline)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
                  desktop_windows
                </span>
                <span className="text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)" }}>
                  No preview yet
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)" }}
        >
          <code
            className="text-[10px] truncate"
            style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}
            title={overlayUrl}
          >
            {overlayUrl || "…"}
          </code>
          <button
            onClick={copyUrl}
            className="flex-shrink-0 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors"
            style={{
              fontFamily: "var(--font-label-mono)",
              background: "rgba(201,151,31,0.1)",
              border: "1px solid rgba(201,151,31,0.3)",
              color: copied ? "var(--color-success)" : "var(--color-theme-orange)",
            }}
          >
            {copied ? "Copied ✓" : "Copy URL"}
          </button>
        </div>
      </div>
    </Section>
  );
}