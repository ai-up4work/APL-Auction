// app/overlay/demo/page.tsx
import TournamentBoundaries from "@/components/overlays/TournamentBoundaries";
import TournamentLogoDisplay from "@/components/overlays/TournamentLogoDisplay";
import WeatherCard from "@/components/overlays/WeatherCard";
import LiveScoreBar from "@/components/overlays/LiveScoreBar";

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-black">
      {/* TournamentLogoDisplay docks itself top-right and flips between
          wordmark and crest on its own timer. */}
      <TournamentLogoDisplay />

      {/* WeatherCard docks itself top-right too, offset below the logo
          display via its own topPx so the two don't collide. */}
      <WeatherCard topPx={116} />

      {/* TournamentBoundaries docks itself bottom-right, just above the
          score bar. MatchBoundaries shares the same slot on purpose (see
          its own doc comment) so only one of the two should be mounted
          at a time — swap this import for MatchBoundaries to compare. */}
      <TournamentBoundaries fours={495} sixes={103} />

      <LiveScoreBar />
    </div>
  );
}