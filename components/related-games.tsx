"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

interface Game {
  slug: string
  name: string
  logo: string
  genres: string[]
}

interface RelatedGamesProps {
  currentGameSlug: string
  currentGameGenres: string[]
}

const allGames: Game[] = [
  {
    slug: "bloodloop",
    name: "Bloodloop",
    logo: "/images/games/bloodloop-logo.png",
    genres: ["Shooter", "Action", "Hero Shooter", "Multiplayer"],
  },
  {
    slug: "cambria",
    name: "Cambria",
    logo: "/images/games/cambria-logo.png",
    genres: ["MMORPG", "Fantasy", "Adventure", "Web3"],
  },
  {
    slug: "castle-of-blackwater",
    name: "Castle of Blackwater",
    logo: "/images/games/castle-of-blackwater-logo.png",
    genres: ["Action", "Adventure", "Fantasy", "RPG"],
  },
  {
    slug: "fableborne",
    name: "Fableborne",
    logo: "/images/games/fableborne-logo.png",
    genres: ["RPG", "Action", "Fantasy", "Adventure"],
  },
  {
    slug: "golden-tides",
    name: "Golden Tides",
    logo: "/images/games/golden-tides-logo.png",
    genres: ["Adventure", "Strategy", "Naval", "Action"],
  },
  {
    slug: "legends-of-elumia",
    name: "Legends of Elumia",
    logo: "/images/games/legends-of-elumia-logo.png",
    genres: ["MMORPG", "Fantasy", "Adventure", "RPG"],
  },
  {
    slug: "my-pet-hooligan",
    name: "My Pet Hooligan",
    logo: "/images/games/my-pet-hooligan-banner.png",
    genres: ["Action", "Platformer", "Adventure"],
  },
  {
    slug: "off-the-grid",
    name: "Off The Grid",
    logo: "/images/games/off-the-grid-logo.png",
    genres: ["Battle Royale", "Shooter", "Action", "Multiplayer"],
  },
  {
    slug: "parallel",
    name: "Parallel",
    logo: "/images/games/parallel-logo.png",
    genres: ["Card Game", "Strategy", "Sci-Fi", "TCG"],
  },
  {
    slug: "ravenquest",
    name: "RavenQuest",
    logo: "/images/games/ravenquest-logo.png",
    genres: ["MMORPG", "Sandbox", "Fantasy", "Adventure"],
  },
  {
    slug: "seedworld",
    name: "Seedworld",
    logo: "/images/games/seedworld-logo.png",
    genres: ["MMO", "Sandbox", "Adventure", "Building"],
  },
  {
    slug: "sparkball",
    name: "Sparkball",
    logo: "/images/games/sparkball-logo.jpg",
    genres: ["MOBA", "Action", "Sports", "Multiplayer"],
  },
  {
    slug: "the-beacon",
    name: "The Beacon",
    logo: "/images/games/the-beacon-logo.png",
    genres: ["Action", "Adventure", "Roguelite", "Survival"],
  },
  {
    slug: "the-bornless",
    name: "The Bornless",
    logo: "/images/games/the-bornless-logo.png",
    genres: ["Horror", "Action", "Multiplayer", "Survival"],
  },
  {
    slug: "treeverse",
    name: "Treeverse",
    logo: "/images/games/treeverse-logo.jpg",
    genres: ["MMORPG", "Fantasy", "Adventure", "Open World"],
  },
  {
    slug: "variance",
    name: "Variance",
    logo: "/images/games/variance-logo.png",
    genres: ["Roguelike", "RPG", "Action", "Indie"],
  },
  {
    slug: "wildcard",
    name: "Wildcard",
    logo: "/images/games/wildcard-logo.png",
    genres: ["MOBA", "Action", "Strategy", "Multiplayer"],
  },
  {
    slug: "xociety",
    name: "XOCIETY",
    logo: "/images/games/xociety-logo.png",
    genres: ["MMORPG", "Open World", "Adventure", "Social"],
  },
  {
    slug: "andrometa",
    name: "Andrometa",
    logo: "/images/games/andrometa-logo.png",
    genres: ["Space Sim", "Exploration", "Trading", "Sandbox"],
  },
  {
    slug: "77-bit",
    name: "77 Bit",
    logo: "/images/games/77-bit-logo.png",
    genres: ["Arcade", "Retro", "Action", "Pixel Art"],
  },
  {
    slug: "engines-of-fury",
    name: "Engines of Fury",
    logo: "/images/games/engines-of-fury.png",
    genres: ["Racing", "Combat", "Action", "Multiplayer"],
  },
  {
    slug: "legend-of-ymir",
    name: "Legend of Ymir",
    logo: "/images/games/legend-of-ymir-logo.jpg",
    genres: ["MMORPG", "Action", "Fantasy", "Adventure"],
  },
]

export default function RelatedGames({ currentGameSlug, currentGameGenres }: RelatedGamesProps) {
  const [relatedGames, setRelatedGames] = useState<Game[]>([])
  const router = useRouter()

  useEffect(() => {
    // Make sure currentGameGenres is defined before using it
    if (!currentGameGenres || !Array.isArray(currentGameGenres)) {
      // Fallback to empty array if genres are not provided
      const otherGames = allGames.filter((game) => game.slug !== currentGameSlug)
      const randomGames = otherGames.sort(() => 0.5 - Math.random()).slice(0, 3)
      setRelatedGames(randomGames)
      return
    }

    // Filter out the current game
    const otherGames = allGames.filter((game) => game.slug !== currentGameSlug)

    // Find games with matching genres
    const gamesWithMatchingGenres = otherGames.map((game) => {
      const matchingGenres = game.genres.filter((genre) => currentGameGenres.includes(genre))
      return {
        ...game,
        matchCount: matchingGenres.length,
      }
    })

    // Sort by number of matching genres (descending)
    const sortedGames = gamesWithMatchingGenres
      .sort((a, b) => b.matchCount - a.matchCount)
      .filter((game) => game.matchCount > 0)
      .slice(0, 3)
      .map(({ matchCount, ...game }) => game)

    // If we don't have enough related games, add some random ones
    if (sortedGames.length < 3) {
      const randomGames = otherGames
        .filter((game) => !sortedGames.some((g) => g.slug === game.slug))
        .sort(() => 0.5 - Math.random())
        .slice(0, 3 - sortedGames.length)

      setRelatedGames([...sortedGames, ...randomGames])
    } else {
      setRelatedGames(sortedGames)
    }
  }, [currentGameSlug, currentGameGenres])

  return (
    <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">RELATED GAMES</h3>
      <div className="space-y-4">
        {relatedGames.map((game) => (
          <div
            key={game.slug}
            className="block group cursor-pointer game-card rounded-lg overflow-hidden border border-wardens-gold/20 hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20 flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-black/40"
            onClick={(e) => {
              e.preventDefault()
              setTimeout(() => router.push(`/game-hub/${game.slug}`), 100)
            }}
          >
            <div className="relative h-12 w-12 rounded overflow-hidden flex-shrink-0 border border-wardens-gold/30">
              <Image src={game.logo || "/placeholder.svg"} alt={`${game.name} logo`} fill className="object-cover" />
            </div>
            <div>
              <h4 className="font-medium text-white group-hover:text-wardens-gold transition-colors">{game.name}</h4>
              <p className="text-xs text-gray-400">{game.genres.join(", ")}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
