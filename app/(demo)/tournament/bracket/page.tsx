"use client";
import TournamentBracket from "@/components/tournament/TournamentBracket";
import { generateBracketRounds } from "@/lib/generateBracketRounds";

// 1) Give it just your teams — the number of teams (a power of 2) is all
//    that decides how many rounds/"levels" the bracket has.
//    8 teams -> Quarterfinal, Semifinal, Final (3 levels).
//    16 teams -> Round of 16 too (4 levels). 32 -> 5 levels. etc.
const rounds = generateBracketRounds(
  [
  { name: "Coastal Sharks", code: "CS", logo: "/coastal-sharks-logo.png" }, { name: "Desert Falcons", code: "DF", logo: "/desert-falcons-logo.png" },
  { name: "Moon Knights", code: "MK", logo: "/moon-knights-logo.png" }, { name: "Viper Titans", code: "VT", logo: "/viper-titans-logo.png" },
  { name: "Kandy Kings", code: "KK", logo: "/kandy-kings-logo.png" }, { name: "Badulla Royals", code: "BR", logo: "/badulla-royals-logo.png" },
  { name: "Jaffna Giants", code: "JG", logo: "/jaffna-giants-logo.png" }, { name: "Galle Challengers", code: "GC", logo: "/galle-challengers-logo.png" },
  { name: "Northern Ospreys", code: "NO", logo: "/northern-ospreys-logo.png" }, { name: "Southern Cobras", code: "SC", logo: "/southern-cobras-logo.png" },
  { name: "Highland Hawks", code: "HH", logo: "/highland-hawks-logo.png" }, { name: "Island Panthers", code: "IP", logo: "/island-panthers-logo.png" },
  { name: "Royal Lions", code: "RL", logo: "/royal-lions-logo.png" }, { name: "Golden Eagles", code: "GE", logo: "/golden-eagles-logo.png" },
  { name: "Silver Wolves", code: "SW", logo: "/silver-wolves-logo.png" }, { name: "Crimson Tigers", code: "CT", logo: "/crimson-tigers-logo.png" },
  { name: "Emerald Dragons", code: "ED", logo: "/emerald-dragons-logo.png" }, { name: "Obsidian Ravens", code: "OR", logo: "/obsidian-ravens-logo.png" },
  { name: "Storm Chasers", code: "SC2", logo: "/storm-chasers-logo.png" }, { name: "Thunder Riders", code: "TR", logo: "/thunder-riders-logo.png" },
  { name: "Blaze Strikers", code: "BS", logo: "/blaze-strikers-logo.png" }, { name: "Frost Giants", code: "FG", logo: "/frost-giants-logo.png" },
  { name: "Ember Phoenix", code: "EP", logo: "/ember-phoenix-logo.png" }, { name: "Ridge Rhinos", code: "RR2", logo: "/ridge-rhinos-logo.png" },
  { name: "Bay Barracudas", code: "BB", logo: "/bay-barracudas-logo.png" }, { name: "Cliff Condors", code: "CC", logo: "/cliff-condors-logo.png" },
  { name: "Valley Vultures", code: "VV", logo: "/valley-vultures-logo.png" }, { name: "Summit Stallions", code: "SS", logo: "/summit-stallions-logo.png" },
  { name: "Harbor Hammers", code: "HB", logo: "/harbor-hammers-logo.png" }, { name: "Delta Dragons", code: "DD", logo: "/delta-dragons-logo.png" },
  { name: "Plains Panthers", code: "PP", logo: "/plains-panthers-logo.png" }, { name: "Arena Adders", code: "AA", logo: "/arena-adders-logo.png" },
  ],
);

// 2) Fill in real results as they happen — every field is just data.
rounds[0].matches[0].status = "completed";
if (rounds[0].matches[0].teamA) {
  rounds[0].matches[0].teamA.score = 178;
  rounds[0].matches[0].teamA.isWinner = true;
}
if (rounds[0].matches[0].teamB) {
  rounds[0].matches[0].teamB.score = 140;
}

rounds[0].matches[1].status = "live";
if (rounds[0].matches[1].teamA) rounds[0].matches[1].teamA.score = 64;
if (rounds[0].matches[1].teamB) rounds[0].matches[1].teamB.score = 58;

export default function BracketDemo() {
  return (
    <TournamentBracket
      rounds={rounds}
      title="Championship Bracket"
      eyebrowLabel="Knockout Stage"
      helperText="Hover or click a team to trace their path."
      logoSrc="/moon-knight-logo.png"
    />
  );
}