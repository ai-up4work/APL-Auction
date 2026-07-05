// app/overlay/demo/page.tsx
import TournamentBoundaries from "@/components/overlays/TournamentBoundaries";
import TournamentLogoDisplay from "@/components/overlays/TournamentLogoDisplay";
import WeatherCard from "@/components/overlays/WeatherCard";
import LiveScoreBar from "@/components/overlays/LiveScoreBar";
import BoundaryCelebration from "@/components/overlays/BoundaryCelebration";
import ReplayIndicator from "@/components/overlays/ReplayIndicator";

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-black">
      {/* TournamentLogoDisplay docks itself top-left, logo + name shown
          together as one symmetric lockup. */}
      <TournamentLogoDisplay />

      {/* WeatherCard docks itself top-right, top-aligned with the logo
          display on the opposite corner using its default topPx (24px). */}
      <WeatherCard />

      {/* TournamentBoundaries docks itself bottom-right, just above the
          score bar. MatchBoundaries shares the same slot on purpose (see
          its own doc comment) so only one of the two should be mounted
          at a time. */}
      <TournamentBoundaries fours={495} sixes={103} />

      <LiveScoreBar />

      {/* Full-screen FOUR / SIX / OUT / FIFTY / CENTURY celebration.
          Renders nothing until triggered — call
          window.triggerBoundaryCelebration("four"|"six"|"wicket"|"fifty"|"hundred")
          from your scoring logic, or use its own demo buttons for now. */}
      <BoundaryCelebration />

      {/* Persistent top-center "REPLAY" badge, shown for the duration of
          a replay clip. Control with window.showReplayIndicator(ms?) and
          window.hideReplayIndicator(), or use its own demo buttons. */}
      <ReplayIndicator />
    </div>
  );
}