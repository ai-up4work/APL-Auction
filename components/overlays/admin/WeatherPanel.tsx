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

export interface WeatherPanelHandle {
  scheduleFetch: (match: GeocodeMatch, displayName?: string) => void;
}

interface WeatherPanelProps {
  // NEW — needed to key the localStorage entry, same pattern as
  // matchSetup/liveState/engineState/weather in page.tsx.
  auctionId: string;
  defaultVenue: string;
  onFetched: (data: WeatherFetchResult) => void;
  autoFetchKey?: number | string;
}

// NEW — what actually gets persisted: the last successful reading, plus
// the coordinates it came from (needed to resume the 5-min auto-refresh
// loop without re-geocoding).
interface PersistedWeatherPanelState {
  lastResult: WeatherFetchResult | null;
  coords: { latitude: number; longitude: number } | null;
}

// NEW — defensively rebuilds persisted state from whatever's in
// localStorage. A missing/partial/corrupt entry degrades to "nothing
// cached" rather than handing bad data into state.
function sanitizeWeatherPanelCache(raw: any): PersistedWeatherPanelState {
  const lastResult =
    raw?.lastResult &&
    typeof raw.lastResult.venue === "string" &&
    typeof raw.lastResult.temp === "number" &&
    typeof raw.lastResult.condition === "string"
      ? {
          venue: raw.lastResult.venue,
          temp: raw.lastResult.temp,
          unit: "C" as const,
          condition: raw.lastResult.condition,
        }
      : null;
  const coords =
    raw?.coords &&
    typeof raw.coords.latitude === "number" &&
    typeof raw.coords.longitude === "number"
      ? { latitude: raw.coords.latitude, longitude: raw.coords.longitude }
      : null;
  return { lastResult, coords };
}

const WeatherPanel = forwardRef<WeatherPanelHandle, WeatherPanelProps>(
  function WeatherPanel({ auctionId, defaultVenue, onFetched, autoFetchKey }, ref) {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<
      "idle" | "scheduled" | "loading" | "error"
    >("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [lastResult, setLastResult] = useState<WeatherFetchResult | null>(
      null
    );

    const [collapsed, setCollapsed] = useState(false);

    const selectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

    const lastFetchedRef = useRef<{
      latitude: number;
      longitude: number;
    } | null>(null);
    const autoRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const requestIdRef = useRef(0);

    const defaultVenueRef = useRef(defaultVenue);
    useEffect(() => {
      defaultVenueRef.current = defaultVenue;
    }, [defaultVenue]);

    // NEW — same storage-key convention as everywhere else in page.tsx.
    function weatherPanelStorageKey() {
      return `overlay:${auctionId}:weatherPanel`;
    }

    // NEW — writes the latest successful reading + coords to
    // localStorage. Called right after a successful fetch (manual,
    // scheduled-selection, or auto-refresh) so a refresh can pick up
    // exactly where things left off.
    function persistWeatherPanelState(result: WeatherFetchResult, coords: { latitude: number; longitude: number }) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          weatherPanelStorageKey(),
          JSON.stringify({ lastResult: result, coords })
        );
      } catch {
        // non-fatal
      }
    }

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
          persistWeatherPanelState(wx, target); // NEW — keep the cache current across the auto-refresh loop too
        } catch (e) {
          console.log("[WeatherPanel] auto-refresh fetch FAILED:", e);
        } finally {
          scheduleAutoRefresh();
        }
      }, AUTO_REFRESH_MS);
    }

    // NEW — hydrate on mount. This is the actual fix: previously
    // `lastFetchedRef` came back `null` after every refresh, which
    // meant `scheduleAutoRefresh()` was never called again — the
    // 5-minute loop only ever got (re)started from inside
    // runFetchForCoords, so a page reload silently killed live
    // auto-refresh until someone manually re-fetched. Now we restore
    // both the last reading (so the collapsed summary is accurate
    // immediately) and the coords (so the auto-refresh loop resumes).
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => {
      if (typeof window === "undefined") return;
      try {
        const raw = window.localStorage.getItem(weatherPanelStorageKey());
        if (raw) {
          const { lastResult: cachedResult, coords } = sanitizeWeatherPanelCache(JSON.parse(raw));
          if (cachedResult) {
            setLastResult(cachedResult);
            setCollapsed(true);
          }
          if (coords) {
            lastFetchedRef.current = coords;
            scheduleAutoRefresh();
          }
        }
      } catch {
        // ignore malformed cache
      }
      setHydrated(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auctionId]);

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
        if (myId !== requestIdRef.current) return;
        setLastResult(wx);
        onFetched(wx);
        lastFetchedRef.current = { latitude, longitude };
        persistWeatherPanelState(wx, { latitude, longitude }); // NEW
        scheduleAutoRefresh();
        setStatus("idle");
        setCollapsed(true);
      } catch (e) {
        if (myId !== requestIdRef.current) return;
        setStatus("error");
        setErrorMsg((e as Error).message);
        setCollapsed(false);
      }
    }

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

    function handleSelectSuggestion(match: GeocodeMatch) {
      clearScheduledFetch();
      setStatus("scheduled");
      setErrorMsg("");
      selectTimeoutRef.current = setTimeout(() => {
        selectTimeoutRef.current = null;
        runFetchForCoords(match.latitude, match.longitude);
      }, SELECT_FETCH_DELAY_MS);
    }

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