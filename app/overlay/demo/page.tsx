// app/overlay/demo/page.tsx
import TournamentBoundaries from "@/components/overlays/TournamentBoundaries";
import TournamentLogoDisplay from "@/components/overlays/TournamentLogoDisplay";
import WeatherCard from "@/components/overlays/WeatherCard";
import LiveScoreBar from "@/components/overlays/LiveScoreBar";

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-black">
      {/* TournamentLogoDisplay docks itself top-left, logo + name shown
          together as one symmetric lockup. */}
      <TournamentLogoDisplay />

      {/* WeatherCard docks itself top-right, top-aligned with the logo
          display on the opposite corner using its default topPx (24px) —
          no override needed now that neither block has a label pushing
          its content down. */}
      <WeatherCard />

      {/* TournamentBoundaries docks itself bottom-right, just above the
          score bar. MatchBoundaries shares the same slot on purpose (see
          its own doc comment) so only one of the two should be mounted
          at a time — swap this import for MatchBoundaries to compare. */}
      <TournamentBoundaries fours={495} sixes={103} />

      <LiveScoreBar />
    </div>
  );
}