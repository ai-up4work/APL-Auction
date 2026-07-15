"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Twitter, MessageSquare, Globe, Trophy, Calendar, Users } from "lucide-react"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import SectionDivider from "@/components/section-divider"
import RelatedTournaments from "@/components/tournament/related-tournaments"
import { pageStyles, type ShowcaseSlide } from "@/data/site-data"

interface TournamentDetailClientProps {
  tournament: ShowcaseSlide
  slug: string
}

export default function TournamentDetailClient({ tournament, slug }: TournamentDetailClientProps) {
  useScrollTop()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")
  const [isNavOpen, setIsNavOpen] = useState(false)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const status = tournament.status || "Upcoming"
  const statusColor =
    status === "Live" ? "bg-red-600 hover:bg-red-700" : status === "Completed" ? "bg-gray-600 hover:bg-gray-700" : "bg-green-600 hover:bg-green-700"

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-32 sm:pt-40 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content */}
            <div className="w-full lg:w-2/3 fade-in">
              {/* Banner */}
              <div className="relative h-64 md:h-80 rounded-lg overflow-hidden mb-8 glow-effect border border-gold/20">
                <Image
                  src={tournament.image || "/placeholder.svg"}
                  alt={tournament.title}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <Badge className="bg-gold text-black hover:bg-gold/90 font-cinzel mb-3">{tournament.tag}</Badge>
                  <h1 className="text-3xl md:text-4xl font-bold text-white font-cinzel">{tournament.title}</h1>
                  <p className="text-gray-300 mt-2 text-sm md:text-base">{tournament.by}</p>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-black/50 border border-gold/20 p-1 rounded-lg w-full justify-start mb-6">
                  <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-6 py-2 rounded-md transition-all duration-300"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="rules"
                    className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-6 py-2 rounded-md transition-all duration-300"
                  >
                    Rules
                  </TabsTrigger>
                  <TabsTrigger
                    value="prizes"
                    className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-6 py-2 rounded-md transition-all duration-300"
                  >
                    Prizes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-0">
                  <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4 font-cinzel">ABOUT THE TOURNAMENT</h2>
                    <p className="text-gray-300 mb-6">
                      {tournament.description ||
                        `${tournament.title} is run on Valiant League — ${tournament.by.toLowerCase()}. Live player auctions, automatic brackets, and stream-ready broadcast overlays, all from one console.`}
                    </p>
                    <ul className="text-gray-300 space-y-2">
                      <li>• Live auction room with enforced purses and a real shot clock</li>
                      <li>• Automatic bracket generation as results come in</li>
                      <li>• Broadcast overlay layer ready for OBS or any streaming setup</li>
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="rules" className="mt-0">
                  <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4 font-cinzel">FORMAT & RULES</h2>
                    <p className="text-gray-300 mb-4">
                      <span className="text-gold font-semibold">Format: </span>
                      {tournament.format || "Format to be announced by the organizer."}
                    </p>
                    {tournament.rules && tournament.rules.length > 0 ? (
                      <ul className="text-gray-300 space-y-2">
                        {tournament.rules.map((rule, i) => (
                          <li key={i}>• {rule}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-sm">
                        Detailed rules haven't been published yet — check back closer to the start date.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="prizes" className="mt-0">
                  <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4 font-cinzel">PRIZE POOL</h2>
                    {tournament.prizePool && (
                      <p className="text-gray-300 mb-4">
                        <span className="text-gold font-semibold">Total: </span>
                        {tournament.prizePool}
                      </p>
                    )}
                    {tournament.prizes && tournament.prizes.length > 0 ? (
                      <div className="space-y-3">
                        {tournament.prizes.map((p) => (
                          <div
                            key={p.place}
                            className="flex items-center justify-between border-b border-gold/10 pb-2"
                          >
                            <span className="text-white font-semibold">{p.place}</span>
                            <span className="text-gray-300">{p.reward}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">Prize breakdown to be announced.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-1/3 fade-in-up">
              <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4 font-cinzel">Tournament Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-4 w-4 text-gold" />
                    <div>
                      <p className="text-gray-400 text-sm">Organizer</p>
                      <p className="text-white font-semibold">{tournament.by}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-gold" />
                    <div>
                      <p className="text-gray-400 text-sm">Category</p>
                      <p className="text-white font-semibold">{tournament.tag}</p>
                    </div>
                  </div>
                  {tournament.startDate && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gold" />
                      <div>
                        <p className="text-gray-400 text-sm">Start Date</p>
                        <p className="text-white font-semibold">{tournament.startDate}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Status</p>
                    <Badge className={statusColor}>{status}</Badge>
                  </div>
                </div>
              </div>

              {(tournament.website || tournament.twitter || tournament.discord) && (
                <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                  <h3 className="text-xl font-bold text-white mb-4 font-cinzel">Social Links</h3>
                  <div className="space-y-3">
                    {tournament.website && (
                      <Link
                        href={tournament.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-300 hover:text-gold transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                        <span>Official Website</span>
                      </Link>
                    )}
                    {tournament.twitter && (
                      <Link
                        href={tournament.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-300 hover:text-gold transition-colors"
                      >
                        <Twitter className="h-4 w-4" />
                        <span>Twitter</span>
                      </Link>
                    )}
                    {tournament.discord && (
                      <Link
                        href={tournament.discord}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-300 hover:text-gold transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Discord</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4 font-cinzel">Run Your Own</h3>
                <p className="text-gray-300 mb-4 text-sm">
                  Want your league running on Valiant League too? Start free with one live auction and bracket.
                </p>
                <Button className="w-full bg-gold hover:bg-gold/90 text-black font-bold">
                  <Link href="/#tiers" className="flex items-center justify-center gap-2 w-full">
                    Get Started
                  </Link>
                </Button>
              </div>

              <RelatedTournaments currentSlug={slug} currentTag={tournament.tag} />
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/tournament">
              <Button className="bg-gold hover:bg-gold/90 text-black font-bold">Back to Tournaments</Button>
            </Link>
          </div>
        </div>
      </section>

      <SectionDivider />
      <SiteFooter scrollToSection={scrollToSection} handleNavigation={handleNavigation} />
    </main>
  )
}