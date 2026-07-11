import type { AdminTeam } from "./seeding";
import { makeTeamId } from "./seeding";

/** Raw team data, no ids — ids are assigned fresh each time `getDemoTeams()`
 *  is called so re-running autofill doesn't collide with anything already
 *  in the roster. */
const DEMO_TEAM_DATA: Omit<AdminTeam, "id">[] = [
  { name: "Coastal Sharks", code: "CS", logo: "/coastal-sharks-logo.png" },
  { name: "Desert Falcons", code: "DF", logo: "/desert-falcons-logo.png" },
  { name: "Moon Knights", code: "MK", logo: "/moon-knights-logo.png" },
  { name: "Viper Titans", code: "VT", logo: "/viper-titans-logo.png" },
  { name: "Kandy Kings", code: "KK", logo: "/kandy-kings-logo.png" },
  { name: "Badulla Royals", code: "BR", logo: "/badulla-royals-logo.png" },
  { name: "Jaffna Giants", code: "JG", logo: "/jaffna-giants-logo.png" },
  { name: "Galle Challengers", code: "GC", logo: "/galle-challengers-logo.png" }, // 8
  { name: "Northern Ospreys", code: "NO", logo: "/northern-ospreys-logo.png" },
  { name: "Southern Cobras", code: "SC", logo: "/southern-cobras-logo.png" },
  { name: "Highland Hawks", code: "HH", logo: "/highland-hawks-logo.png" },
  { name: "Island Panthers", code: "IP", logo: "/island-panthers-logo.png" },
  { name: "Royal Lions", code: "RL", logo: "/royal-lions-logo.png" },
  { name: "Golden Eagles", code: "GE", logo: "/golden-eagles-logo.png" },
  { name: "Silver Wolves", code: "SW", logo: "/silver-wolves-logo.png" },
  { name: "Crimson Tigers", code: "CT", logo: "/crimson-tigers-logo.png" }, // 16
  { name: "Emerald Dragons", code: "ED", logo: "/emerald-dragons-logo.png" }, 
  { name: "Obsidian Ravens", code: "OR", logo: "/obsidian-ravens-logo.png" },
  { name: "Storm Chasers", code: "SC2", logo: "/storm-chasers-logo.png" },
  { name: "Thunder Riders", code: "TR", logo: "/thunder-riders-logo.png" },
  { name: "Blaze Strikers", code: "BS", logo: "/blaze-strikers-logo.png" },
  { name: "Frost Giants", code: "FG", logo: "/frost-giants-logo.png" },
  { name: "Ember Phoenix", code: "EP", logo: "/ember-phoenix-logo.png" },
  { name: "Ridge Rhinos", code: "RR2", logo: "/ridge-rhinos-logo.png" },
  { name: "Bay Barracudas", code: "BB", logo: "/bay-barracudas-logo.png" },
  { name: "Cliff Condors", code: "CC", logo: "/cliff-condors-logo.png" },
  { name: "Valley Vultures", code: "VV", logo: "/valley-vultures-logo.png" },
  { name: "Summit Stallions", code: "SS", logo: "/summit-stallions-logo.png" },
  { name: "Harbor Hammers", code: "HB", logo: "/harbor-hammers-logo.png" },
  { name: "Delta Dragons", code: "DD", logo: "/delta-dragons-logo.png" },
  { name: "Plains Panthers", code: "PP", logo: "/plains-panthers-logo.png" },
  { name: "Arena Adders", code: "AA", logo: "/arena-adders-logo.png" },
];

/** Pass a count to grab just the first N (still works for any power-of-2
 *  subset, or any count — byes kick in automatically like everywhere else). */
export function getDemoTeams(count: number = DEMO_TEAM_DATA.length): AdminTeam[] {
  return DEMO_TEAM_DATA.slice(0, count).map((t) => ({ ...t, id: makeTeamId() }));
}