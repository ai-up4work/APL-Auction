"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Section, ActionButton } from "./ui";
import {
  fetchWeatherForCoords,
  geocodeVenue,
  type GeocodeMatch,
} from "@/lib/fetchVenueWeather";
import { LocationAutocompleteInput } from "./LocationAutocomplete";
import { Pencil } from "lucide-react";

const SELECT_FETCH_DELAY_MS = 5000;
const AUTO_REFRESH_MS = 5 * 60 * 1000; // re-check conditions every 5 minutes

interface WeatherFetchResult {
  venue: string;
  temp: number;
  unit: "C";
  condition: string;
}

// Imperative handle — lets a parent (Match Setup's venue-select flow) hand
// this panel an already-resolved lat/lng directly, bypassing this panel's
// own search box entirely.
export interface WeatherPanelHandle {
  scheduleFetch: (match: GeocodeMatch, displayName?: string) => void;
}

interface WeatherPanelProps {
  // Display label used on the fetched result and broadcast to the overlay.
  // Read via a ref internally so an edit to the venue name doesn't need to
  // re-trigger a geocode/fetch — the label just updates on the next fetch
  // (manual, scheduled, or auto-refresh).
  defaultVenue: string;
  onFetched: (data: WeatherFetchResult) => void;
  // Bump this (e.g. a push counter) to trigger an automatic geocode+fetch
  // of `defaultVenue` itself, for cases where no explicit coordinate
  // selection has come through the ref yet. Ignored on first mount.
  autoFetchKey?: number | string;
}

