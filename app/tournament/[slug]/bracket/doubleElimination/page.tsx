// Suggested location: app/tournament/bracket/[slug]/doubleElimination/page.tsx
// (mirrors your single-elimination demo page — same pattern, double-elim data + board)
"use client";
import DoubleElimBoard from "@/components/tournament/DoubleElimBoard";
import { getDemoTeams } from "@/lib/tournament/demoTeams";
import {
  generateDoubleElimination,
  recordDoubleElimResult,
  championOfDoubleElim,
  DoubleElimData,
} from "@/lib/tournament/doubleElim";

/* ------------------------------------------------------------------ */
/*  Resolve every playable match with a random score, repeatedly,     */
/*  until the whole bracket — winners, losers, grand final, and a     */
/*  possible bracket reset — is fully complete.                       */
/*                                                                     */
/*  Swap the random score logic for real scores whenever you have     */
/*  them: just call recordDoubleElimResult(data, matchId, winner,     */
/*  scoreA, scoreB) as results come in instead of looping here.        */
/* ------------------------------------------------------------------ */
function resolveDoubleElim(data: DoubleElimData) {
  let changed = true;
  while (changed) {
    changed = false;

    // Re-collect every match each pass: recordDoubleElimResult can both
    // advance winners/losers into later rounds AND spawn a brand-new
    // bracketReset match once the grand final's loser-side team wins —
    // so the playable set can grow mid-resolution.
    const all = [
      ...data.winners.flatMap((r) => r.matches),
      ...data.losers.flatMap((r) => r.matches),
      data.grandFinal,
      ...(data.bracketReset ? [data.bracketReset] : []),
    ];

    for (const match of all) {
      const playable =
        match.teamA &&
        match.teamB &&
        match.teamB.code !== "BYE" &&
        match.status !== "completed";
      if (!playable) continue;

      let scoreA = 60 + Math.floor(Math.random() * 60);
      let scoreB = 60 + Math.floor(Math.random() * 60);
      if (scoreA === scoreB) scoreB += 1; // no ties

      recordDoubleElimResult(data, match.id, scoreA > scoreB ? "A" : "B", scoreA, scoreB);
      changed = true;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Data                                                                */
/* ------------------------------------------------------------------ */

// 1) Reuse your existing demo roster (same 32 teams the admin panel's
//    "Autofill demo teams" button uses) — swap for a real AdminTeam[]
//    whenever you have actual entrants.
const teams = getDemoTeams();

// 2) Build the double-elimination structure (winners bracket, losers
//    bracket, grand final, byes already wired up).
const doubleData = generateDoubleElimination(teams);

// 3) Resolve every match all the way down to a champion.
resolveDoubleElim(doubleData);
const champion = championOfDoubleElim(doubleData);

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function DoubleElimDemo() {
  return (
    <div className="min-h-screen w-full bg-background text-on-surface">
      
      {/* All matches are already resolved above, so onRecordResult is a
          no-op here — MatchResultCard only shows the "Save result" input
          for matches that aren't status "completed" yet. Pass a real
          handler + state instead if you want this page to be editable. */}
      <DoubleElimBoard
        data={doubleData}
        onRecordResult={() => {}}
        title="Championship Bracket"
        eyebrowLabel="Knockout · Double Elimination"
        helperText="Hover or click a team to trace their path."
        logoSrc="/moon-knight-logo.png"
      />
    </div>
  );
}