"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Play, Camera, Calendar, Building2, Building } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useScrollTop } from "@/hooks/use-scroll-top"
import SectionDivider from "@/components/section-divider"
import RelatedGames from "@/components/related-games"

const reviewData = {
  "off-the-grid": {
    title: "Off the Grid",
    heroImage: "/images/games/off-the-grid-banner.png",
    logo: "/images/games/off-the-grid-logo.png",
    score: "9/10",
    author: "The Wardens",
    date: "2025-08-01",
    hasShieldOfApproval: true,
    developer: "Gunzilla Games",
    publisher: "Gunzilla Games",
    platforms: ["PC", "PlayStation 5", "Xbox Series X/S"],
    genre: "Battle Royale, Shooter",
    releaseDate: "2024",
    status: "Released",
    categories: ["Shooter", "Battle Royale", "Cyberpunk"],
    sections: {
      overview: {
        title: "Overview",
        content:
          'Off The Grid (OTG) is a new free-to-play battle royale and extraction shooter developed by Gunzilla Games. It\'s set in a dystopian cyberpunk future on "Teardrop Island," where players are cybernetically augmented and thrown into a televised deathmatch. The game aims to blend intense PvPvE combat with a strong emphasis on narrative progression, allowing players to impact the story through their choices.',
      },
      gameModes: {
        title: "Game Modes",
        content: `EXTRACTION ROYALE
Twenty squads of three battle in a pre-selected section of Teardrop Island. This fast-paced, highly dynamic game mode allows continuous respawns until the last team member is eliminated. Extract hexes to obtain high-tier loot, complete a variety of side missions to earn resources for requesting your perfect loadout, and fight to become the last team standing!Battle solo in a designated section of Teardrop Island. Extract HEXes for high-tier loot, complete side missions to earn cash, call in your ideal loadout, and fight to be the last Zero standing!

- 60 PLAYERS 
- LOADOUTS 
- HEX EXTRACTION 
- SIDE MISSIONS
- SHRINKING ZONE

DEATHMATCH
Twenty Zeroes. One killfeed. Infinite ways to die. No loot. No downtime. No friends. Just a killbox, your loadout, and spectators thirsting for blood. You regen on loop – until the timer runs out, or your brain does. There's no winning. Just outkilling. Earn HEXes. Stack GUNz. Be the last name in the feed when the match cuts to black.

LOADOUT LADDER
Think Gun Game from Call of Duty. Zeroes drop into a small section of Teardrop Island with 25 loadouts to work through. Each time you get a kill, you progress one loadout on the ladder. No loot. No friends. Just the first to finish the ladder!

PRACTICE
Engage in a single-player experience designed to sharpen your skills and prepare you for the thrilling action that awaits on Teardrop.`,
      },
      gameplay: {
        title: "Gameplay",
        content: `At its core, this is a fast-paced battle royale shooter. You can jump into intense 3-person team matches for squad play or test your solo skills in a pure deathmatch. Expect the familiar loop of scavenging for gear and staying ahead of the shrinking safe zone, keeping the action tight.

Web3 integration is central to "Off The Grid." Your weapons, skins, attachments, cybernetic limbs, and even character appearances are all NFTs. This means you truly own them and can buy, sell, or trade them on the in-game marketplace using Gunz tokens. You'll earn Gunz just by playing, or you can purchase and transfer them directly to your in-game wallet.

The learning curve is perfect if you're a battle royale veteran; you'll feel right at home. Newcomers might find it a bit tough initially, but it's surprisingly easy to get the hang of after just a few matches.

What really makes "Off The Grid" stand out are its innovative mechanics. You can fly with a jetpack, which totally changes how you navigate and fight. Plus, the dynamic system of losing limbs during combat adds an unpredictable and intense layer to every single gunfight.

Key Features:
- Next-Gen Cyberpunk F2P Extraction Royale
- 150-player intense battle royale
- 60-player intense extraction royal
- Unique cyberlimb system with 30+ options
- Dynamic Teardrop Island environment
- Almost everything is a nft`,
        hasMedia: true,
        mediaType: "gameplay",
      },
      graphics: {
        title: "Graphics",
        content: `Looks amazing thanks to Unreal Engine 5. Cities are detailed, lighting is dynamic, and environments feel very cinematic. Great design with a cool cyberpunk vibe.

But… performance is rough. Even powerful PCs can struggle with low frame rates and stuttering. Some visuals look grainy indoors, and optimization needs work. Recent patches help a bit, but still not smooth for everyone.

Bottom line: Stunning graphics, but not well-optimized yet.`,
        hasMedia: true,
        mediaType: "visual",
      },
      audio: {
        title: "Audio",
        content: `Music and voice lines fit the atmosphere well, but sound effects like footsteps and gunshots have issues. It's hard to tell where sounds come from in combat. Some audio bugs like crackling or freezing.

Bottom line: Cool vibe, but sound design needs fixes.`,
      },
      community: {
        title: "Community",
        content: `"Off The Grid" ensures consistent action even without detailed daily player counts by cleverly using bots when needed, guaranteeing a smooth, enjoyable, and competitive match every time.

Beyond the gameplay, the game thrives on its strong community. While not always formally called "guilds," player-driven social groups are everywhere, especially on Discord. The Extraction Royale mode emphasizes teamwork, making collaboration and forming lasting bonds essential. The developers even promote fair play through their "Zero's Code" and ease new players in with supportive starts, making "Off The Grid" a truly social shooter where teaming up is key to victory and fun!`,
      },
      wardensScore: {
        title: "Final Verdict",
        content: {
          pros: [
            "Good basic loadouts",
            "Plenty of missions for earning in-game currency",
            "Multi-controller support",
            "Available on multiple platforms: PC, PS5 & Xbox Series X|S",
            "Earn Gunz tokens through gameplay",
            "Active marketplace utilizing Gunz tokens",
            "Fast-paced action that keeps you on the edge of your seat",
            "Top cinematics",
          ],
          cons: [
            "Third-person camera is too close, the character blocks 2/3 of the view, making it hard to spot/track enemies, especially moving/flying ones",
            "Requires a high-performance PC (minimum RTX 3060)",
            "Constantly asks for experience feedback after each game",
            "Possible presence of hackers",
          ],
          score: "9/10",
        },
      },
    },
  },
  wildcard: {
    title: "Wildcard",
    heroImage: "/images/games/wildcard.png",
    logo: "/images/games/wildcard-logo.png",
    score: "8.5/10",
    author: "The Wardens",
    date: "2025-08-01",
    hasShieldOfApproval: true,
    developer: "Playful Studios",
    publisher: "Playful Studios",
    platforms: ["PC", "Mobile", "Tablet"],
    genre: "CCAG, Action, Card Game",
    releaseDate: "2024",
    status: "Released",
    categories: ["CCAG", "Action", "Card Game"],
    sections: {
      overview: {
        title: "Overview",
        content:
          "Wildcard is a unique 2v2 Collectible Card Action Game (CCAG) that blends elements of third-person arena combat with strategic deck-building. It aims to create a dynamic and competitive experience that's as engaging to watch as it is to play.",
      },
      gameModes: {
        title: "Game Modes",
        content: `Competitive 2v2 Mode
Players pick a champion and build a deck of creatures and abilities. Battles happen in arenas where you strategically summon creatures and use abilities to outplay your opponent, blending fast-paced combat with strategic deck-building. It's designed to be easy to learn but hard to master.`,
      },
      gameplay: {
        title: "Gameplay",
        content: `At its heart, Wildcard revolves around player-versus-player (PvP) battles within dynamic arenas. You kick things off by choosing a unique Champion, who acts as your in-game avatar. Each Champion boasts distinct abilities and a specific playstyle, making your choice crucial for aligning with your preferred strategy. Complementing your Champion, you'll craft a personalized deck of "Wildcards." These aren't just any cards; they represent various creature summons and powerful active abilities. The true magic happens when your deck's design perfectly synergizes with your chosen Champion, unlocking potent combos and tactical masterstrokes.

Once you're in the arena, you'll control your Champion from a third-person perspective. Battles are fluid and rapid, demanding quick reflexes and astute tactical positioning. This is where the MOBA influence truly shines, as you'll be actively maneuvering and engaging opponents in real-time. The CCG element comes alive as you strategically draw and deploy your Wildcards. You can summon creatures to fight alongside you, pushing lanes, fortifying key areas, or directly assaulting the enemy Champion. Simultaneously, you'll unleash potent abilities from your deck to gain a crucial advantage, disrupt your opponents, or amplify your summoned forces.

The ultimate goal is to outmaneuver and decisively defeat your rival Champion. This involves a constant ebb and flow of action, requiring you to meticulously manage your resources (your cards), anticipate your opponent's next move, and make split-second decisions on when to launch an attack, defend your position, or seize an objective. Wildcard aims to be easily accessible for newcomers while simultaneously offering a high skill ceiling for those eager to master its intricacies and compete at the highest level. With future updates planned, including a 2v2 mode, Wildcard is set to deliver a continuously evolving and thrilling competitive experience.

Key Features:
- Collectible Card Action Game (CCAG): Fuses strategic card game depth with real-time MOBA-style combat.
- Champion-Based Combat: Players control unique Champions with distinct abilities in arena battles.
- Strategic Deck Building: Players craft custom decks of creature summons and abilities to enhance their Champion's play.
- Dynamic PvP Arenas: Experience fast-paced, third-person combat where you strategically deploy cards to outmaneuver rivals.
- "Easy to Learn, Difficult to Master": Designed for quick pickup, but offers deep strategic possibilities for competitive mastery.
- 2v2 Multiplayer Focus: The primary competitive experience is built around team-based 2v2 matches.
- Interactive Spectator Elements: Features a meta-game where an audience can influence matches and engage with the competitive ecosystem.`,
        hasMedia: true,
        mediaType: "gameplay",
      },
      graphics: {
        title: "Graphics",
        content: `- Vibrant Art Style: Employs a lively and expressive aesthetic for Champions and creatures.
- Detailed Models & Animations: Features highly detailed character models with dynamic, impactful animations.
- Gameplay Clarity: Prioritizes clear visuals for abilities and summons, crucial for fast-paced combat.
- Dynamic Environments: Arenas are designed with rich backdrops that enhance the action without distraction.`,
        hasMedia: true,
        mediaType: "visual",
      },
      audio: {
        title: "Audio",
        content: `- Immersive Soundscape: Creates a rich, detailed audio environment for vibrant arenas.
- Distinct SFX: Provides clear, impactful sound effects for Champion abilities and creature summons.
- Dynamic Music: Adapts to battle intensity, heightening dramatic moments.
- Competitive Clarity: Ensures audio cues are precise, aiding strategic play without overwhelming.`,
      },
      community: {
        title: "Community",
        content: `The Wildcard game is fostering a vibrant and highly engaged community, built on a "community-first" approach. Even before its full release, the developers are actively involving players in the game's evolution, seeking feedback through extensive Alpha testing and regular public playtests. This collaborative spirit is evident in their strong Discord presence, which boasts a massive membership and serves as a central hub for discussion and direct developer interaction.

Key to their strategy is a robust Creator Program, which empowers streamers and content creators with resources and support, aiming to generate organic content and further expand the community's reach. Furthermore, Wildcard integrates with the "Thousands" streaming platform, offering an innovative interactive spectator experience where viewers can influence live matches and earn rewards. This, along with various in-game incentives like packs and exclusive cosmetics for participation, ensures that the Wildcard community remains dynamic, involved, and well-rewarded for its contributions.

Side note - the team allocated 100% of the native Wildcard token to the community, meaning its success is completely community led.`,
      },
      wardensScore: {
        title: "Final Verdict",
        content: {
          pros: [
            "Innovative Genre Blend: Combines CCG depth with real-time action, offering a fresh gameplay experience.",
            "Strategic & Skill-Based: Rewards both smart deck-building and precise real-time execution in combat.",
            "Champion Diversity: Promises unique Champions with distinct playstyles, encouraging varied strategies.",
            "Strong Community Focus: Developers are actively engaging players through alphas, feedback, and creator programs.",
            'Dynamic Spectator Experience: The "Thousands" platform offers unique audience interaction, potentially enhancing esports.',
          ],
          cons: [
            "Learning Curve: The hybrid nature might be challenging for players new to either CCGs or action-MOBA games.",
            "Balance Challenges: Blending two genres can make achieving long-term balance for Champions and cards difficult.",
            "Monetization Concerns (Potential): As a CCG, there's always a risk of aggressive monetization impacting player progression.",
            "New IP Risk: As a new game in a competitive landscape, it needs to build a dedicated player base from scratch.",
            '"Web3" Integration: While optional, the association with "Thousands" and Web3 could deter some traditional gamers.',
          ],
          score: "8.5/10",
        },
      },
    },
  },
  "legends-of-elumia": {
    title: "Legends of Elumia",
    heroImage: "/images/games/legends-of-elumia-banner.png",
    logo: "/images/games/legends-of-elumia-logo.png",
    rating: 4.6,
    author: "The Wardens",
    date: "2024-04-01",
    hasShieldOfApproval: false,
    developer: "Elumia Studios",
    publisher: "Elumia Interactive",
    platforms: ["PC", "Mobile"],
    genre: "MMORPG",
    releaseDate: "2024",
    status: "Released",
    categories: ["MMORPG", "Fantasy", "Action"],
    sections: {
      overview: {
        title: "Overview",
        content:
          "Legends of Elumia brings fast-paced action to the MMORPG genre with its focus on skill-based combat and team coordination. The game successfully balances accessibility with depth, making it appealing to both newcomers and veterans.",
      },
      gameModes: {
        title: "Game Modes",
        content:
          "Features traditional dungeon crawling, large-scale raids, competitive PvP arenas, and unique world boss encounters that require server coordination.",
      },
      gameplay: {
        title: "Gameplay",
        content:
          "Combat is fluid and responsive with a focus on timing and positioning. The progression system rewards both individual skill development and team coordination.",
        hasMedia: true,
        mediaType: "gameplay",
      },
      graphics: {
        title: "Graphics",
        content:
          "High-quality 3D graphics with detailed character models and impressive spell effects. The world design is cohesive and immersive with varied environments.",
        hasMedia: true,
        mediaType: "visual",
      },
      audio: {
        title: "Audio",
        content:
          "Epic orchestral score that enhances the fantasy atmosphere. Combat audio is satisfying with clear audio cues for important gameplay elements.",
      },
      community: {
        title: "Community",
        content:
          "Growing community with active guilds and regular events. The game's focus on team play naturally fosters social connections between players.",
      },
      wardensScore: {
        title: "Warden's Score",
        content:
          "Legends of Elumia delivers solid MMORPG gameplay with excellent combat mechanics. While it doesn't revolutionize the genre, it executes the fundamentals very well.",
      },
    },
  },
  ravenquest: {
    title: "RavenQuest",
    heroImage: "/images/games/ravenquest.jpg",
    logo: "/images/games/ravenquest-logo.png",
    score: "8/10",
    author: "The Wardens",
    date: "2025-11-01",
    hasShieldOfApproval: true,
    developer: "Tavernlight Games",
    publisher: "Tavernlight Games",
    platforms: ["PC"],
    genre: "MMORPG, Sandbox",
    releaseDate: "2024",
    status: "Released",
    categories: ["MMORPG", "Sandbox", "Fantasy"],
    sections: {
      overview: {
        title: "Overview",
        content:
          'RavenQuest is a free-to-play, top-down pixel-art MMORPG. It offers a sandbox world with a flexible "Archetype System" for character building, a player-driven economy, and both PvP and PvE content. It\'s a Web3 game where certain in-game assets, like land, are owned by players as NFTs, but the core game can be played without any crypto involvement.',
      },
      gameModes: {
        title: "Game Modes",
        content: `PvE (Player vs. Environment)
For those who enjoy a cooperative, story-driven experience, there's PvE (Player vs. Environment). You can team up with friends to take on challenging dungeons and defeat powerful bosses. The world is also filled with quests and lore to uncover, allowing you to immerse yourself in the rich history of the game.

PvP (Player vs. Player)
If you thrive on competition, you'll find plenty of opportunities in PvP (Player vs. Player). You can test your skills in the ranked arena, participate in large-scale guild wars, or even engage in open-world combat to plunder other players' resources. It's a high-stakes, high-reward system for those who want to prove their strength.

Sandbox economy
For players who prefer a more laid-back, creative approach, the sandbox economy is a major part of the game. You can gather resources, craft items, and become a master of a specific profession. The game's economy is entirely player-driven, so you can make a name for yourself as a skilled farmer, a master blacksmith, or a savvy trader.`,
      },
      gameplay: {
        title: "Gameplay",
        content: `The ultimate goal of RavenQuest is to forge your own legacy in a vast, player-driven sandbox. Unlike many traditional MMORPGs that guide you along a fixed path, RavenQuest gives you the freedom to choose your destiny. You can rise to power as a formidable warrior, amass wealth as a cunning merchant, or become a revered landowner. The entire game is designed around your choices and actions, with nearly every activity contributing to your character's progression and influence in the world. The gameplay is a constant balance between risk and reward, whether you're transporting valuable goods through a dangerous zone or battling for control of a key location. You are not just playing a game; you are shaping its world.

Key Features:
- Player-Driven Economy: The entire market is controlled by players.
- Tradepack System: High-risk transport of goods for profit.
- Classless System: Combine three out of eight archetypes to create your own unique class.
- Professions and Land Ownership: Master skills and own land to contribute to the world's production.
- PvP and PvE: A mix of open-world combat and cooperative dungeons.
- NFT Integration: True ownership of in-game assets.
- Dual-Currency System: RavenQuest uses Silver for everyday trading and progression, while $QUEST is an optional on-chain token for exclusive items and rewards. This keeps the core economy fair while adding Web3 depth for those who want it.`,
        hasMedia: true,
        mediaType: "gameplay",
      },
      graphics: {
        title: "Graphics",
        content:
          "RavenQuest features a nostalgic pixel-art style with a top-down, isometric view. This graphical approach is a deliberate choice by the developers to focus on deep gameplay and a strong community, rather than on photorealistic visuals. The art style is often compared to classic MMORPGs, giving the game a familiar feel while remaining distinct.",
        hasMedia: true,
        mediaType: "visual",
      },
      audio: {
        title: "Audio",
        content:
          "RavenQuest's audio is designed to complement its visual style. The game features a dynamic soundtrack with unique, regional music that changes as you explore different areas. Sound effects are crafted to match the pixel-art visuals, providing satisfying feedback for combat and other in-game actions, all to enhance the overall experience.",
      },
      community: {
        title: "Community",
        content: `The community for RavenQuest is highly engaged and passionate, driven by the game's focus on player interaction and a sandbox world. The developers, Tavernlight Games, place a strong emphasis on community involvement and communication.

Key aspects of the RavenQuest community include:
- Discord: The official Discord server is the central hub for the community, with tens of thousands of members. It's where players can get the latest updates, chat with developers, find groups for dungeons, and participate in community events.
- Player-Driven: Because the game's economy is entirely player-driven, the community is essential for everything from trading and crafting to organizing guilds and large-scale PvP battles. This fosters a strong sense of cooperation and competition.
- Creator Program: The developers have a dedicated creator program to support content creators who help grow the community. This program offers in-game rewards, financial incentives, and direct access to the development team, ensuring a constant flow of community-generated guides, videos, and streams.
- Active Development Communication: The developers are known for being very transparent and actively communicating with the community about upcoming changes, updates, and their long-term vision for the game. This helps to build trust and keeps players invested in the game's future.`,
      },
      wardensScore: {
        title: "Final Verdict",
        content: {
          pros: [
            "Player-Driven Sandbox: The economy and world are directly shaped by player actions, offering a dynamic and impactful experience.",
            "Freedom of Progression: You aren't locked into a single path. You can focus on combat, crafting, or trading, with a classless system for deep customization.",
            "Active Developers: The team is highly transparent, actively communicating and incorporating community feedback into the game's development.",
            'Accessible: The pixel-art graphics and "Free-to-Earn" model make the game easy to run and free to start.',
          ],
          cons: [
            "Economy-Centric: The strong focus on the economy may not appeal to players who primarily want to focus on combat.",
            'Potential for "Pay-to-Win": While free, some feel that paying for a subscription or certain items provides significant advantages, creating an uneven playing field.',
            "Insufficient group content: The game is largely designed for solo play, with a notable lack of dungeons or raids for players seeking cooperative experiences.",
          ],
          score: "8/10",
        },
      },
    },
  },
}

