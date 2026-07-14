"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Twitter, MessageSquare, Globe } from "lucide-react"
import { useScrollTop } from "@/hooks/use-scroll-top"
import RelatedGames from "@/components/related-games"
import SectionDivider from "@/components/section-divider"

export default function BattleRisePage() {
  useScrollTop()
  const [activeTab, setActiveTab] = useState("overview")

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
              {/* Game Banner */}
              <div className="relative h-80 rounded-lg overflow-hidden mb-8 glow-effect">
                <Image
                  src="/images/games/battlerise-banner.png"
                  alt="BattleRise Banner"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6">
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 rounded-lg overflow-hidden border-2 border-wardens-gold">
                      <Image
                        src="/images/games/battlerise-logo.jpg"
                        alt="BattleRise Logo"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h1 className="text-3xl md:text-4xl font-bold text-white">BattleRise: Kingdom of Champions</h1>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge className="bg-wardens-gold text-black hover:bg-wardens-gold/90">RPG</Badge>
                        <Badge className="bg-wardens-gold text-black hover:bg-wardens-gold/90">Adventure</Badge>
                        <Badge className="bg-wardens-gold text-black hover:bg-wardens-gold/90">TCG</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-black/50 border border-wardens-gold/20 p-1 rounded-lg w-full justify-start mb-6">
                  <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-wardens-gold data-[state=active]:text-black tab-header relative px-6 py-2 rounded-md transition-all duration-300"
                  >
                    Overview
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-wardens-gold opacity-0 data-[state=active]:opacity-100 transition-opacity"></span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="gameplay"
                    className="data-[state=active]:bg-wardens-gold data-[state=active]:text-black tab-header relative px-6 py-2 rounded-md transition-all duration-300"
                  >
                    Gameplay
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-wardens-gold opacity-0 data-[state=active]:opacity-100 transition-opacity"></span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="features"
                    className="data-[state=active]:bg-wardens-gold data-[state=active]:text-black tab-header relative px-6 py-2 rounded-md transition-all duration-300"
                  >
                    Features
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-wardens-gold opacity-0 data-[state=active]:opacity-100 transition-opacity"></span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-0">
                  <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4">ABOUT THE GAME</h2>
                    <p className="text-gray-300 mb-6 text-xl font-semibold">
                      Tactically Enchanting. Magically Unlimited.
                    </p>
                    <p className="text-gray-300 mb-6">
                      BattleRise: Kingdom of Champions is a collectible, role-playing game combining gripping turn-based
                      battles, an engaging story-mode, and endless dungeons (and with even more features planned for the
                      future). BattleRise is inspired by fan-favorite, classic, fantasy-themed games, yet has its own
                      look and feel.
                    </p>
                    <p className="text-gray-300 mb-6">
                      In the world of Eos, an immeasurably powerful creature and his henchmen threaten all the realms of
                      the living. Your task in this epic and perilous quest to save the world is to unite brave,
                      foolhardy, battle-hardened warriors in an epic struggle against these ancient evils threatening to
                      annihilate all of creation.
                    </p>

                    <div className="mb-6">
                      <ul className="text-gray-300 space-y-2">
                        <li>• Experience a world teeming with adventure and evil</li>
                        <li>• Encounter other Champions in the arena</li>
                        <li>• Fight through endless dungeons to retrieve legendary loot</li>
                        <li>• Craft and customize powerful Artifacts</li>
                        <li>• Strategize on and off the battlefield to vanquish opponents</li>
                        <li>• And seize rich rewards!</li>
                      </ul>
                    </div>

                    <p className="text-gray-300 mb-6">
                      Rise up to the many challenges that BattleRise has to offer in the Kingdom of Champions!
                    </p>

                    <div className="aspect-video w-full relative rounded-lg overflow-hidden mb-6">
                      <iframe
                        src="https://www.youtube.com/embed/cxOytBi78bw"
                        title="BattleRise: Kingdom of Champions Trailer"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="gameplay" className="mt-0">
                  <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4">GAME MODES</h2>

                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-wardens-gold mb-2">Dungeon Run</h3>
                      <p className="text-gray-300">
                        An endless dungeon experience where you battle enemies, collect loot, and defeat bosses with
                        your 5 selected Champions.
                      </p>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-wardens-gold mb-2">Arena</h3>
                      <p className="text-gray-300">
                        Battle it out against other players in a ranked PvP arena mode. Choose your champions and climb
                        the seasonal leaderboards.
                      </p>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-wardens-gold mb-2">Gauntlet</h3>
                      <p className="text-gray-300">
                        This game mode is a new experience in beta, bringing you a unique spin on TCG games.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="features" className="mt-0">
                  <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4">KEY FEATURES</h2>

                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-wardens-gold mb-2">DUNGEON RUN</h3>
                      <p className="text-gray-300 mb-4">
                        Scour for legendary loot and epic bonuses in shrines, and face Tiamat's heralds on the paths of
                        the treacherous dungeons. Choose your Champions and strategy wisely to get through all the
                        challenges and prevail.
                      </p>
                      <p className="text-gray-300 mb-4">
                        Every Dungeon Run is directly affected by the decisions you make along the way:
                      </p>
                      <ul className="text-gray-300 space-y-1 mb-4 ml-4">
                        <li>• Which Gods you ask for a blessing</li>
                        <li>• Which ally Champions you choose</li>
                        <li>• Which abandoned shrine you inspect</li>
                      </ul>
                      <p className="text-gray-300">
                        All these choices bring benefits and consequences that directly influence the story and the
                        progress of that specific run, changing your experience. You can play a single Dungeon Run many
                        times over before you get through every possible combination, allowing you to discover new
                        depths of the lore every time you play.
                      </p>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-wardens-gold mb-2">ARENA</h3>
                      <p className="text-gray-300">
                        Clash with others in the gripping synchronous PVP battles for one sole purpose - the taste of
                        victory! Step into the grandest arena of all and let your name be known among other players.
                      </p>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-wardens-gold mb-2">CHAMPIONS</h3>
                      <p className="text-gray-300 mb-4">
                        Unite and rise with Champions from a wide range of iconic backgrounds. Choose from a host of
                        formidable factions such as sanctified Seraphim, Verdant Offspring, and Void Lords. Explore
                        dozens of Champions bringing unique skills and stories. Many more Champions are planned over
                        time.
                      </p>
                      <p className="text-gray-300 mb-4">
                        Every single Champion brings something different to the table. It is up to you to learn what
                        each of them does best and find ways to combine their skills and abilities in the optimum way.
                        Many Champions have built-in synergy with each other, allowing them to work as a team
                        seamlessly.
                      </p>
                      <p className="text-gray-300">
                        There are many permutations of team composition to cater to your preferred playstyle. Will you
                        rush your opponent to bring them down before they even get a turn? Or do you enjoy the battle
                        and prefer to take your time? The choice is yours!
                      </p>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-wardens-gold mb-2">ARTIFACTS</h3>
                      <p className="text-gray-300 mb-4">
                        The world of Eos is full of legendary weapons, ancient artifacts, and magic spells!
                      </p>
                      <p className="text-gray-300">
                        Find the treasure and experiment enabling viable Champions with your collectibles. The artifacts
                        can enhance their powers in various ways. Play and seek the best setup for your Champions. The
                        possibilities are many. The choices are yours!
                      </p>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-wardens-gold mb-2">STORY</h3>
                      <p className="text-gray-300">
                        Delve into the world of Eos! Embark on adventures inspired by fan-favorite, classic, fantasy
                        themes. Multiple quests and immersive stories await you.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-1/3 fade-in-up">
              <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Game Information</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm">Developer</p>
                    <p className="text-white font-semibold">Triumph Games</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Platforms</p>
                    <p className="text-white font-semibold">App Store, Google Play</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Genre</p>
                    <p className="text-white font-semibold">RPG, Adventure, TCG</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Status</p>
                    <Badge className="bg-green-600 hover:bg-green-700">Available Now</Badge>
                  </div>
                </div>
              </div>

              <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Social Links</h3>
                <div className="space-y-3">
                  <Link
                    href="https://www.battlerise.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-300 hover:text-wardens-gold transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    <span>Official Website</span>
                  </Link>
                  <Link
                    href="https://x.com/BattleRiseGame"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-300 hover:text-wardens-gold transition-colors"
                  >
                    <Twitter className="h-4 w-4" />
                    <span>Twitter</span>
                  </Link>
                  <Link
                    href="https://discord.com/invite/battlerise"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-300 hover:text-wardens-gold transition-colors"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Discord</span>
                  </Link>
                </div>
              </div>

              <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">PLAY NOW</h3>
                
                <p className="text-gray-400 text-sm text-center mt-3">Available on App Store & Google Play</p>
              </div>

              <div className="bg-black/50 border border-wardens-gold/20 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Join The Wardens</h3>
                <p className="text-gray-300 mb-4">
                  Want to play BattleRise with The Wardens? Join our community for gameplay tips, events, and more!
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

              <RelatedGames currentGameSlug="battlerise" currentGameGenres={["RPG", "Adventure", "TCG"]} />
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
