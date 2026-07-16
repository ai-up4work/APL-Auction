import type { AdminTeam } from "./seeding";
import { makeTeamId } from "./seeding";

/** Raw team data, no ids — ids are assigned fresh each time `getDemoTeams()`
 *  is called so re-running autofill doesn't collide with anything already
 *  in the roster.
 *
 *  Logos point at real, publicly-hosted icon artwork from game-icons.net
 *  (https://game-icons.net), served via GitHub's raw content CDN. Icons are
 *  CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/) — credit Lorc,
 *  Delapouite, and Skoll if this ever ships publicly. Icons render as white
 *  glyphs on a transparent-ish/black background (no per-team coloring since
 *  they're hotlinked, not composited). */
export const DEMO_TEAM_DATA: Omit<AdminTeam, "id">[] = [
  { name: "Coastal Sharks", code: "CS", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/shark-jaws.svg" },
  { name: "Desert Falcons", code: "DF", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/falcon-moon.svg" },
  { name: "Moon Knights", code: "MK", logo: "https://raw.githubusercontent.com/game-icons/icons/master/skoll/mounted-knight.svg" },
  { name: "Viper Titans", code: "VT", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/snake-tongue.svg" },
  { name: "Kandy Kings", code: "KK", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/throne-king.svg" },
  { name: "Badulla Royals", code: "BR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/imperial-crown.svg" },
  { name: "Jaffna Giants", code: "JG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/giant.svg" },
  { name: "Galle Challengers", code: "GC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/trophy-cup.svg" }, // 8
  { name: "Northern Ospreys", code: "NO", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/eagle-emblem.svg" },
  { name: "Southern Cobras", code: "SC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/cobra.svg" },
  { name: "Highland Hawks", code: "HH", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/hawk-emblem.svg" },
  { name: "Island Panthers", code: "IP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/lynx-head.svg" },
  { name: "Royal Lions", code: "RL", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/lion.svg" },
  { name: "Golden Eagles", code: "GE", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/eagle-head.svg" },
  { name: "Silver Wolves", code: "SW", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/wolf-head.svg" },
  { name: "Crimson Tigers", code: "CT", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/tiger-head.svg" }, // 16
  { name: "Emerald Dragons", code: "ED", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/dragon-head.svg" },
  { name: "Obsidian Ravens", code: "OR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/raven.svg" },
  { name: "Storm Chasers", code: "SC2", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/lightning-storm.svg" },
  { name: "Thunder Riders", code: "TR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/thunder-struck.svg" },
  { name: "Blaze Strikers", code: "BS", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/flame-claws.svg" },
  { name: "Frost Giants", code: "FG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/frostfire.svg" },
  { name: "Ember Phoenix", code: "EP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/spiky-wing.svg" },
  { name: "Ridge Rhinos", code: "RR2", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/rhinoceros-horn.svg" },
  { name: "Bay Barracudas", code: "BB", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/circling-fish.svg" },
  { name: "Cliff Condors", code: "CC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/condor-emblem.svg" },
  { name: "Valley Vultures", code: "VV", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/vulture.svg" },
  { name: "Summit Stallions", code: "SS", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/horse-head.svg" },
  { name: "Harbor Hammers", code: "HB", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/warhammer.svg" },
  { name: "Delta Dragons", code: "DD", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/spiked-dragon-head.svg" },
  { name: "Plains Panthers", code: "PP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/feline.svg" },
  { name: "Arena Adders", code: "AA", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/sand-snake.svg" },
];

/** Pass a count to grab just the first N (still works for any power-of-2
 *  subset, or any count — byes kick in automatically like everywhere else). */
export function getDemoTeams(count: number = DEMO_TEAM_DATA.length): AdminTeam[] {
  return DEMO_TEAM_DATA.slice(0, count).map((t) => ({ ...t, id: makeTeamId() }));
}