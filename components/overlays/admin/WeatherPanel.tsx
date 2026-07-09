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
import { loadWeather, saveWeather } from "@/lib/matchPersistence"; // CHANGED — was localStorage

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
  // CHANGED — matchId (Supabase row id) instead of auctionId. Resolves
  // asynchronously from page.tsx's getOrCreateMatch(); null until then.
  matchId: string | null;
  defaultVenue: string;
  onFetched: (data: WeatherFetchResult) => void;
  autoFetchKey?: number | string;
}

const WeatherPanel = forwardRef<WeatherPanelHandle, WeatherPanelProps>(
  function WeatherPanel({ matchId, defaultVenue, onFetched, autoFetchKey }, ref) {
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

    // NEW — keeps matchId reachable inside scheduleAutoRefresh's closure
    // without needing it in that function's dependency chain (it's a
    // plain function, not an effect, so this mirrors defaultVenueRef's
    // pattern above).
    const matchIdRef = useRef(matchId);
    useEffect(() => {
      matchIdRef.current = matchId;
    }, [matchId]);

    // CHANGED — writes the latest successful reading + coords to
    // Supabase instead of localStorage. Note: this shares the same
    // `weather_readings` row that page.tsx's own persistence effect
    // writes to (with the full WeatherData including `corner`) — we
    // pass a default corner here since this panel has no corner UI;
    // page.tsx's write (triggered moments later via onFetched ->
    // pushFetchedWeather -> setWeatherData) is the actual source of
    // truth for corner. Both writes carry the same venue/temp/condition
    // so there's no meaningful conflict, just a harmless double-write.
    function persistWeatherPanelState(result: WeatherFetchResult, coords: { latitude: number; longitude: number }) {
      const id = matchIdRef.current;
      if (!id) return;
      saveWeather(id, { ...result, corner: "top-right" }, coords);
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
          persistWeatherPanelState(wx, target); // keep the DB cache current across the auto-refresh loop too
        } catch (e) {
          console.log("[WeatherPanel] auto-refresh fetch FAILED:", e);
        } finally {
          scheduleAutoRefresh();
        }
      }, AUTO_REFRESH_MS);
    }

    // CHANGED — hydrate from Supabase instead of localStorage, gated on
    // matchId resolving. This is the actual fix from before, now backed
    // by the DB: without restoring `lastFetchedRef`, the 5-minute
    // auto-refresh loop never restarts after a reload — it only ever
    // gets (re)started from inside runFetchForCoords.
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => {
      if (!matchId) return;
      let cancelled = false;
      (async () => {
        const weather = await loadWeather(matchId);
        if (cancelled) return;
        if (weather?.data) {
          setLastResult({
            venue: weather.data.venue,
            temp: weather.data.temp,
            unit: "C",
            condition: weather.data.condition,
          });
          setCollapsed(true);
        }
        if (weather?.coords) {
          lastFetchedRef.current = weather.coords;
          scheduleAutoRefresh();
        }
        setHydrated(true);
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchId]);

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
        persistWeatherPanelState(wx, { latitude, longitude });
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