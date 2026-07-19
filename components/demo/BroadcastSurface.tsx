// File: app/sandbox/overlay/lib/BroadcastSurface.tsx
//
// The actual broadcast surface — video backdrop plus every real overlay
// component (WeatherCard, LiveScoreBar, MatchMomentOverlay,
// CricketMatchIntro, TournamentLogoDisplay, CricketScorecard,
// MatchBoundaries, TournamentBoundaries), completely untouched, exactly
// as they're meant to be mounted. Pulled out into its own component so
// there's exactly ONE place that mounts them, used by both:
//   - the admin page's full-screen "Flip to Live" view (same document,
//     portals land on the real page body correctly), and
//   - app/sandbox/overlay/preview/page.tsx, the route the tiny monitor
//     <iframe> loads (its own separate document, so portals land inside
//     THAT document's body instead of escaping to the admin page).
//
// Previously the admin page's small preview monitor tried to reuse this
// same JSX inline inside a CSS-scaled <div>, which cannot work: several
// of these components use createPortal(..., document.body), so they
// portal straight past any scaled wrapper to the real page body instead
// of rendering inside it. Giving the monitor its own iframe/document
// (see preview/page.tsx) is what actually fixes that, and this shared
// component is what keeps the overlay-mounting logic itself from being
// duplicated across the two call sites.

"use client";

import React from "react";
import type { MatchSetup, LiveState, WeatherData } from "@/lib/overlayBus";

import WeatherCard from "@/components/overlays/WeatherCard";
import MatchBoundaries from "@/components/overlays/MatchBoundaries";
import TournamentBoundaries from "@/components/overlays/TournamentBoundaries";
import LiveScoreBar from "@/components/overlays/LiveScoreBar";
import CricketMatchIntro from "@/components/overlays/CricketMatchIntro";
import MatchMomentOverlay from "@/components/overlays/MatchMomentOverlay";
import TournamentLogoDisplay from "@/components/overlays/TournamentLogoDisplay";
import CricketScorecard from "@/components/overlays/CricketScorecard";

import { useOverlayVisibility } from "@/app/sandbox/overlay/lib/useOverlayVisibility";
import type { SandboxChannels, SandboxInningsCards } from "@/app/sandbox/overlay/lib/sandBoxBus";

export interface BroadcastSurfaceProps {
  channels: SandboxChannels;
  liveState: LiveState;
  weatherData: WeatherData;
  matchSetup: MatchSetup;
  inningsCards?: SandboxInningsCards;
  showVideoBackdrop?: boolean;
}

export default function BroadcastSurface({
  channels,
  liveState,
  weatherData,
  matchSetup,
  inningsCards,
  showVideoBackdrop = true,
}: BroadcastSurfaceProps) {
  // Each consumer of this component computes its OWN fade timing off of
  // whatever `channels` it currently has — the admin page's live view
  // gets it from local React state, the preview route gets it from
  // whatever the bus last synced in. Either way this hook doesn't care
  // where `channels` came from.
  const weatherVis = useOverlayVisibility(channels.weather, 280);
  const matchBoundariesVis = useOverlayVisibility(channels.matchBoundaries, 300);
  const tournamentBoundariesVis = useOverlayVisibility(channels.tournamentBoundaries, 300);

  return (
    <>
      {showVideoBackdrop && (
        <video
          className="fixed inset-0 w-full h-full object-cover"
          src="/sample-match-footage.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
      )}

      {weatherVis.mounted && <WeatherCard {...weatherData} closing={weatherVis.closing} />}

      {matchBoundariesVis.mounted && (
        <MatchBoundaries
          fours={liveState.matchBoundaries.fours}
          sixes={liveState.matchBoundaries.sixes}
          closing={matchBoundariesVis.closing}
        />
      )}

      {tournamentBoundariesVis.mounted && (
        <TournamentBoundaries
          fours={liveState.tournamentBoundaries.fours}
          sixes={liveState.tournamentBoundaries.sixes}
          closing={tournamentBoundariesVis.closing}
        />
      )}

      <MatchMomentOverlay hideDemoButtons logoSrc={matchSetup.tournamentLogoUrl} />

      <LiveScoreBar show={channels.liveScoreBar} hideTrigger liveState={liveState} matchSetup={matchSetup} />

      <CricketMatchIntro
        show={channels.matchIntro}
        hideTrigger
        matchSetup={matchSetup}
        tournament={matchSetup.tournament}
        matchMeta={matchSetup.matchMeta}
      />

      {channels.tournamentLogo && (
        <TournamentLogoDisplay
          name={matchSetup.tournamentName || undefined}
          edition={[matchSetup.season && `SEASON ${matchSetup.season}`, matchSetup.format].filter(Boolean).join(" · ") || undefined}
          logo={matchSetup.tournamentLogoUrl || undefined}
        />
      )}

      {/* matchId={null} — no real balls ledger in the sandbox, so without
          sandboxInningsCards this would show team names/score with empty
          batting/bowling lists rather than real figures. sandboxInningsCards
          is the accumulated-card data built in page.tsx (see its header
          comment) — CricketScorecard should prefer it over trying to derive
          anything from matchId/liveState directly when it's provided. */}
      <CricketScorecard
        show={channels.matchScorecard}
        hideTrigger
        matchId={null}
        matchSetup={matchSetup}
        liveState={liveState}
        sandboxInningsCards={inningsCards}
      />
    </>
  );
}