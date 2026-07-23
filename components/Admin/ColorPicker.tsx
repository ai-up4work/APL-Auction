// components/Admin/ColorPicker.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ColorPickerProps {
  value: string;               // current hex color, e.g. "#F97316"
  onChange: (color: string) => void;
  disabled?: boolean;
  label?: string;
}

// Curated palette that reads well as team/franchise identity colors on a
// dark broadcast UI — vivid, distinguishable from one another, and none of
// them collide with the app's own theme states (success/error/warning).
const PRESET_COLORS = [
  "#F97316", "#EF4444", "#F43F5E", "#EC4899", "#D946EF", "#A855F7",
  "#8B5CF6", "#6366F1", "#3B82F6", "#0EA5E9", "#06B6D4", "#14B8A6",
  "#10B981", "#22C55E", "#84CC16", "#EAB308", "#F59E0B", "#78716C",
  "#64748B", "#1E293B",
];

function isValidHex(v: string) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v);
}

export default function ColorPicker({
  value,
  onChange,
  disabled = false,
  label = "Identity Color",
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(value);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const triggerRef  = useRef<HTMLButtonElement>(null);
  const popoverRef  = useRef<HTMLDivElement>(null);
  const nativeRef   = useRef<HTMLInputElement>(null);

  // Keep the hex text field in sync if the value changes from outside
  // (e.g. a preset was clicked, or the parent form was reset).
  useEffect(() => setHexDraft(value), [value]);

  // Click-outside / Escape to close.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Reposition on scroll/resize while open, since the popover is portaled
  // to <body> with fixed coordinates.
  useEffect(() => {
    if (!open) return;
    function reposition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setCoords({ top: rect.bottom + 8, left: rect.left });
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function toggleOpen() {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 8, left: rect.left });
    setOpen((o) => !o);
  }

  function commitHex(raw: string) {
    let v = raw.trim();
    if (v && !v.startsWith("#")) v = `#${v}`;
    setHexDraft(v);
    if (isValidHex(v)) onChange(v);
  }

  return (
    <div>
      <label
        className="block text-[9px] font-bold uppercase tracking-widest mb-1.5"
        style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}
      >
        {label}
      </label>

      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-colors"
        style={{
          background: "var(--color-surface-container-low)",
          border: `1px solid ${open ? "var(--color-theme-orange)" : "var(--color-border-overlay)"}`,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span
          className="w-6 h-6 rounded-md shrink-0"
          style={{ background: value, boxShadow: `0 0 10px ${value}66`, border: "1px solid rgba(255,255,255,0.12)" }}
        />
        <span
          className="text-xs flex-1 text-left"
          style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-label-mono)" }}
        >
          {value.toUpperCase()}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--color-outline)" }}>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && !disabled && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-64 rounded-2xl p-4 flex flex-col gap-4"
          style={{
            top: coords.top,
            left: coords.left,
            background: "var(--color-surface-container)",
            border: "1px solid var(--color-border-overlay)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div>
            <p
              className="text-[9px] font-bold uppercase tracking-widest mb-2.5"
              style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}
            >
              Presets
            </p>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((c) => {
                const isActive = c.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { onChange(c); setHexDraft(c); }}
                    className="w-full aspect-square rounded-lg transition-transform hover:scale-110"
                    style={{
                      background: c,
                      boxShadow: isActive
                        ? `0 0 0 2px var(--color-surface-container), 0 0 0 4px ${c}`
                        : "none",
                      border: isActive ? "none" : "1px solid rgba(255,255,255,0.1)",
                    }}
                    title={c}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: "var(--color-outline-variant)" }}>
            <div
              className="relative w-9 h-9 rounded-lg shrink-0 overflow-hidden cursor-pointer"
              style={{ background: value, border: "1px solid rgba(255,255,255,0.12)" }}
              title="Custom color wheel"
              onClick={() => nativeRef.current?.click()}
            >
              <input
                ref={nativeRef}
                type="color"
                value={isValidHex(value) ? value : "#F97316"}
                onChange={(e) => { onChange(e.target.value); setHexDraft(e.target.value); }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <input
              type="text"
              value={hexDraft}
              onChange={(e) => commitHex(e.target.value)}
              placeholder="#F97316"
              maxLength={7}
              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none uppercase"
              style={{
                background: "var(--color-surface-container-low)",
                border: `1px solid ${isValidHex(hexDraft) ? "var(--color-border-overlay)" : "var(--color-error)"}`,
                color: "var(--color-on-surface)",
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.05em",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-theme-orange)"; }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = isValidHex(hexDraft)
                  ? "var(--color-border-overlay)"
                  : "var(--color-error)";
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}