"use client"

import { trackGameWishlist, trackGamePlay } from "@/utils/analytics"

interface GameCTAProps {
  gameName: string
  platform: string
  storeUrl: string
  released: boolean
}

export default function GameCTA({ gameName, platform, storeUrl, released }: GameCTAProps) {
  const handleClick = () => {
    if (released) {
      trackGamePlay(gameName, platform)
    } else {
      trackGameWishlist(gameName, platform)
    }

    window.open(storeUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <button
      onClick={handleClick}
      className={`
        w-full text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200
        ${released ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
      `}
    >
      {released ? "Start Playing Now!" : "Wishlist The Game!"}
    </button>
  )
}