export default function GameReviewPage() {
  useScrollTop()

  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [isLoaded, setIsLoaded] = useState(false)

  const review = reviewData[slug]

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  if (!review) {
    return (
      <main className="page-transition">
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
          </div>
          <div className="container mx-auto px-4 relative z-10 text-center">
            <h1 className="text-4xl font-bold text-white mb-4">Review Not Found</h1>
            <p className="text-gray-300 mb-8">The review you're looking for doesn't exist.</p>
            <Button
              onClick={() => router.push("/game-hub")}
              className="bg-wardens-gold hover:bg-wardens-gold/90 text-black"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Game Hub
            </Button>
          </div>
        </section>
      </main>
    )
  }

  const MediaPlaceholder = ({ type, title }) => (
    <div className="relative group">
      <div className="bg-gradient-to-br from-wardens-gold/10 to-wardens-gold/5 border border-wardens-gold/30 rounded-lg p-8 text-center transition-all duration-300 hover:border-wardens-gold/50 hover:shadow-lg hover:shadow-wardens-gold/10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-wardens-gold/20 rounded-full mb-4 group-hover:bg-wardens-gold/30 transition-all duration-300">
          {type === "gameplay" ? (
            <Play className="h-8 w-8 text-wardens-gold" />
          ) : (
            <Camera className="h-8 w-8 text-wardens-gold" />
          )}
        </div>
        <h4 className="text-lg font-semibold text-white mb-2">
          {type === "gameplay" ? "Gameplay Video" : "Visual Gallery"}
        </h4>
        <p className="text-gray-400 text-sm">
          {type === "gameplay"
            ? `Interactive ${title} gameplay footage and mechanics demonstration`
            : `High-resolution screenshots and visual analysis of ${title}`}
        </p>
      </div>
    </div>
  )

  const GameplayVideo = ({ gameSlug, title }) => {
    const videoUrls = {
      "off-the-grid": "https://www.youtube.com/embed/OLVvTd-0ZhQ",
      wildcard: "https://www.youtube.com/embed/4vlPnISy7zM",
      "legends-of-elumia": "https://www.youtube.com/embed/your_legends_of_elumia_video_id", // Placeholder
      ravenquest: "https://www.youtube.com/embed/OiKSf57y_8A", // Updated RavenQuest Gameplay
    }

    const videoUrl = videoUrls[gameSlug]

    if (!videoUrl) {
      return <MediaPlaceholder type="gameplay" title={title} />
    }

    return (
      <div className="relative group">
        <div className="bg-gradient-to-br from-wardens-gold/10 to-wardens-gold/5 border border-wardens-gold/30 rounded-lg overflow-hidden transition-all duration-300 hover:border-wardens-gold/50 hover:shadow-lg hover:shadow-wardens-gold/10">
          <div className="aspect-video">
            <iframe
              src={videoUrl}
              title={`${title} Gameplay Video`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          <div className="p-4">
            <h4 className="text-lg font-semibold text-white mb-2">Official Gameplay</h4>
            <p className="text-gray-400 text-sm">Watch {title} in action with official gameplay footage</p>
          </div>
        </div>
      </div>
    )
  }

  const GraphicsBanner = ({ gameSlug, title }) => {
    const bannerImages = {
      "off-the-grid": "/images/reviews/off-the-grid-banner.png",
      wildcard: "/images/reviews/wildcard-banner.jpg",
      "legends-of-elumia": "/images/reviews/legends-of-elumia-banner.png", // Placeholder
      ravenquest: "/images/reviews/ravenquest-graphics.png", // Updated RavenQuest Visuals
    }

    const bannerImage = bannerImages[gameSlug]

    if (!bannerImage) {
      return <MediaPlaceholder type="visual" title={title} />
    }

    return (
      <div className="relative group">
        <div className="bg-gradient-to-br from-wardens-gold/10 to-wardens-gold/5 border border-wardens-gold/30 rounded-lg overflow-hidden transition-all duration-300 hover:border-wardens-gold/50 hover:shadow-lg hover:shadow-wardens-gold/10">
          <div className="relative aspect-video">
            <Image
              src={bannerImage || "/placeholder.svg"}
              alt={`${title} Graphics Showcase`}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
          <div className="p-4">
            <h4 className="text-lg font-semibold text-white mb-2">Visual Showcase</h4>
            <p className="text-gray-400 text-sm">High-quality visuals and graphics from {title}</p>
          </div>
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

      <section className="py-32 relative">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-wardens-gold/5 to-black/20"></div>
          <div className="absolute inset-0 bg-[url('/images/medieval-pattern.png')] opacity-5"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content */}
            <div className="w-full lg:w-2/3 fade-in">
              <div className="relative h-80 rounded-lg overflow-hidden mb-8 glow-effect">
                <Image
                  src={review.heroImage || "/placeholder.svg"}
                  alt={`${review.title} Review Banner`}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6">
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 rounded-lg overflow-hidden border-2 border-wardens-gold">
                      <Image
                        src={review.logo || review.heroImage}
                        alt={`${review.title} Logo`}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h1 className="text-3xl md:text-4xl font-bold text-white">
                        {review.title} <span className="text-wardens-gold">Review</span>
                      </h1>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {review.categories.map((category) => (
                          <Badge key={category} className="bg-wardens-gold text-black hover:bg-wardens-gold/90">
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {/* Overview Section */}
                <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-8 glow-effect">
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-wardens-gold">01.</span>
                    {review.sections.overview.title}
                  </h2>
                  <div className="prose prose-invert max-w-none">
                    <p className="text-gray-300 text-lg leading-relaxed mb-4">{review.sections.overview.content}</p>
                  </div>
                </div>

                {/* Game Modes Section */}
                <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-8 glow-effect">
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-wardens-gold">02.</span>
                    {review.sections.gameModes.title}
                  </h2>
                  <div className="prose prose-invert max-w-none">
                    <div className="text-gray-300 text-lg leading-relaxed whitespace-pre-line">
                      {review.sections.gameModes.content}
                    </div>
                  </div>
                </div>

                {/* Gameplay Section */}
                <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-8 glow-effect">
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-wardens-gold">03.</span>
                    {review.sections.gameplay.title}
                  </h2>
                  <div className="prose prose-invert max-w-none">
                    <div className="text-gray-300 text-lg leading-relaxed whitespace-pre-line mb-6">
                      {review.sections.gameplay.content}
                    </div>
                    {review.sections.gameplay.hasMedia && <GameplayVideo gameSlug={slug} title={review.title} />}
                  </div>
                </div>

                {/* Graphics Section */}
                <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-8 glow-effect">
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-wardens-gold">04.</span>
                    {review.sections.graphics.title}
                  </h2>
                  <div className="prose prose-invert max-w-none">
                    <div className="text-gray-300 text-lg leading-relaxed whitespace-pre-line mb-6">
                      {review.sections.graphics.content}
                    </div>
                    {review.sections.graphics.hasMedia && <GraphicsBanner gameSlug={slug} title={review.title} />}
                  </div>
                </div>

                {/* Audio Section */}
                <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-8 glow-effect">
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-wardens-gold">05.</span>
                    {review.sections.audio.title}
                  </h2>
                  <div className="prose prose-invert max-w-none">
                    <div className="text-gray-300 text-lg leading-relaxed whitespace-pre-line">
                      {review.sections.audio.content}
                    </div>
                  </div>
                </div>

                {/* Community Section */}
                <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-8 glow-effect">
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-wardens-gold">06.</span>
                    {review.sections.community.title}
                  </h2>
                  <div className="prose prose-invert max-w-none">
                    <div className="text-gray-300 text-lg leading-relaxed whitespace-pre-line">
                      {review.sections.community.content}
                    </div>
                  </div>
                </div>

                {/* Warden's Score Section */}
                <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-8 glow-effect">
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-wardens-gold">07.</span>
                    {review.sections.wardensScore.title}
                  </h2>
                  <div className="prose prose-invert max-w-none">
                    {typeof review.sections.wardensScore.content === "object" ? (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            🏆 <span>Pro's:</span>
                          </h3>
                          <ul className="space-y-2">
                            {review.sections.wardensScore.content.pros.map((pro, index) => (
                              <li key={index} className="text-gray-300 text-lg leading-relaxed flex items-start gap-2">
                                <span className="text-wardens-gold mt-1">•</span>
                                <span>{pro}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            📉 <span>Con's:</span>
                          </h3>
                          <ul className="space-y-2">
                            {review.sections.wardensScore.content.cons.map((con, index) => (
                              <li key={index} className="text-gray-300 text-lg leading-relaxed flex items-start gap-2">
                                <span className="text-wardens-gold mt-1">•</span>
                                <span>{con}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-4 border-t border-wardens-gold/20">
                          <p className="text-white text-xl font-bold">
                            Score:{" "}
                            <span className="text-wardens-gold">[{review.sections.wardensScore.content.score}]</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-300 text-lg leading-relaxed mb-6">
                        {review.sections.wardensScore.content}
                      </p>
                    )}
                  </div>
                </div>

                {/* Wardens Shield of Approval Section */}
                {review.hasShieldOfApproval && (
                  <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-8 glow-effect">
                    <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                      <span className="text-wardens-gold">08.</span>
                      Wardens Shield of Approval
                    </h2>
                    <div className="flex items-center gap-6 mb-6">
                      <div className="relative h-32 animate-pulse ml-4">
                        <Image
                          src="/images/wardens-shield-of-approval.png"
                          alt="Wardens Shield of Approval"
                          fill
                          className="object-contain drop-shadow-2xl"
                          style={{
                            filter:
                              "drop-shadow(0 0 20px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 40px rgba(255, 215, 0, 0.4))",
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-wardens-gold mb-2">Approved by The Wardens</h3>
                        <div className="prose prose-invert max-w-none">
                          <p className="text-gray-300 text-lg leading-relaxed">
                            {slug === "off-the-grid"
                              ? "Off The Grid earns our Shield of Approval for its innovative blend of battle royale mechanics with Web3 integration, delivering fast-paced cyberpunk action that keeps players engaged. Despite some optimization challenges, the game's unique cyberlimb system, dynamic gameplay, and strong community focus make it a standout title that successfully pushes the boundaries of the genre while maintaining accessibility for both newcomers and veterans."
                              : slug === "wildcard"
                                ? "Wildcard receives our Shield of Approval for its groundbreaking fusion of collectible card game strategy with real-time MOBA-style combat, creating a truly unique gaming experience. The game's innovative CCAG approach, combined with its strong community-first development philosophy and engaging spectator features, demonstrates exceptional creativity and execution that sets new standards for hybrid gaming experiences."
                                : slug === "ravenquest"
                                  ? "RavenQuest earns our Shield of Approval for its compelling player-driven sandbox MMORPG experience. The game masterfully blends deep economic simulation, flexible character progression through its classless system, and active developer communication, creating an accessible and engaging world for players to shape their own destiny. Its focus on community and true ownership of assets makes it a standout title in the evolving MMORPG landscape."
                                  : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-1/3 fade-in-up">
              <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8 py-3">
                <h3 className="text-xl font-bold text-white mb-4">Review Information</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm">Reviewer</p>
                    <p className="text-white font-semibold">{review.author}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Review Date</p>
                      <p className="text-white font-semibold">
                        {new Date(review.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    {review.hasShieldOfApproval && (
                      <div className="relative h-32 animate-pulse ml-4 w-60">
                        <Image
                          src="/images/wardens-shield-of-approval.png"
                          alt="Wardens Shield of Approval"
                          fill
                          className="object-contain drop-shadow-2xl"
                          style={{
                            filter:
                              "drop-shadow(0 0 20px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 40px rgba(255, 215, 0, 0.4))",
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Warden's Score</p>
                    <div className="text-wardens-gold font-bold text-lg px-8">{review.score || "Not Rated"}</div>
                  </div>
                </div>
              </div>

              <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Game Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-wardens-gold" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Developer</h3>
                      <p className="text-white">{review.developer}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-wardens-gold" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Publisher</h3>
                      <p className="text-white">{review.publisher}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-wardens-gold" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Release Date</h3>
                      <p className="text-white">{review.releaseDate}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Platforms</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {review.platforms.map((platform) => (
                        <Badge key={platform} className="bg-gray-700 hover:bg-gray-600">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Genre</p>
                    <p className="text-white font-semibold">{review.genre}</p>
                  </div>
                </div>
              </div>

              <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Join The Wardens</h3>
                <p className="text-gray-300 mb-4">
                  Want to play {review.title} with The Wardens? Join our community for gameplay tips, events, and more!
                </p>
                <Button className="w-full bg-wardens-gold hover:bg-wardens-gold/90 text-black">
                  <Link
                    href="https://discord.gg/thewardensgc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full"
                  >
                    Join Discord
                  </Link>
                </Button>
              </div>

              <RelatedGames currentGameSlug={slug} currentGameGenres={review.categories} />
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/game-hub">
              <Button className="bg-wardens-gold hover:bg-wardens-gold/90 text-black">Back to Game Hub</Button>
            </Link>
          </div>
        </div>
      </section>
      <SectionDivider />
    </main>
  )
}
