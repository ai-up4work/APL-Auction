"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Calendar, Building2, Building, Star, Twitter, Globe, MessageSquare } from "lucide-react"
import Link from "next/link"
import { useScrollTop } from "@/hooks/use-scroll-top"
import SectionDivider from "@/components/section-divider"

export default function GameDetailsPage() {
  const params = useParams()
  const slug = params.slug
  const [game, setGame] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Use our custom hook to scroll to top on mount
  useScrollTop()

  useEffect(() => {
    // In a real application, you would fetch this data from an API
    // For now, we'll simulate by finding the game in our static array
    const games = [
      {
        id: 1,
        title: "The Beacon",
        category: "RPG",
        developer: "Beacon Studios",
        publisher: "Web3 Games",
        releaseDate: "2023-09-15",
        image: "/images/games/the-beacon.png",
        description:
          "Venture into dungeons, defeat evils, explore the world with friends, and expand the Beacon's light!",
        longDescription: `The Beacon is an immersive RPG experience set in a world shrouded in darkness. 
          Players take on the role of Lightbringers, tasked with expanding the reach of the Beacon's light to reclaim lands lost to the forces of darkness.
          
          Featuring robust character customization, cooperative multiplayer, and a dynamic world that evolves based on player actions, The Beacon offers an epic adventure that combines classical RPG elements with innovative gameplay mechanics.
          
          Key Features:
          - Deep character progression system with multiple classes and skill trees
          - Procedurally generated dungeons that offer new challenges with each run
          - Player-driven economy with crafting and trading systems
          - Cooperative raids and world events that require teamwork and strategy
          - Beautiful, atmospheric environments with day/night cycles and weather effects`,
        gameplay: `The Beacon's gameplay combines action-oriented combat with strategic elements. Players can choose from multiple class archetypes, each with unique abilities and playstyles.
          
          Combat is skill-based, requiring precise timing for attacks, blocks, and special abilities. The game rewards players for mastering their chosen class and cooperating effectively with teammates.
          
          Exploration is a key component, with vast open areas to discover, hidden treasures to find, and ancient secrets to uncover. As players expand the Beacon's light, new areas become accessible, revealing more of the world's lore and history.
          
          The progression system allows for extensive customization, with talent trees, equipment upgrades, and crafting all contributing to character development. Players can specialize in combat, crafting, exploration, or a balanced approach.`,
        visuals: `The game features a distinctive art style that blends dark fantasy elements with ethereal light effects. The contrast between areas touched by the Beacon's light and those still in darkness creates a visually striking experience.
          
          Character and monster designs are detailed and varied, with unique animations that bring the world to life. Environmental effects such as fog, rain, and the interplay of light and shadow contribute to the immersive atmosphere.
          
          The user interface is clean and intuitive, providing necessary information without cluttering the screen. Dynamic lighting effects enhance the gameplay experience, with the Beacon's light visibly pushing back the darkness as players progress.`,
        slug: "the-beacon",
        rating: 4.8,
        platforms: ["PC", "PlayStation 5", "Xbox Series X/S"],
        genres: ["RPG", "Action", "Adventure"],
        features: ["Multiplayer", "Open World", "Crafting", "PvE", "Trading"],
      },
      {
        id: 2,
        title: "Golden Tides",
        category: "Adventure MOBA",
        developer: "Psychedelic Games",
        publisher: "Psychedelic Games",
        releaseDate: "Coming Soon",
        image: "/images/games/golden-tides.png",
        description: "Golden Tides is a fast-paced PvP Adventure MOBA set in a pirate-themed world",
        longDescription: `Golden Tides is a pirate-themed adventure MOBA where you and three friends fight intense PvP battles — on land and sea — against other teams to hunt for buried treasure. Engage in skill-based combat across dynamic terrains, thrilling ship battles, and experience a unique adventure every time you set sail.

A MOBA With More: The deep, evolving, skill-based gameplay found in the greatest MOBAs, paired with mechanics that actually move the genre forward — like our open world gameplay, ship-to-ship combat, and verticality.

Every Match Is Unique - Really: Rigid metas can walk the plank. Golden Tides' unique match structure, open world gameplay, and multi-team PvPvE dynamic means your crew can win on your terms — and every adventure brings new twists and turns.

Sail the High (Fantasy) Seas: Golden Tides brings together the universal charm of pirates and the imaginative scope of fantasy storytelling to imagine a world filled with drama, adventure and personality (and dragons, and wizards, and magic, and plundering!). We're starting with a game — but we've got big dreams for a big world.

A Dynamic, Living World: Each match takes place in a massive open world with dynamic events, taking the endless replayability of MOBAs to a ludicrous level — plus, with constant updates, special events, and more game modes in the works, there's always something new happening in Golden Tides.

Own Your Treasure - Forever: Players who want the freedom to own and trade the content they unlock have the option to do so — without the sketchy, greedy hijinks some web3 projects have been notorious for.`,
        gameplay: `The Adventure MOBA: Team up with three of yer hearties, choose from a growing cast of pirates with unique playstyles and personalities, and set sail in 20-25 minute matches in search of the ultimate treasure. Raid and ransack a robust range of rapscallions, level up your heroes, and choose your moment to do battle with enemy crews — on land or at sea. Only the cleverest crew will survive to claim the final treasure. The rest…will tell no tales.

Characters: From all across the Archipelago of Golden Tides come our diverse heroes, each with a distinct style - from ferocious Shark Beasts to powerful Sea Monsters there is a play style for everyone.

Tailor your strategy by selecting a hero role that suits you best: Tank, Support, or DPS. Uncover each hero's unique abilities and forge your path to glory on the high seas!

Collectibles: Purchase, sell, and trade all your cosmetics in-game using DOUBLOONS you've collected while playing. All collectibles will have limited supply.

Characters skins, ships, hats, pets, emotes, mounts, and more!`,
        visuals: `Golden Tides features a vibrant, stylized art direction that captures the romanticized vision of pirate adventures while blending fantasy elements. The ocean is rendered with beautiful wave dynamics and reflects changing weather conditions.

Ship models are highly detailed, with visible damage as they take hits in combat and customization options that display on the actual models. Islands feature distinct biomes and architectural styles, from lush tropical paradises to fortified settlements.

The user interface incorporates nautical elements like aged parchment, compasses, and spyglasses, enhancing the immersive pirate theme. Battle animations are fluid and spectacular, with cannon fire, splashing water, and splintering wood creating dynamic combat scenarios.`,
        slug: "golden-tides",
        rating: 4.8,
        platforms: ["PC (Epic Store)", "PC (Steam)"],
        genres: ["Adventure MOBA", "PvP", "PvE", "Action"],
        features: ["Open World", "Ship Combat", "Character Selection", "Collectibles", "Team-based"],
        socialLinks: {
          twitter: "https://twitter.com/GoldenTides_gg",
          website: "https://goldentides.gg/",
          discord: "https://discord.com/invite/goldentides",
        },
        trailerUrl: "https://www.youtube.com/watch?v=QZavqSFk8QU",
      },
      {
        id: 3,
        title: "Nyan Heroes",
        category: "Action",
        developer: "Nyan Games",
        publisher: "Feline Interactive",
        releaseDate: "2023-11-05",
        image: "/images/games/nyan-heroes-banner.png",
        description: "Join the feline revolution in this fast-paced battle royale featuring mechanized cat pilots!",
        longDescription: `Nyan Heroes is an action-packed battle royale game set in a futuristic world where cats pilot advanced mech suits. As one of these feline pilots, players drop into a shrinking battlefield to compete against others for ultimate victory.
          
          The game combines fast-paced combat with strategic elements, as different cat pilots and mech suits offer unique abilities and playstyles. The colorful, cyberpunk-inspired world provides varied terrain and opportunities for both aggressive and tactical gameplay.
          
          Key Features:
          - 40 unique cat pilots, each with distinct personalities and abilities
          - 15 customizable mech suits with different weapons and movement types
          - Dynamic maps with interactive environments and destructible elements
          - Solo and squad-based game modes with up to 60 players per match
          - Progressive battle pass system with cosmetic rewards`,
        gameplay: `Nyan Heroes delivers fast-paced, third-person shooter gameplay with an emphasis on mobility and tactical decision-making. Each match begins with players selecting their cat pilot and mech suit combination before dropping onto the map.
          
          Movement is fluid and dynamic, with options for boosting, gliding, and using environmental features to traverse the terrain. The combat system includes a variety of weapons, from precision rifles to area-of-effect explosives, catering to different playstyles.
          
          What sets Nyan Heroes apart is the synergy between cat pilots and mech suits. Pilots provide passive bonuses and have ultimate abilities that charge throughout the match, while mech suits determine base stats, weapon compatibility, and special moves. This creates hundreds of possible combinations for players to experiment with.
          
          The shrinking safe zone forces players together as matches progress, increasing the tension and requiring adaptability. Supply drops provide opportunities for gear upgrades, while revive stations allow teammates to bring fallen allies back into the fight.`,
        visuals: `Nyan Heroes features a vibrant, cel-shaded visual style that emphasizes its playful yet competitive nature. The neon-lit cyberpunk environments contrast with natural elements, creating a visually distinctive battleground.
          
          Character designs blend cute feline features with serious mech technology, resulting in a unique aesthetic that appeals to various audiences. Animations are smooth and expressive, particularly for the cat pilots' reactions and the mechs' movement patterns.
          
          Special effects for weapons, abilities, and environmental interactions are colorful and clear, providing important visual feedback without obscuring the action. The user interface is streamlined and customizable, allowing players to focus on the fast-paced gameplay.`,
        slug: "nyan-heroes",
        rating: 4.7,
        platforms: ["PC", "PlayStation 5", "Xbox Series X/S"],
        genres: ["Action", "Battle Royale", "Shooter"],
        features: ["Multiplayer", "Character Customization", "Squad-based", "Cosmetic Items"],
      },
      {
        id: 4,
        title: "Variance",
        category: "Card Game",
        developer: "Quantum Studios",
        publisher: "Digital Realms",
        releaseDate: "2023-12-10",
        image: "/images/games/variance.png",
        description: "A strategic card game with unique mechanics and beautiful artwork set in a fantasy universe.",
        longDescription: `Variance is a revolutionary digital card game that introduces a dynamic resource system and positional gameplay. Set in a rich fantasy universe where different factions vie for control, players build decks representing their chosen faction and battle against others in strategic card-based combat.
          
          The game stands out for its innovative "variance" mechanic, where cards can be played in multiple ways depending on the current game state and player strategy. This creates a depth of decision-making rarely seen in the genre.
          
          Key Features:
          - Five distinct factions, each with unique playstyles and mechanics
          - Positional gameplay where card placement matters strategically
          - Dynamic resource system that evolves throughout the match
          - Single-player campaign with branching storylines
          - Competitive ranked ladder with seasonal rewards
          - Regular expansions that introduce new mechanics and card types`,
        gameplay: `Variance's core gameplay revolves around strategic card placement on a 3x3 grid. Cards interact differently based on their position relative to other cards, creating a spatial element that adds depth to the traditional card game formula.
          
          The resource system is tied to faction-specific mechanics, with each faction generating and using resources in unique ways. This creates distinct playstyles, from aggressive rush strategies to complex combo-based approaches or defensive control tactics.
          
          Each card in Variance can be played in multiple ways - as a unit on the board, as a spell effect, or as a resource generator. This "variance" in how cards can be used forces players to make meaningful choices with each draw and creates high replayability.
          
          Matches typically last 10-15 minutes and progress through distinct phases, from early resource building to mid-game board control to late-game finishers. The back-and-forth nature of the gameplay creates dramatic moments and comebacks.`,
        visuals: `Variance features stunning hand-painted artwork that brings its fantasy world to life. Each faction has a distinct visual identity, from the luminous celestial beings of the Astral Conclave to the shadowy entities of the Void Covenant.
          
          Card animations are subtle but effective, with important actions receiving more elaborate visual effects to emphasize their impact on the game state. The battlefield transforms throughout the match, reflecting the ebb and flow of power between the competing factions.
          
          The user interface is elegant and informative, providing all necessary information without overwhelming the player. Card history, resource tracking, and other game state information are easily accessible but don't clutter the main play area.
          
          Sound design complements the visuals, with faction-specific music themes and satisfying audio cues for card plays and effects. Voice acting for key characters adds personality to the single-player campaign.`,
        slug: "variance",
        rating: 4.9,
        platforms: ["PC", "Mobile", "Tablet"],
        genres: ["Card Game", "Strategy", "Fantasy"],
        features: ["Cross-platform", "Deck Building", "Competitive", "Single-player Campaign"],
      },
      {
        id: 6,
        title: "Andrometa",
        category: "Space Sim",
        developer: "Stellar Forge",
        publisher: "Cosmic Entertainment",
        releaseDate: "2024-01-15",
        image: "/images/games/andrometa.png",
        description:
          "Explore the vast reaches of space in this immersive simulation with realistic physics and trading.",
        longDescription: `Andrometa is an ambitious space simulation that puts players in control of their own destiny among the stars. Set in a procedurally generated galaxy with billions of star systems, the game offers unprecedented freedom to explore, trade, fight, or build across a realistic cosmic sandbox.
          
          The game features a 1:1 scale model of a fictional galaxy, with realistic astronomical phenomena and scientifically plausible spacecraft mechanics. Players can choose from multiple career paths or forge their own way through the universe.
          
          Key Features:
          - Seamless travel from space to planetary surfaces with no loading screens
          - Realistic orbital mechanics and space flight simulation
          - Complex economy with dynamic supply and demand across thousands of markets
          - Detailed spacecraft customization with hundreds of components
          - Multiple career paths including trading, exploration, mining, bounty hunting, and more
          - Player-driven factions that can control territory and influence the galactic political landscape`,
        gameplay: `Andrometa's gameplay is built around a realistic space flight model that accounts for Newtonian physics, with ships behaving according to their mass, thrust capabilities, and environmental factors like gravity wells. Players can choose between assisted flight modes for accessibility or full manual control for maximum precision.
          
          The economic simulation is at the heart of the game, with thousands of commodities flowing between star systems based on production, consumption, and player activities. Market prices respond dynamically to supply and demand, creating opportunities for savvy traders to profit from market inefficiencies.
          
          Exploration plays a major role, with players discovering new star systems, anomalies, derelict spacecraft, and signs of ancient civilizations. Detailed scanning tools allow for the analysis of celestial bodies, with valuable data that can be sold to interested parties.
          
          Combat is tactical and skill-based, with ship systems that can be targeted individually and damage that affects performance in realistic ways. Players must manage power distribution, heat levels, and ammunition while maneuvering in three-dimensional space.`,
        visuals: `Andrometa features cutting-edge graphics that bring the majesty of space to life. Planets and moons are rendered with atmospheric effects, dynamic weather systems, and realistic terrain generation. Space itself is filled with nebulae, dust clouds, and stellar phenomena that create breathtaking vistas.
          
          Ship designs range from utilitarian industrial vessels to sleek military craft, with visible components and damage states that reflect their current condition. The cockpit view includes detailed instrument panels and holographic displays that provide critical information without breaking immersion.
          
          Space stations and settlements feature distinct architectural styles based on their faction affiliations and economic roles. From massive orbital shipyards to hidden pirate outposts, each location has a unique visual identity that tells a story about its purpose and inhabitants.
          
          The user interface is designed to resemble in-universe technology, with holographic displays and augmented reality elements that feel like natural extensions of the spacecraft systems. This approach maintains immersion while providing necessary gameplay information.`,
        slug: "andrometa",
        rating: 4.5,
        platforms: ["PC", "PlayStation 5"],
        genres: ["Space Simulation", "Sandbox", "Adventure"],
        features: ["Open World", "Trading", "Ship Customization", "Exploration", "Multiplayer"],
      },
      {
        id: 8,
        title: "Fableborne",
        category: "RPG",
        developer: "Storyweaver Games",
        publisher: "Epic Tales Interactive",
        releaseDate: "2024-02-01",
        image: "/images/games/fableborne.png",
        description: "An epic RPG set in a world of myths and legends where your choices shape the narrative.",
        longDescription: `Fableborne is a narrative-driven RPG that reimagines classic fairy tales and myths in an interconnected world where stories have power. Players take on the role of a Fableborne, individuals who can enter the realm of stories and change their outcomes, affecting both the narrative world and reality.
          
          The game features a branching storyline where player choices have far-reaching consequences, altering not just the main narrative but the very nature of the world and its inhabitants. As players progress, they'll encounter familiar characters and stories twisted in unexpected ways.
          
          Key Features:
          - Branching narrative with hundreds of meaningful choices
          - Dynamic world that physically transforms based on player decisions
          - Character customization with abilities tied to literary archetypes
          - Relationship system with companions who remember and react to your choices
          - Unique "story magic" system where narrative tropes become powerful abilities
          - Multiple endings with new game plus options that carry over consequences`,
        gameplay: `Fableborne's gameplay centers around exploration, dialogue, and combat, all influenced by the choices players make throughout their journey. The action-RPG combat system emphasizes character builds based on literary archetypes like the Hero, the Trickster, or the Sage, each with unique abilities and playstyles.
          
          The "story magic" system allows players to harness narrative tropes as abilities - for example, invoking "the power of friendship" for team buffs, using "dramatic irony" to foresee enemy attacks, or employing "deus ex machina" for a powerful but unpredictable effect that can only be used once per major story arc.
          
          Exploration takes place across diverse regions inspired by different literary traditions, from enchanted forests straight out of European fairy tales to vast deserts housing Arabian Nights adventures. Each area contains hidden secrets, side quests, and characters whose stories can be influenced.
          
          The relationship system tracks how companions and key NPCs feel about the player based on choices, gifts, and dialogue options. These relationships affect not just personal storylines but can open or close entire branches of the main narrative, leading to dramatically different game experiences.`,
        visuals: `Fableborne features a distinctive art style that blends storybook aesthetics with more realistic elements, creating a world that feels both familiar and magical. Characters are expressive and detailed, with designs that evolve based on player choices and story progression.
          
          The world itself is visually dynamic, with regions physically transforming to reflect the outcomes of player decisions. A forest might bloom with magical flowers after a benevolent choice or become twisted and dark following a selfish one, with these changes persisting throughout the game.
          
          Story magic manifests through spectacular visual effects that draw inspiration from the art of storytelling itself - pages of text might swirl around the player character during a powerful spell, or ink blots could form protective barriers during defensive maneuvers.
          
          The user interface resembles an illuminated manuscript, with quest logs appearing as written entries in a magical tome and map markers designed as artistic illustrations. This approach reinforces the literary theme while providing clear gameplay information.`,
        slug: "fableborne",
        rating: 4.8,
        platforms: ["PC", "PlayStation 5", "Xbox Series X/S"],
        genres: ["RPG", "Adventure", "Fantasy"],
        features: ["Choice-driven Narrative", "Character Customization", "Companion System", "Multiple Endings"],
      },
      {
        id: 9,
        title: "Wildcard",
        category: "Card Game",
        developer: "Ace Studios",
        publisher: "Royal Flush Games",
        releaseDate: "2024-05-06",
        image: "/images/games/wildcard.png",
        description: "A dynamic card game where unpredictability and strategy combine for endless possibilities.",
        longDescription: `Wildcard is an innovative digital card game that revolutionizes the genre by introducing dynamic card properties and real-time elements to traditional turn-based card battles. Set in a world where cards represent living entities with evolving abilities, the game offers unprecedented strategic depth.
          
          Unlike conventional card games, Wildcard features cards that can transform, combine, or evolve during matches based on game conditions and player decisions. This creates a constantly shifting battlefield that rewards adaptability and forward thinking.
          
          Key Features:
          - Over 500 unique cards with dynamic, evolving properties
          - Innovative "living deck" system where cards adapt during matches
          - Multiple game modes including campaign, competitive ladder, and draft
          - Guild system with collaborative challenges and shared rewards
          - Regular content updates with new cards and mechanics
          - Blockchain integration for card ownership and trading`,
        gameplay: `Wildcard's core gameplay revolves around strategic deck building and tactical card play. Players construct decks from their collection, balancing card synergies, resource curves, and potential evolution paths.
          
          Matches unfold in a turn-based format with real-time elements. Players have a limited time to make decisions, and certain cards or effects can trigger mid-turn, requiring quick thinking and adaptation. Resource management is crucial, with multiple types of energy that regenerate at different rates.
          
          The game's signature mechanic is the dynamic card property system. Cards can transform based on battlefield conditions, combine with other cards to create new entities, or evolve when certain conditions are met. This creates emergent strategies that develop organically during matches.
          
          The single-player campaign features a narrative-driven experience with specialized challenges and unique cards. Competitive play includes ranked ladders, tournaments, and a draft mode where players build decks from random card selections.
          
          The guild system allows players to form communities, share strategies, and take on collaborative challenges for exclusive rewards. Guild territories can be developed to provide passive benefits to members.`,
        visuals: `Wildcard features stunning, hand-painted card art that brings each entity to life with vibrant colors and dynamic poses. Animation is used effectively to show card transformations and battlefield effects without becoming distracting.
          
          The battlefield is a 3D environment that reacts to the cards played, with environmental effects that correspond to powerful abilities. Weather systems and time of day changes can impact both visuals and gameplay mechanics.
          
          Card evolutions are particularly impressive visually, with seamless transformations that maintain artistic cohesion while clearly communicating the card's new properties. Special effects for legendary cards create memorable moments during crucial plays.
          
          The user interface is elegantly designed to present complex information clearly, with card details, potential evolutions, and battlefield effects all easily accessible through intuitive controls. The hand and deck management systems are particularly polished.`,
        slug: "wildcard",
        rating: 4.7,
        platforms: ["PC", "Mobile", "Tablet"],
        genres: ["Card Game", "Strategy", "Fantasy"],
        features: ["Cross-platform", "Deck Building", "Competitive", "Guild System", "Card Evolution"],
      },
      {
        id: 11,
        title: "Badmad Robots",
        category: "Action",
        developer: "Chaos Mechanics",
        publisher: "Digital Mayhem",
        releaseDate: "2024-03-20",
        image: "/images/games/badmad-robots.png",
        description: "Battle with and against quirky robots in this action-packed game with roguelike elements.",
        longDescription: `Badmad Robots is a frenetic action game set in a world where malfunctioning robots have developed unique personalities and combat capabilities. Players control a "Reclaimer" - a specialist who can hack and temporarily control these robots to navigate through procedurally generated facilities and recover valuable technology.
          
          The game combines fast-paced combat with roguelike progression and strategic robot selection. Each run is unique, with different robot combinations, facility layouts, and challenges to overcome.
          
          Key Features:
          - 50+ unique robots with distinct abilities and personalities
          - Procedurally generated facilities with varying hazards and objectives
          - Meta-progression system that unlocks new robots and upgrades between runs
          - Dynamic difficulty that adapts to player performance
          - Chaotic physics-based combat with environmental interactions
          - Multiplayer co-op mode where players can share and trade controlled robots`,
        gameplay: `Badmad Robots' gameplay centers around the "hack and attack" mechanic, where players temporarily take control of enemy robots by successfully executing timing-based hacking minigames. Once controlled, robots become part of the player's arsenal for a limited time before reverting to hostile behavior.
          
          Combat is fast-paced and chaotic, with physics-based interactions that create unpredictable and often hilarious outcomes. Robots can crash into each other, trigger environmental hazards, or combine abilities in unexpected ways. The environment is highly destructible, with strategic advantages to breaking through walls or collapsing structures onto enemies.
          
          The roguelike structure means that each run through a facility is different, with randomized layouts, enemy placements, and available robots. Players must adapt their strategies based on which robots they encounter and successfully hack early in each run.
          
          Between runs, players can spend recovered resources on permanent upgrades to their Reclaimer's abilities, unlock new robot types that can appear in facilities, and improve their hacking capabilities to control more powerful robots.`,
        visuals: `Badmad Robots features a distinctive visual style that combines industrial sci-fi elements with cartoonish robot designs. Each robot has a unique appearance that reflects its personality and functions, from tiny cleaning bots repurposed as explosive devices to massive industrial loaders converted into walking arsenals.
          
          The game uses a cel-shaded rendering technique with bold outlines and vibrant colors that make the action clear even during the most chaotic moments. Explosions, laser beams, and other effects are exaggerated for visual impact without obscuring gameplay.
          
          Environments show the contrast between the sleek, corporate aesthetic of the facilities' original design and the chaos that has ensued since the robots went haywire. Pristine laboratories might be adjacent to completely trashed storage areas, telling the story of the robot uprising through environmental details.
          
          The user interface emphasizes the technological theme, with elements that appear to be part of the Reclaimer's heads-up display. Robot health, remaining control time, and other critical information is presented clearly without cluttering the screen during intense action sequences.`,
        slug: "badmad-robots",
        rating: 4.6,
        platforms: ["PC", "PlayStation 5", "Xbox Series X/S", "Nintendo Switch"],
        genres: ["Action", "Roguelike", "Shooter"],
        features: ["Procedural Generation", "Physics-based Combat", "Co-op Multiplayer", "Meta-progression"],
      },
      {
        id: 12,
        title: "Xociety",
        category: "Simulation",
        developer: "Virtual Worlds Inc.",
        publisher: "Digital Frontier",
        releaseDate: "2024-04-22",
        image: "/images/games/xociety-banner.png",
        description: "Build and manage your own virtual society in this complex simulation game with economic systems.",
        longDescription: `Xociety is a deep simulation game that puts players in charge of building and managing their own virtual society from the ground up. Starting with a small settlement, players guide their civilization through technological eras, economic challenges, and social developments.
          
          The game stands out for its complex, interconnected systems that simulate everything from resource management to citizen happiness, government policies to environmental impacts. Every decision has consequences that ripple through your society.
          
          Key Features:
          - Expansive city-building with hundreds of unique structures
          - Dynamic citizen simulation with individual needs and behaviors
          - Complex economic systems with supply chains and market fluctuations
          - Multiple government types and policy options
          - Environmental systems that react to player decisions
          - Multiplayer trading and diplomatic relations`,
        gameplay: `Xociety's gameplay revolves around strategic decision-making and resource management. Players must balance immediate needs with long-term planning, weighing the benefits of rapid expansion against sustainability and citizen welfare.
          
          The economic system is particularly advanced, with resources flowing through complex supply chains that players can optimize. Markets respond dynamically to supply and demand, creating economic cycles and opportunities for strategic investments.
          
          Citizens in Xociety are simulated as individuals with unique needs, preferences, and life paths. They react to policies, environmental conditions, and economic opportunities, providing organic feedback on the player's management style.
          
          Technology progression allows societies to evolve from simple settlements to advanced metropolises, with each era presenting new challenges and opportunities. The non-linear tech tree encourages diverse development paths based on player preferences.
          
          In multiplayer mode, players can establish trade routes, form alliances, or compete for resources with neighboring societies. Diplomatic relationships and economic interdependencies add another layer of strategic complexity.`,
        visuals: `Xociety features a clean, stylized visual approach that effectively communicates complex information while maintaining aesthetic appeal. The isometric perspective provides a clear view of city layouts and activities.
          
          Building designs evolve visually as players progress through technological eras, from simple wooden structures to futuristic architectures. The environmental systems are visually represented through changing landscapes, weather patterns, and pollution effects.
          
          The user interface deserves special mention for making complex data accessible through intuitive graphs, heat maps, and information overlays. Players can customize the UI to focus on their management priorities.
          
          Animation brings the city to life, with citizens moving about their daily routines, vehicles traversing streets, and industrial processes visibly operating. Day-night cycles and seasonal changes affect both visuals and gameplay.`,
        slug: "xociety",
        rating: 4.5,
        platforms: ["PC"],
        genres: ["Simulation", "Strategy", "City Builder"],
        features: ["Economy Simulation", "City Building", "Policy Management", "Multiplayer Trading"],
      },
      {
        id: 10,
        title: "Engines of Fury",
        category: "Racing",
        developer: "Fury Studios",
        publisher: "Speed Interactive",
        releaseDate: "2024-02-28",
        image: "/images/games/engines-of-fury.png",
        description: "A high-octane racing game with customizable vehicles and intense multiplayer competitions.",
        longDescription: `Engines of Fury is an adrenaline-pumping racing game set in a dystopian future where highly modified vehicles battle for supremacy on deadly tracks. Combining traditional racing mechanics with combat elements, the game offers a unique experience that rewards both driving skill and tactical thinking.
        
        The game is set in a world where resources are scarce and control of transportation routes means power. Racing leagues have evolved from simple competitions into violent spectacles where drivers fight for survival and glory.
        
        Key Features:
        - 30+ customizable vehicles with unique handling characteristics and upgrade paths
        - 12 distinct tracks set in varied post-apocalyptic environments
        - Robust vehicle modification system with visual and performance customization
        - Multiplayer modes including traditional races, elimination events, and team battles
        - Seasonal championship structure with narrative elements that evolve the game world`,
        gameplay: `Engines of Fury features responsive, physics-based racing that emphasizes skill and timing. Players must master drifting, boosting, and jumping while simultaneously managing offensive and defensive systems on their vehicles.
        
        The combat system allows for strategic decisions during races, with weapons and defenses that can be activated at crucial moments. EMP blasts can temporarily disable opponents, oil slicks can cause chaos on tight corners, and reinforced bumpers can turn your vehicle into a battering ram.
        
        The progression system is built around both driver reputation and vehicle upgrades. As players win races and complete challenges, they unlock new parts, cosmetic options, and race invitations. The garage feature allows deep customization of vehicle appearance and performance characteristics.
        
        Multiplayer is a core component, with ranked matchmaking, custom lobbies, and clan-based team competitions. The spectator mode includes robust camera options and live commentary for major events.`,
        visuals: `Engines of Fury features a gritty visual style that combines realistic vehicle models with stylized environments. The art direction emphasizes contrast between the rusted, makeshift nature of the world and the sleek, well-maintained racing vehicles.
        
        Tracks are highly detailed with environmental storytelling elements that hint at the world's history. Weather effects dramatically impact both visibility and driving conditions, with dynamic time-of-day changes that affect lighting and atmosphere.
        
        The user interface is designed to resemble in-universe technology, with HUD elements that look like they're projected onto the windshield or displayed on damaged screens. Race information is presented clearly without cluttering the screen during intense moments.
        
        Special effects for crashes, boosts, and weapons are spectacular without being distracting, with particle systems and physics interactions that create memorable moments during races.`,
        slug: "engines-of-fury",
        rating: 4.4,
        platforms: ["PC", "PlayStation 5", "Xbox Series X/S"],
        genres: ["Racing", "Action", "Combat Racing"],
        features: ["Vehicle Customization", "Multiplayer", "Combat", "Seasonal Championships"],
      },
      {
        id: 5,
        title: "77 Bit",
        category: "Arcade",
        developer: "Retro Future Games",
        publisher: "Pixel Perfect Publishing",
        releaseDate: "2023-11-15",
        image: "/images/games/77-bit.png",
        description: "A retro-inspired arcade game with modern blockchain integration and pixel-perfect gameplay.",
        longDescription: `77 Bit is a love letter to classic arcade gaming that blends nostalgic pixel art aesthetics with innovative modern gameplay mechanics. Set in a digital world where rogue AI has taken over the arcade machines, players must battle through different game genres to restore order to the virtual realm.
        
        The game features a unique "bit-shifting" mechanic that allows players to transform between different character archetypes on the fly, adapting to challenges that reference beloved gaming classics while creating something entirely new.
        
        Key Features:
        - Multiple game modes that pay homage to different arcade classics
        - Unique bit-shifting mechanic that transforms your character's abilities
        - Procedurally generated levels that ensure fresh challenges
        - Local and online multiplayer modes with competitive and cooperative play
        - Blockchain-based achievements and collectibles that exist beyond the game
        - Retro-futuristic soundtrack with dynamic audio that reacts to gameplay`,
        gameplay: `77 Bit's core gameplay spans multiple arcade genres, with each zone featuring mechanics inspired by classics like shoot 'em ups, beat 'em ups, platformers, and puzzle games. What unifies these varied styles is the innovative bit-shifting system.
        
        Players collect energy during gameplay that fills their "bit meter." When activated, bit-shifting temporarily transforms the player character into different forms with unique abilities - from a high-speed dash form for navigating hazards to a powerful attack form for boss encounters.
        
        The control scheme is deliberately accessible, focusing on perfect timing and strategic decision-making rather than complex button combinations. However, advanced techniques and hidden mechanics provide depth for dedicated players to master.
        
        Progression comes through both skill improvement and unlockable enhancements for each bit form. Players can customize their favorite forms to match their playstyle, emphasizing either offensive power, defensive capabilities, or utility effects.
        
        The game features roguelite elements, with permanent upgrades that can be purchased between runs using collected "bits" - the universal currency that gives the game its name.`,
        visuals: `77 Bit presents a stunning blend of pixel art and modern visual effects. The core aesthetic is built around crisp, colorful sprites with meticulous animation that captures the feel of classic arcade games while adding modern flourishes.

          The game world is divided into distinct zones, each with its own visual theme inspired by different eras of gaming history. From the monochromatic simplicity of early arcade cabinets to the vibrant 16-bit style of the console golden age, each area is a loving homage to gaming's visual evolution.

          Particle effects and lighting add depth to the pixel art, creating a unique visual style that feels both nostalgic and contemporary. When bit-shifting occurs, the transformation is accompanied by spectacular visual effects that blend retro aesthetics with modern rendering techniques.

          The user interface is designed to resemble arcade cabinet overlays, with score displays, life counters, and power meters arranged around the edges of the screen. This approach keeps the play area clear while maintaining the arcade atmosphere.`,
        slug: "77-bit",
        rating: 4.7,
        platforms: ["PC", "PlayStation 5", "Xbox Series X/S", "Nintendo Switch"],
        genres: ["Arcade", "Action", "Retro"],
        features: ["Character Transformation", "Procedural Generation", "Local Multiplayer", "Online Multiplayer"],
      },
      {
        id: 16,
        title: "Seedworld",
        category: "MMO",
        developer: "Seed Interactive",
        publisher: "Digital Gardens",
        releaseDate: "2024-03-15",
        image: "/images/games/seedworld.png",
        description:
          "A vibrant MMO where players build, trade, and explore in a dynamic world shaped by community actions.",
        longDescription: `Seedworld is an expansive MMO that puts players in control of their own destiny in a vast, procedurally generated universe. Starting with nothing but basic tools, players can build settlements, form communities, and shape the world around them.

    The game features a unique "seed" system where player actions permanently affect the world, causing it to grow and evolve in organic ways. Resources must be carefully managed, and cooperation with other players becomes essential for tackling the game's most challenging content.
    
    Key Features:
    - Procedurally generated world that evolves based on player actions
    - Complex building system with thousands of craftable items
    - Player-driven economy with trading posts and marketplaces
    - Guild system for organizing large-scale projects and expeditions
    - Regular world events that require community cooperation
    - Seasonal content updates that introduce new biomes and challenges`,
        gameplay: `Seedworld's gameplay revolves around exploration, resource gathering, crafting, and building. Players start in a safe zone where they learn the basics before venturing out into the wider world, which contains increasingly valuable resources and greater dangers.

    The crafting system is deep and interconnected, with basic materials combining to create tools, which can then be used to gather better materials, creating a satisfying progression loop. Buildings range from simple shelters to elaborate structures with functional components like automated farms, defense systems, and transportation networks.
    
    Combat is present but not the primary focus, with both PvE and optional PvP elements. Players can choose to specialize in different roles such as builder, explorer, trader, or protector, with each path offering unique abilities and equipment.
    
    The social aspects of Seedworld are particularly strong, with robust communication tools, a reputation system, and the ability to form communities with shared ownership of resources and buildings. Large-scale projects often require dozens of players working together, creating a strong sense of camaraderie.`,
        visuals: `Seedworld features a distinctive voxel-based aesthetic that balances simplicity with surprising detail. The art style allows for creative expression while maintaining performance even when hundreds of players gather in the same area.

    The world itself is visually diverse, with biomes ranging from lush forests and mountains to deserts, oceans, and more exotic environments like floating islands and crystal caves. Dynamic lighting and weather systems create atmosphere, with day-night cycles and seasonal changes affecting both visuals and gameplay.
    
    Character customization is extensive, with hundreds of clothing items, accessories, and emotes that allow players to create a unique identity. Buildings can be personalized with different materials, colors, and decorative elements, resulting in settlements that reflect their creators' personalities.
    
    The user interface is clean and customizable, with different layout options for different play styles. Information is presented clearly without cluttering the screen, and important alerts are designed to be noticeable without being intrusive.`,
        slug: "seedworld",
        rating: 4.6,
        platforms: ["PC"],
        genres: ["MMO", "Sandbox", "Survival"],
        features: ["Building", "Crafting", "Player Economy", "Community Projects", "Procedural Generation"],
      },
      // Add more games as needed
    ]

    const foundGame = games.find((g) => g.slug === slug)
    setGame(foundGame || null)
    setLoading(false)
  }, [slug])

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-wardens-gold"></div>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-white">Game Not Found</h1>
          <p className="mb-4 text-gray-300">Sorry, we couldn't find the game you're looking for.</p>
          <Link href="/game-hub" className="text-wardens-gold hover:underline flex items-center justify-center">
            <ArrowLeft className="mr-2" size={16} />
            Back to Game Hub
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="page-transition">
      {/* Website Background - Applied to the entire page */}
      <div className="fixed inset-0 z-[-1]">
        <Image
          src="/images/website-background.png"
          alt="The Wardens Background"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      <section className="pt-28 pb-16 relative">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-wardens-gold/5 to-black/20"></div>
          <div className="absolute inset-0 bg-[url('/images/medieval-pattern.png')] opacity-5"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <Link
            href="/game-hub"
            className="text-wardens-gold hover:text-wardens-gold/80 flex items-center mb-8 transition-colors"
          >
            <ArrowLeft className="mr-2" size={20} />
            <span className="font-medium">Back to Game Hub</span>
          </Link>

          <div className="bg-black/60 border border-wardens-gold/20 rounded-lg overflow-hidden shadow-xl mb-8">
            <div className="relative h-96 w-full">
              <Image src={game.image || "/placeholder.svg"} alt={game.title} fill className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-8">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">{game.title}</h1>
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-wardens-gold text-black text-sm font-bold px-3 py-1 rounded-full">
                    {game.category}
                  </span>
                  <div className="flex items-center text-wardens-gold">
                    <Star className="h-4 w-4 fill-wardens-gold mr-1" />
                    <span className="font-bold">{game.rating}/5</span>
                  </div>
                </div>
                <p className="text-gray-300 text-lg max-w-2xl">{game.description}</p>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-black/40 p-6 rounded-lg border border-wardens-gold/10">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-wardens-gold" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Developer</h3>
                    <p className="text-white">{game.developer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-wardens-gold" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Publisher</h3>
                    <p className="text-white">{game.publisher}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-wardens-gold" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Release Date</h3>
                    <p className="text-white">{game.releaseDate}</p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-wardens-gold"></div>
                  <h2 className="text-2xl font-bold text-white">Overview</h2>
                </div>
                <div className="bg-black/40 p-6 rounded-lg border border-wardens-gold/10">
                  <p className="text-gray-300 whitespace-pre-line">{game.longDescription}</p>
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-wardens-gold"></div>
                  <h2 className="text-2xl font-bold text-white">Gameplay</h2>
                </div>
                <div className="bg-black/40 p-6 rounded-lg border border-wardens-gold/10">
                  <p className="text-gray-300 whitespace-pre-line">{game.gameplay}</p>
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-wardens-gold"></div>
                  <h2 className="text-2xl font-bold text-white">Visuals</h2>
                </div>
                <div className="bg-black/40 p-6 rounded-lg border border-wardens-gold/10">
                  <p className="text-gray-300 whitespace-pre-line">{game.visuals}</p>
                </div>
              </div>

              {/* Game Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Platforms */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-wardens-gold"></div>
                    <h2 className="text-2xl font-bold text-white">Platforms</h2>
                  </div>
                  <div className="bg-black/40 p-6 rounded-lg border border-wardens-gold/10">
                    <div className="flex flex-wrap gap-2">
                      {game.platforms?.map((platform) => (
                        <span
                          key={platform}
                          className="bg-black/60 text-white px-3 py-1 rounded-md border border-wardens-gold/20"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Genres */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-wardens-gold"></div>
                    <h2 className="text-2xl font-bold text-white">Genres</h2>
                  </div>
                  <div className="bg-black/40 p-6 rounded-lg border border-wardens-gold/10">
                    <div className="flex flex-wrap gap-2">
                      {game.genres?.map((genre) => (
                        <span
                          key={genre}
                          className="bg-black/60 text-white px-3 py-1 rounded-md border border-wardens-gold/20"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-wardens-gold"></div>
                  <h2 className="text-2xl font-bold text-white">Key Features</h2>
                </div>
                <div className="bg-black/40 p-6 rounded-lg border border-wardens-gold/10">
                  <div className="flex flex-wrap gap-2">
                    {game.features?.map((feature) => (
                      <span
                        key={feature}
                        className="bg-wardens-gold/10 text-wardens-gold px-3 py-1 rounded-md border border-wardens-gold/30"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {/* Social Links */}
              {game.socialLinks && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-wardens-gold"></div>
                    <h2 className="text-2xl font-bold text-white">Connect</h2>
                  </div>
                  <div className="bg-black/40 p-6 rounded-lg border border-wardens-gold/10">
                    <div className="flex flex-wrap gap-4">
                      {game.socialLinks.twitter && (
                        <a
                          href={game.socialLinks.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-white hover:text-wardens-gold transition-colors"
                        >
                          <Twitter className="h-5 w-5" />
                          <span>Twitter</span>
                        </a>
                      )}
                      {game.socialLinks.website && (
                        <a
                          href={game.socialLinks.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-white hover:text-wardens-gold transition-colors"
                        >
                          <Globe className="h-5 w-5" />
                          <span>Website</span>
                        </a>
                      )}
                      {game.socialLinks.discord && (
                        <a
                          href={game.socialLinks.discord}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-white hover:text-wardens-gold transition-colors"
                        >
                          <MessageSquare className="h-5 w-5" />
                          <span>Discord</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Trailer */}
              {game.trailerUrl && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-wardens-gold"></div>
                    <h2 className="text-2xl font-bold text-white">Trailer</h2>
                  </div>
                  <div className="bg-black/40 p-6 rounded-lg border border-wardens-gold/10">
                    <div className="aspect-video w-full">
                      <iframe
                        src={`https://www.youtube.com/embed/${game.trailerUrl.split("v=")[1]}`}
                        title={`${game.title} Trailer`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full rounded-md"
                      ></iframe>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center mt-12">
            <Link
              href="/game-hub"
              className="inline-flex items-center justify-center bg-wardens-gold hover:bg-wardens-gold/90 text-black font-bold py-3 px-6 rounded-md transition-colors"
            >
              Explore More Games
            </Link>
          </div>
        </div>
      </section>
      <SectionDivider />
    </main>
  )
}
