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
 *  glyphs on a black canvas. `color` is each team's brand hex — consuming
 *  components render the logo with `mix-blend-mode: screen` over a `color`
 *  background so the black canvas becomes the team color and the glyph
 *  stays white, instead of hosting separately recolored image assets. */
export const DEMO_TEAM_DATA: (Omit<AdminTeam, "id"> & { color: string })[] = [
  { name: "Coastal Sharks", code: "CS", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/shark-jaws.svg", color: "#3B8BD4" },
  { name: "Desert Falcons", code: "DF", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/falcon-moon.svg", color: "#2A9D5C" },
  { name: "Moon Knights", code: "MK", logo: "https://raw.githubusercontent.com/game-icons/icons/master/skoll/mounted-knight.svg", color: "#4B4B8F" },
  { name: "Viper Titans", code: "VT", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/snake-tongue.svg", color: "#3E7A3E" },
  { name: "Kandy Kings", code: "KK", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/throne-king.svg", color: "#A3312F" },
  { name: "Badulla Royals", code: "BR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/imperial-crown.svg", color: "#5C48A3" },
  { name: "Jaffna Giants", code: "JG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/giant.svg", color: "#8A6A3E" },
  { name: "Galle Challengers", code: "GC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/trophy-cup.svg", color: "#C99A1F" }, // 8
  { name: "Northern Ospreys", code: "NO", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/eagle-emblem.svg", color: "#2F6A9C" },
  { name: "Southern Cobras", code: "SC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/cobra.svg", color: "#1F7A5C" },
  { name: "Highland Hawks", code: "HH", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/hawk-emblem.svg", color: "#8A5A2B" },
  { name: "Island Panthers", code: "IP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/lynx-head.svg", color: "#2C3E50" },
  { name: "Royal Lions", code: "RL", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/lion.svg", color: "#C9861F" },
  { name: "Golden Eagles", code: "GE", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/eagle-head.svg", color: "#D4AF37" },
  { name: "Silver Wolves", code: "SW", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/wolf-head.svg", color: "#8A8A94" },
  { name: "Crimson Tigers", code: "CT", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/tiger-head.svg", color: "#C9251F" }, // 16
  { name: "Emerald Dragons", code: "ED", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/dragon-head.svg", color: "#1F8A5C" },
  { name: "Obsidian Ravens", code: "OR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/raven.svg", color: "#45454F" },
  { name: "Storm Chasers", code: "SC2", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/lightning-storm.svg", color: "#4141A8" },
  { name: "Thunder Riders", code: "TR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/thunder-struck.svg", color: "#6A3D99" },
  { name: "Blaze Strikers", code: "BS", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/flame-claws.svg", color: "#D9481F" },
  { name: "Frost Giants", code: "FG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/frostfire.svg", color: "#2F8AC9" },
  { name: "Ember Phoenix", code: "EP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/spiky-wing.svg", color: "#D94327" },
  { name: "Ridge Rhinos", code: "RR2", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/rhinoceros-horn.svg", color: "#8A7350" },
  { name: "Bay Barracudas", code: "BB", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/circling-fish.svg", color: "#1F9AC9" },
  { name: "Cliff Condors", code: "CC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/condor-emblem.svg", color: "#6B6B40" },
  { name: "Valley Vultures", code: "VV", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/vulture.svg", color: "#6E5A34" },
  { name: "Summit Stallions", code: "SS", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/horse-head.svg", color: "#8A4A1F" },
  { name: "Harbor Hammers", code: "HB", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/warhammer.svg", color: "#5A5A66" },
  { name: "Delta Dragons", code: "DD", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/spiked-dragon-head.svg", color: "#4A8A2F" },
  { name: "Plains Panthers", code: "PP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/feline.svg", color: "#4A4A4A" },
  { name: "Arena Adders", code: "AA", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/sand-snake.svg", color: "#A3821F" },
];

/** Pass a count to grab just the first N (still works for any power-of-2
 *  subset, or any count — byes kick in automatically like everywhere else). */
export function getDemoTeams(count: number = DEMO_TEAM_DATA.length): AdminTeam[] {
  return DEMO_TEAM_DATA.slice(0, count).map((t) => ({ ...t, id: makeTeamId() }));
}