const WeatherPanel = forwardRef<WeatherPanelHandle, WeatherPanelProps>(
  function WeatherPanel({ defaultVenue, onFetched, autoFetchKey }, ref) {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<
      "idle" | "scheduled" | "loading" | "error"
    >("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [lastResult, setLastResult] = useState<WeatherFetchResult | null>(
      null
    );

    // Collapsed = showing the compact "last fetched" summary instead of the
    // search box. Starts open (nothing fetched yet); collapses once a fetch
    // resolves successfully; re-expands on error, or whenever a fetch is
    // scheduled/in flight, so the admin can see and cancel it if needed.
    const [collapsed, setCollapsed] = useState(false);

    const selectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

    // Coordinates of whatever venue was most recently fetched successfully.
    // The 5-minute auto-refresh reuses these instead of re-geocoding.
    const lastFetchedRef = useRef<{
      latitude: number;
      longitude: number;
    } | null>(null);
    const autoRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    // Guards against a stale response landing after a newer request started.
    const requestIdRef = useRef(0);

    // Always read the latest venue label without needing it in effect
    // dependency arrays.
    const defaultVenueRef = useRef(defaultVenue);
    useEffect(() => {
      defaultVenueRef.current = defaultVenue;
    }, [defaultVenue]);

    function clearScheduledFetch() {
      if (selectTimeoutRef.current) {
        clearTimeout(selectTimeoutRef.current);
        selectTimeoutRef.current = null;
      }
    }

    function clearAutoRefresh() {
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
        autoRefreshTimeoutRef.current = null;
      }
    }

    // Restarts the 5-minute countdown, measured from "last time we
    // actually updated," not from mount. Runs silently in the background —
    // does not touch `collapsed`, since a successful background refresh
    // shouldn't yank the panel open.
    function scheduleAutoRefresh() {
      clearAutoRefresh();
      console.log("[WeatherPanel] auto-refresh scheduled for", new Date(Date.now() + AUTO_REFRESH_MS).toLocaleTimeString());
      autoRefreshTimeoutRef.current = setTimeout(async () => {
        console.log("[WeatherPanel] auto-refresh timer FIRED at", new Date().toLocaleTimeString());
        autoRefreshTimeoutRef.current = null;
        const target = lastFetchedRef.current;
        if (!target) {
          console.log("[WeatherPanel] no lastFetchedRef, bailing");
          return;
        }
        try {
          const wx = await fetchWeatherForCoords(
            target.latitude,
            target.longitude,
            defaultVenueRef.current
          );
          console.log("[WeatherPanel] auto-refresh fetch SUCCESS:", wx);
          setLastResult(wx);
          onFetched(wx);
        } catch (e) {
          console.log("[WeatherPanel] auto-refresh fetch FAILED:", e);
        } finally {
          scheduleAutoRefresh();
        }
      }, AUTO_REFRESH_MS);
    }

    useEffect(() => {
      return () => {
        clearScheduledFetch();
        clearAutoRefresh();
      };
    }, []);

    async function runFetchForCoords(
      latitude: number,
      longitude: number,
      labelOverride?: string
    ) {
      const myId = ++requestIdRef.current;
      setStatus("loading");
      setErrorMsg("");
      try {
        const wx = await fetchWeatherForCoords(
          latitude,
          longitude,
          labelOverride ?? defaultVenueRef.current
        );
        if (myId !== requestIdRef.current) return; // superseded by a newer request
        setLastResult(wx);
        onFetched(wx);
        lastFetchedRef.current = { latitude, longitude };
        scheduleAutoRefresh();
        setStatus("idle");
        setCollapsed(true); // tuck the search UI away now that we have a result
      } catch (e) {
        if (myId !== requestIdRef.current) return;
        setStatus("error");
        setErrorMsg((e as Error).message);
        setCollapsed(false); // surface the error, don't hide it behind a collapsed card
      }
    }

    // Manual "Fetch Weather" — geocodes whatever's currently typed in the
    // search box, rather than requiring a dropdown selection.
    async function handleFetch() {
      const searchTerm = query.trim();
      if (!searchTerm) return;
      clearScheduledFetch();

      const myId = ++requestIdRef.current;
      setStatus("loading");
      setErrorMsg("");
      try {
        const matches = await geocodeVenue(searchTerm, 1);
        const match = matches[0];
        if (!match)
          throw new Error(`Couldn't find a location matching "${searchTerm}"`);
        if (myId !== requestIdRef.current) return;
        await runFetchForCoords(match.latitude, match.longitude);
      } catch (e) {
        if (myId !== requestIdRef.current) return;
        setStatus("error");
        setErrorMsg((e as Error).message);
        setCollapsed(false);
      }
    }

    // Picking a dropdown suggestion in THIS panel's own search box —
    // schedules the fetch after a short delay so a wrong pick can be
    // corrected without firing a request.
    function handleSelectSuggestion(match: GeocodeMatch) {
      clearScheduledFetch();
      setStatus("scheduled");
      setErrorMsg("");
      selectTimeoutRef.current = setTimeout(() => {
        selectTimeoutRef.current = null;
        runFetchForCoords(match.latitude, match.longitude);
      }, SELECT_FETCH_DELAY_MS);
    }

    // Imperative entry point for a parent that already resolved a
    // coordinate elsewhere (e.g. an autocomplete pick inside Match Setup).
    // Mirrors handleSelectSuggestion's cancellable-delay behavior. Expands
    // the panel even if it was collapsed, so the "fetching in 5s" note (and
    // the chance to cancel/change it) is visible rather than happening
    // silently behind a collapsed card.
    useImperativeHandle(
      ref,
      () => ({
        scheduleFetch(match: GeocodeMatch, displayName?: string) {
          clearScheduledFetch();
          if (displayName) setQuery(displayName);
          setStatus("scheduled");
          setErrorMsg("");
          setCollapsed(false);
          selectTimeoutRef.current = setTimeout(() => {
            selectTimeoutRef.current = null;
            runFetchForCoords(match.latitude, match.longitude, displayName);
          }, SELECT_FETCH_DELAY_MS);
        },
      }),
      []
    );

    // Auto-fetch on autoFetchKey change (e.g. Match Setup pushed). Skips
    // the initial mount so it doesn't fire before there's anything to key
    // off. Geocodes defaultVenue itself as a best-effort fallback when no
    // explicit coordinate selection has come through scheduleFetch.
    const mountedAutoFetchRef = useRef(false);
    useEffect(() => {
      if (!mountedAutoFetchRef.current) {
        mountedAutoFetchRef.current = true;
        return;
      }
      const venue = defaultVenueRef.current.trim();
      if (!venue) return;

      clearScheduledFetch();
      const myId = ++requestIdRef.current;
      setStatus("loading");
      setErrorMsg("");
      (async () => {
        try {
          const matches = await geocodeVenue(venue, 1);
          const match = matches[0];
          if (!match)
            throw new Error(`Couldn't find a location matching "${venue}"`);
          if (myId !== requestIdRef.current) return;
          await runFetchForCoords(match.latitude, match.longitude, venue);
        } catch (e) {
          if (myId !== requestIdRef.current) return;
          setStatus("error");
          setErrorMsg((e as Error).message);
          setCollapsed(false);
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoFetchKey]);

    function handleChangeClick() {
      setCollapsed(false);
    }

    const showCollapsedSummary = collapsed && lastResult && status === "idle";

    return (
      <Section
        title="Weather"
        description="Search the nearest resolvable location — the overlay always shows the Venue name from Match Setup."
      >
        <div className="flex flex-col gap-2.5">
          {showCollapsedSummary ? (
            <div
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
              style={{
                background: "var(--color-surface-container-low)",
                border: "1px solid var(--color-border-overlay)",
              }}
            >
              <div className="flex flex-col min-w-0 gap-0.5">
                <span
                  className="text-[11px] font-bold truncate"
                  style={{ color: "var(--color-on-surface)" }}
                >
                  {lastResult!.venue} — {lastResult!.temp}°C, {lastResult!.condition}
                </span>
                <span
                  className="text-[9px] uppercase tracking-wide"
                  style={{ color: "var(--color-outline)" }}
                >
                  Auto-refreshes every 5 min
                </span>
              </div>
                <button
                type="button"
                onClick={handleChangeClick}
                title="Change location"
                aria-label="Change location"
                className="flex items-center justify-center flex-shrink-0 rounded-md transition-colors"
                style={{
                    width: 28,
                    height: 28,
                    background: "var(--color-surface-container-high)",
                    border: "1px solid var(--color-border-overlay)",
                    color: "var(--color-on-surface-variant)",
                }}
                >
                <Pencil size={13} />
                </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: "var(--color-outline)" }}
                >
                  Search location (for accurate coordinates)
                </label>
                <LocationAutocompleteInput
                  value={query}
                  onChange={setQuery}
                  onSelect={(match) => handleSelectSuggestion(match)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleFetch();
                    }
                  }}
                  placeholder="e.g. Akkaraipattu, or nearest town/city"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--color-surface-container-low)",
                    border: "1px solid var(--color-border-overlay)",
                    color: "var(--color-on-surface)",
                  }}
                />
              </div>


              <ActionButton
                full
                label={status === "loading" ? "Fetching..." : "Fetch Weather"}
                onClick={handleFetch}
              />

              {status === "scheduled" && (
                <p
                  className="text-[10px]"
                  style={{ color: "var(--color-outline)" }}
                >
                  Fetching weather for &ldquo;{query}&rdquo; in 5s… (pick again
                  or hit Fetch to change it)
                </p>
              )}

              {status === "error" && (
                <p
                  className="text-[10px]"
                  style={{ color: "var(--color-error)" }}
                >
                  {errorMsg}
                </p>
              )}

              {lastResult && status !== "error" && status !== "scheduled" && (
                <p
                  className="text-[10px]"
                  style={{ color: "var(--color-outline)" }}
                >
                  Last fetched: {lastResult.venue} — {lastResult.temp}°C,{" "}
                  {lastResult.condition}
                  {lastFetchedRef.current && " · auto-refreshes every 5 min"}
                </p>
              )}
            </>
          )}
        </div>
      </Section>
    );
  }
);

export default WeatherPanel;