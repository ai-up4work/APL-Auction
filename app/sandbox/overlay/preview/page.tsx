// File: app/sandbox/overlay/preview/page.tsx
//
// Live-preview-only route — no controls, no scoring UI, nothing an
// operator interacts with directly. Exists purely so the admin page's
// on-page monitor can embed this as an <iframe> and get overlay
// components that portal correctly.
//
// Why an iframe/route at all: MatchMomentOverlay and friends portal
// straight to document.body. A CSS-scaled <div> inside the admin page
// can't contain that — the portal escapes it and lands on the real
// admin page body instead of inside the shrunk preview box. An <iframe>
// has its own document/body, so portals inside it stay inside it, and
// the whole iframe element can then be scaled down visually with CSS
// same as any other element. That's the entire reason this route and
// the BroadcastChannel bus below exist — see sandboxBus.ts's header for
// the rest of the reasoning.
//
// This route renders the exact same <BroadcastSurface> the admin page's
// full "Flip to Live" view uses — the overlay components themselves are
// untouched, reused as-is. The only thing this route owns is: listen on
// the bus for whatever state the admin page currently has, mirror it
// into local state, and re-fire moment celebrations on ITS OWN window
// (MatchMomentOverlay's trigger listener is scoped to whichever window
// it's actually mounted in — this iframe's window is a different object
// than the admin page's window, so the admin page calling
// window.triggerBoundaryCelebration on ITS OWN window never reaches
// here; the bus's "moment" message is what bridges that gap).

"use client";

import React, { useEffect, useState } from "react";
import BroadcastSurface from "@/components/demo/BroadcastSurface";
import { connectSandboxBus, type SandboxChannels } from "../lib/sandBoxBus";
import { HARDCODED_MATCH_SETUP, emptyLiveState, defaultWeather } from "../lib/sandboxData";

// Mirrors the admin page's DEFAULT_CHANNELS so the monitor's first paint
// (before the initial "state" message arrives) matches what the admin
// page starts with, instead of flashing every channel off then snapping
// on a beat later.
const DEFAULT_CHANNELS: SandboxChannels = {
  weather: false,
  liveScoreBar: true,
  matchBoundaries: false,
  tournamentBoundaries: false,
  matchIntro: false,
  tournamentLogo: false,
  matchScorecard: false,
};

export default function OverlayPreviewPage() {
  // Static — same hardcoded teams/venue as the admin page, no need to
  // sync this over the bus since it never changes at runtime.
  const matchSetup = HARDCODED_MATCH_SETUP;

  const [liveState, setLiveState] = useState(emptyLiveState);
  const [weatherData, setWeatherData] = useState(defaultWeather);
  const [channels, setChannels] = useState<SandboxChannels>(DEFAULT_CHANNELS);

  useEffect(() => {
    const bus = connectSandboxBus();

    const off = bus.on((msg) => {
      if (msg.type === "state") {
        setLiveState(msg.data.liveState);
        setWeatherData(msg.data.weatherData);
        setChannels(msg.data.channels);
      } else if (msg.type === "moment") {
        (window as any).triggerBoundaryCelebration?.(msg.moment, msg.payload);
      }
    });

    // The admin page may already have state by the time this iframe
    // finishes loading (it almost always will), so ask for a fresh
    // snapshot on mount rather than waiting for the next incidental
    // change — otherwise the monitor could sit on stale defaults
    // indefinitely if the admin page's state happens not to change
    // again for a while.
    bus.send({ type: "requestState" });

    return () => {
      off();
      bus.close();
    };
  }, []);

  return (
    <div className="fixed inset-0" style={{ background: "#000" }}>
      <BroadcastSurface channels={channels} liveState={liveState} weatherData={weatherData} matchSetup={matchSetup} />
    </div>
  );
}