import type { AdminTeam } from "./seeding";
import { makeTeamId } from "./seeding";

/** Raw team data, no ids — ids are assigned fresh each time `getDemoTeams()`
 *  is called so re-running autofill doesn't collide with anything already
 *  in the roster.
 *
 *  Themed for the Valiant League's ancient-royal-knight identity: every
 *  team is a heraldic house/order rather than a modern sports franchise —
 *  crowns, castles, blades, and the beasts found on old coats of arms
 *  (lions, griffins, dragons, wyverns, unicorns, serpents, stags, wolves)
 *  instead of sharks and falcons. Suffixes are varied on purpose (House,
 *  Order, Guard, Legion, Company, Clan, Covenant, Brigade, Watch, Vanguard,
 *  Regiment, Militia, Pack) so 64 entries still read like distinct rival
 *  houses rather than one template repeated.
 *
 *  Logos point at real, publicly-hosted icon artwork from game-icons.net
 *  (https://game-icons.net), served via GitHub's raw content CDN. Icons are
 *  CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/) — credit each
 *  icon's listed artist folder (delapouite, lorc, skoll, willdabeast) if
 *  this ever ships publicly. Icons render as white glyphs on a black
 *  canvas. `color` is each team's brand hex — consuming components render
 *  the logo with `mix-blend-mode: screen` over a `color` background so the
 *  black canvas becomes the team color and the glyph stays white, instead
 *  of hosting separately recolored image assets.
 *
 *  Every URL below was verified with a live HTTP request (200 OK) against
 *  raw.githubusercontent.com before this file was written — no guessed
 *  filenames, so nothing here should 404. This includes the 32 teams added
 *  in the most recent expansion (Warhide Reavers → Gemcrest House below). */
