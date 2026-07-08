"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { geocodeVenue, type GeocodeMatch } from "@/lib/fetchVenueWeather";

const DEBOUNCE_MS = 350;

interface LocationAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  // fires (in addition to onChange) when the admin picks a suggestion —
  // lets callers skip a second geocode round-trip if they already need
  // coordinates (e.g. WeatherPanel going straight to the forecast call).
  onSelect?: (match: GeocodeMatch, displayName: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

// Exposed to parents that need to set `value` programmatically (e.g.
// syncing to another field's state) without triggering this component's
// own search-as-you-type lookup and dropdown. Call skipNextLookup()
// immediately before the parent changes the `value` prop it passes in.
export interface LocationAutocompleteInputHandle {
  skipNextLookup: () => void;
}

/**
 * Debounced free-text location autocomplete backed by Photon's geocoding
 * endpoint (no key required). Renders its suggestion list via a body
 * portal, positioned with `position: fixed` off the input's own bounding
 * rect — this is the same pattern WeatherCard uses to dock itself to a
 * screen corner. It's necessary here because any ancestor panel using
 * backdrop-filter, transform, or opacity establishes its own stacking
 * context: a plain `position: absolute` + `z-index` dropdown nested inside
 * one glass panel can still end up rendered *underneath* a later sibling
 * panel, regardless of how high the z-index is set, since stacking context
 * comparisons don't cross those boundaries. Portaling to <body> sidesteps
 * the whole problem.
 */
export const LocationAutocompleteInput = forwardRef<LocationAutocompleteInputHandle, LocationAutocompleteInputProps>(
  function LocationAutocompleteInput(
    { value, onChange, onSelect, placeholder, className, style, onKeyDown },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [suggestions, setSuggestions] = useState<GeocodeMatch[]>([]);
    const [show, setShow] = useState(false);
    const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestIdRef = useRef(0);
    // set right before onChange() from a selection, so the resulting value
    // change doesn't immediately re-trigger a lookup on the name we just
    // picked. Also settable from outside via the imperative handle, for
    // when a *parent* assigns `value` programmatically (e.g. syncing from
    // another field) — that's not user typing either, and shouldn't open
    // a dropdown of "suggestions" for a value that was just selected.
    const skipNextLookupRef = useRef(false);

    useImperativeHandle(ref, () => ({
      skipNextLookup: () => {
        skipNextLookupRef.current = true;
      },
    }));

    function updateRect() {
      if (!inputRef.current) return;
      const r = inputRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }

    // keep the dropdown glued to the input if the page scrolls or resizes
    // while it's open (sidebar is scrollable, so this matters here).
    useEffect(() => {
      if (!show) return;
      const onScrollOrResize = () => updateRect();
      window.addEventListener("scroll", onScrollOrResize, true);
      window.addEventListener("resize", onScrollOrResize);
      return () => {
        window.removeEventListener("scroll", onScrollOrResize, true);
        window.removeEventListener("resize", onScrollOrResize);
      };
    }, [show]);

    useEffect(() => {
      if (skipNextLookupRef.current) {
        skipNextLookupRef.current = false;
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const q = value.trim();
      if (q.length < 2) {
        setSuggestions([]);
        setShow(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const myId = ++requestIdRef.current;
        try {
          const matches = await geocodeVenue(q, 5);
          if (myId !== requestIdRef.current) return; // a newer keystroke already superseded this
          setSuggestions(matches);
          if (matches.length > 0) {
            updateRect();
            setShow(true);
          } else {
            setShow(false);
          }
        } catch {
          if (myId !== requestIdRef.current) return;
          setSuggestions([]);
          setShow(false);
        }
      }, DEBOUNCE_MS);

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    function handleSelect(match: GeocodeMatch) {
      const displayName = match.admin1 ? `${match.name}, ${match.admin1}` : match.name;
      skipNextLookupRef.current = true;
      onChange(displayName);
      onSelect?.(match, displayName);
      setShow(false);
    }

    return (
      <>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            updateRect();
            if (suggestions.length > 0) setShow(true);
          }}
          onBlur={() => {
            // delay so a suggestion's onMouseDown fires before the list unmounts
            setTimeout(() => setShow(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShow(false);
            onKeyDown?.(e);
          }}
          placeholder={placeholder}
          className={className}
          style={style}
          autoComplete="off"
          spellCheck={false}
        />

        {show &&
          rect &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              style={{
                position: "fixed",
                top: rect.top,
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
                background: "var(--color-surface-container-low)",
                border: "1px solid var(--color-border-overlay)",
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              }}
            >
              {suggestions.map((m, i) => (
                <button
                  key={`${m.name}-${m.latitude}-${m.longitude}-${i}`}
                  type="button"
                  // onMouseDown, not onClick — fires before the input's onBlur closes the list
                  onMouseDown={() => handleSelect(m)}
                  className="w-full text-left px-3 py-2 text-xs"
                  style={{
                    color: "var(--color-on-surface)",
                    display: "block",
                    background: "transparent",
                    border: "none",
                  }}
                >
                  {m.name}
                  {m.admin1 ? `, ${m.admin1}` : ""}
                  {m.country ? <span style={{ color: "var(--color-outline)" }}> — {m.country}</span> : null}
                </button>
              ))}
            </div>,
            document.body
          )}
      </>
    );
  }
);