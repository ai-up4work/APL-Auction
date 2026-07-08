"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Section, ActionButton } from "./ui";
import { fetchVenueWeather, fetchWeatherForCoords, geocodeVenue, type GeocodeMatch } from "@/lib/fetchVenueWeather";
import { LocationAutocompleteInput, type LocationAutocompleteInputHandle } from "./LocationAutocomplete";

const SELECT_FETCH_DELAY_MS = 5000;
const AUTO_REFRESH_MS = 5 * 60 * 1000; // NEW — re-check conditions every 5 minutes

interface WeatherFetchResult {
  venue: string;
  temp: number;
  unit: "C";
  condition: string;
}

export interface WeatherPanelHandle {
  scheduleFetch: (match: GeocodeMatch, displayName: string) => void;
}

interface WeatherPanelProps {
  defaultVenue: string;
  onFetched: (data: WeatherFetchResult) => void;
  autoFetchKey?: number;
}

const WeatherPanel = forwardRef<WeatherPanelHandle, WeatherPanelProps>(function WeatherPanel(
  { defaultVenue, onFetched, autoFetchKey },
  ref
) {
  const [query, setQuery] = useState(defaultVenue);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "scheduled" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastResult, setLastResult] = useState<WeatherFetchResult | null>(null);

  const selectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationInputRef = useRef<LocationAutocompleteInputHandle>(null);
  const pendingFetchVenueRef = useRef<string | null>(null);

  // NEW — coordinates of whatever venue was most recently fetched
  // successfully (by any path: manual fetch, dropdown selection, or the
  // auto-refresh cycle itself). The 5-minute refresh reuses these instead
  // of re-geocoding, so it's just a forecast call, not a fresh Photon
  // lookup every cycle.
  const lastFetchedRef = useRef<{ latitude: number; longitude: number; displayName: string } | null>(null);
  const autoRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearScheduledFetch() {
    if (selectTimeoutRef.current) {
      clearTimeout(selectTimeoutRef.current);
      selectTimeoutRef.current = null;
    }
    pendingFetchVenueRef.current = null;
  }

  function clearAutoRefresh() {
    if (autoRefreshTimeoutRef.current) {
      clearTimeout(autoRefreshTimeoutRef.current);
      autoRefreshTimeoutRef.current = null;
    }
  }

  // Restarts the 5-minute countdown. Called after every successful fetch
  // (manual, selected, or a previous auto-refresh cycle completing), so
  // the interval is always measured from "last time we actually updated,"
  // not from when the component first mounted.
  function scheduleAutoRefresh() {
    clearAutoRefresh();
    autoRefreshTimeoutRef.current = setTimeout(async () => {
      autoRefreshTimeoutRef.current = null;
      const target = lastFetchedRef.current;
      if (!target) return; // nothing fetched yet — nothing to refresh
      try {
        const wx = await fetchWeatherForCoords(target.latitude, target.longitude, target.displayName);
        setLastResult(wx);
        onFetched(wx);
      } catch {
        // Silent — a background refresh failing shouldn't interrupt
        // whatever the admin is doing. The next cycle just tries again.
      } finally {
        scheduleAutoRefresh();
      }
    }, AUTO_REFRESH_MS);
  }

  const prevDefaultVenueRef = useRef(defaultVenue);
  useEffect(() => {
    if (defaultVenue !== prevDefaultVenueRef.current) {
      prevDefaultVenueRef.current = defaultVenue;

      if (pendingFetchVenueRef.current === defaultVenue) {
        locationInputRef.current?.skipNextLookup();
      } else {
        clearScheduledFetch();
        locationInputRef.current?.skipNextLookup();
        setStatus("idle");
      }
      setQuery(defaultVenue);
      setTouched(false);
    }
  }, [defaultVenue]);

  useEffect(() => {
    return () => {
      clearScheduledFetch();
      clearAutoRefresh();
    };
  }, []);

  async function runFetch(target: string) {
    setStatus("loading");
    setErrorMsg("");
    try {
      // Geocode + forecast done as two explicit steps (rather than the
      // fetchVenueWeather() convenience wrapper) so we can capture the
      // resolved coordinates for the auto-refresh cycle below.
      const matches = await geocodeVenue(target, 1);
      const match = matches[0];
      if (!match) throw new Error(`Couldn't find a location matching "${target}"`);
      const displayName = match.admin1 ? `${match.name}, ${match.admin1}` : match.name;
      const wx = await fetchWeatherForCoords(match.latitude, match.longitude, displayName);
      setLastResult(wx);
      onFetched(wx);
      lastFetchedRef.current = { latitude: match.latitude, longitude: match.longitude, displayName };
      scheduleAutoRefresh();
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setErrorMsg((e as Error).message);
    }
  }

  async function runFetchForCoords(latitude: number, longitude: number, displayName: string) {
    setStatus("loading");
    setErrorMsg("");
    try {
      const wx = await fetchWeatherForCoords(latitude, longitude, displayName);
      setLastResult(wx);
      onFetched(wx);
      lastFetchedRef.current = { latitude, longitude, displayName };
      scheduleAutoRefresh();
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setErrorMsg((e as Error).message);
    }
  }

  function scheduleCoordsFetch(latitude: number, longitude: number, displayName: string) {
    clearScheduledFetch();
    pendingFetchVenueRef.current = displayName;
    setStatus("scheduled");
    setErrorMsg("");
    selectTimeoutRef.current = setTimeout(() => {
      selectTimeoutRef.current = null;
      pendingFetchVenueRef.current = null;
      runFetchForCoords(latitude, longitude, displayName);
    }, SELECT_FETCH_DELAY_MS);
  }

  useImperativeHandle(ref, () => ({
    scheduleFetch: (match, displayName) => {
      scheduleCoordsFetch(match.latitude, match.longitude, displayName);
    },
  }));

  function handleFetch(venueOverride?: string) {
    const target = (venueOverride ?? query).trim();
    if (!target) return;
    clearScheduledFetch();
    runFetch(target);
  }

  function handleSelectSuggestion(match: GeocodeMatch, displayName: string) {
    scheduleCoordsFetch(match.latitude, match.longitude, displayName);
  }

  useEffect(() => {
    if (autoFetchKey === undefined) return;
    if (touched) return;
    if (!defaultVenue.trim()) return;
    clearScheduledFetch();
    handleFetch(defaultVenue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetchKey]);

  return (
    <Section title="Weather" description="Look up live conditions for the venue and push to the overlay.">
      <div className="flex flex-col gap-2.5">
        <LocationAutocompleteInput
          ref={locationInputRef}
          value={query}
          onChange={(v) => {
            setTouched(true);
            setQuery(v);
          }}
          onSelect={(match, displayName) => handleSelectSuggestion(match, displayName)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleFetch();
            }
          }}
          placeholder="Venue or nearest city..."
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--color-surface-container-low)",
            border: "1px solid var(--color-border-overlay)",
            color: "var(--color-on-surface)",
          }}
        />

        <ActionButton
          full
          label={status === "loading" ? "Fetching..." : "Fetch Weather"}
          onClick={() => handleFetch()}
        />

        {status === "scheduled" && (
          <p className="text-[10px]" style={{ color: "var(--color-outline)" }}>
            Fetching weather for &ldquo;{query}&rdquo; in 5s… (pick again or hit Fetch to change it)
          </p>
        )}

        {touched && query !== defaultVenue && (
          <button
            type="button"
            onClick={() => {
              clearScheduledFetch();
              locationInputRef.current?.skipNextLookup();
              setTouched(false);
              setQuery(defaultVenue);
              setStatus("idle");
            }}
            className="text-[10px] text-left underline"
            style={{ color: "var(--color-outline)" }}
          >
            Resync to match venue ({defaultVenue || "—"})
          </button>
        )}

        {status === "error" && (
          <p className="text-[10px]" style={{ color: "var(--color-error)" }}>
            {errorMsg}
          </p>
        )}
        {lastResult && status !== "error" && status !== "scheduled" && (
          <p className="text-[10px]" style={{ color: "var(--color-outline)" }}>
            Last fetched: {lastResult.venue} — {lastResult.temp}°C, {lastResult.condition}
            {lastFetchedRef.current && " · auto-refreshes every 5 min"}
          </p>
        )}
      </div>
    </Section>
  );
});

export default WeatherPanel;