export const DEMO_TEAM_DATA: (Omit<AdminTeam, "id"> & { color: string })[] = [
  { name: "Valiant Kings", code: "VK", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/throne-king.svg", color: "#8A6A1F" }, // flagship house — gold & royal
  { name: "Ironclad Knights", code: "IK", logo: "https://raw.githubusercontent.com/game-icons/icons/master/skoll/mounted-knight.svg", color: "#4B4B5A" },
  { name: "Crimson Crusaders", code: "CC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/black-knight-helm.svg", color: "#A3312F" },
  { name: "Obsidian Templars", code: "OT", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/templar-shield.svg", color: "#2C2C34" },
  { name: "Golden Regents", code: "GR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/imperial-crown.svg", color: "#D4AF37" },
  { name: "Silver Sentinels", code: "SS", logo: "https://raw.githubusercontent.com/game-icons/icons/master/willdabeast/round-shield.svg", color: "#8A8A94" },
  { name: "Highland Griffins", code: "HG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/griffin-symbol.svg", color: "#2F6A9C" },
  { name: "Ashen Dragons", code: "AD", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/dragon-head.svg", color: "#5A3E8A" }, // 8
  { name: "Ivory Unicorns", code: "IU", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/unicorn.svg", color: "#6E5FA3" },
  { name: "Steel Lancers", code: "SL", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/spear-hook.svg", color: "#4A5A6A" },
  { name: "Royal Lions", code: "RL", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/lion.svg", color: "#C9861F" },
  { name: "Warden Ravens", code: "WR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/raven.svg", color: "#45454F" },
  { name: "Blackrock Legion", code: "BL", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/broadsword.svg", color: "#3A3A3A" },
  { name: "Crowned Falcons", code: "CF", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/falcon-moon.svg", color: "#2A9D5C" },
  { name: "Sable Wolves", code: "SW", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/wolf-head.svg", color: "#3E3E46" },
  { name: "Vanguard Paladins", code: "VP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/knight-banner.svg", color: "#B08A2E" }, // 16
  { name: "Emerald Wardens", code: "EW", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/cross-shield.svg", color: "#1F8A5C" },
  { name: "Twin Blade Order", code: "TB", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/crossed-swords.svg", color: "#7A3E3E" },
  { name: "Stormbound Titans", code: "ST", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/lightning-storm.svg", color: "#4141A8" },
  { name: "Thunder Cavaliers", code: "TC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/horse-head.svg", color: "#6A3D99" },
  { name: "Phoenix Guard", code: "PG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/spiky-wing.svg", color: "#D94327" },
  { name: "Frostcrown Giants", code: "FG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/frostfire.svg", color: "#2F8AC9" },
  { name: "Gilded Griffons", code: "GG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/griffin-shield.svg", color: "#C9971F" },
  { name: "Ironwood Rangers", code: "IR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/bow-arrow.svg", color: "#5C6B3E" },
  { name: "Coastal Corsairs", code: "CO", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/saber-slash.svg", color: "#1F9AC9" },
  { name: "Highgate Sentries", code: "HS", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/castle.svg", color: "#6B6B40" },
  { name: "Nightfall Reapers", code: "NR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/scythe.svg", color: "#3A3247" },
  { name: "Bastion Guardians", code: "BG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/bordered-shield.svg", color: "#8A4A1F" },
  { name: "Dread Wyverns", code: "DW", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/wyvern.svg", color: "#4A8A2F" },
  { name: "Shadow Marauders", code: "SM", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/feline.svg", color: "#4A4A4A" },
  { name: "Sunspire Champions", code: "SC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/trophy-cup.svg", color: "#C9971F" },
  { name: "Ember Berserkers", code: "EB", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/battle-axe.svg", color: "#C9481F" }, // 32
  { name: "Warhide Reavers", code: "WH", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/battered-axe.svg", color: "#6B5A45" },
  { name: "Twin Axe Covenant", code: "TA", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/crossed-axes.svg", color: "#7A5C3E" },
  { name: "Longbow Yeomanry", code: "LY", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/pocket-bow.svg", color: "#4F7A3E" },
  { name: "Cavalier Vanguard", code: "CV", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/horse-head.svg", color: "#3E5A8A" },
  { name: "Ironhorn Clan", code: "IH", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/bull-horns.svg", color: "#8A5A3E" },
  { name: "Doomcrest Reavers", code: "DR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/thunder-skull.svg", color: "#5A3E3E" },
  { name: "Laureate Order", code: "LO", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/laurel-crown.svg", color: "#B08A2E" },
  { name: "Spartan Guard", code: "SG", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/spartan-helmet.svg", color: "#A33A2F" }, // 40
  { name: "Veiled Vanguard", code: "VV", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/visored-helm.svg", color: "#4A4A5A" },
  { name: "Moonhowl Pack", code: "MP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/wolf-howl.svg", color: "#3E4A5A" },
  { name: "Stagcrown Rangers", code: "SR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/stag-head.svg", color: "#6B8A5A" },
  { name: "Battering Rams", code: "BR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/ram.svg", color: "#7A6A4A" },
  { name: "Nightwing Order", code: "NW", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/bat-wing.svg", color: "#2A2A3A" },
  { name: "Viper's Coil", code: "VC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/cobra.svg", color: "#3E6B4A" },
  { name: "Serpent's Crest", code: "SE", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/snake-totem.svg", color: "#4A6B3E" },
  { name: "Hydra's Reach", code: "HY", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/hydra.svg", color: "#5A2F5A" }, // 48
  { name: "Minotaur's Maze", code: "MM", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/minotaur.svg", color: "#6A4A2F" },
  { name: "Ironmace Order", code: "IM", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/flanged-mace.svg", color: "#5A5A6A" },
  { name: "Silent Daggers", code: "SD", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/plain-dagger.svg", color: "#3A3A3A" },
  { name: "Bladehart Company", code: "BH", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/pointy-sword.svg", color: "#8A3E3E" },
  { name: "Hiltguard Company", code: "HC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/sword-hilt.svg", color: "#6A6A3E" },
  { name: "Spikemace Brutes", code: "SP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/spiked-mace.svg", color: "#4A3E5A" },
  { name: "Warforged Regiment", code: "WF", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/battle-gear.svg", color: "#5A5A5A" },
  { name: "Breastplate Brigade", code: "BP", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/breastplate.svg", color: "#7A5A3E" }, // 56
  { name: "Plateguard Watch", code: "PW", logo: "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/chest-armor.svg", color: "#4A5A6A" },
  { name: "Vestguard Militia", code: "VM", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/armor-vest.svg", color: "#6B6B4A" },
  { name: "Echo Shield Watch", code: "ES", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/shield-echoes.svg", color: "#2F6A8A" },
  { name: "Chequered Wardens", code: "CW", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/checked-shield.svg", color: "#8A8A2F" },
  { name: "Crested Champions", code: "CH", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/crested-helmet.svg", color: "#C9971F" },
  { name: "Hornguard Legion", code: "HL", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/horned-helm.svg", color: "#5A3E2F" },
  { name: "Crownwatch Regiment", code: "CR", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/crown.svg", color: "#C9AF37" },
  { name: "Gemcrest House", code: "GC", logo: "https://raw.githubusercontent.com/game-icons/icons/master/lorc/gem-pendant.svg", color: "#2F8A6B" }, // 64
];

/** Pass a count to grab just the first N (still works for any power-of-2
 *  subset, or any count — byes kick in automatically like everywhere else). */
export function getDemoTeams(count: number = DEMO_TEAM_DATA.length): AdminTeam[] {
  return DEMO_TEAM_DATA.slice(0, count).map((t) => ({ ...t, id: makeTeamId() }));
}