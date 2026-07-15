"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import { TypeText } from "@/components/landing/type-text"
import { useScrollTop } from "@/hooks/use-scroll-top"
import SectionDivider from "@/components/section-divider"
import { pageStyles, showcaseSlides, slugify, type ShowcaseSlide } from "@/data/site-data"

export default function TournamentClient() {
  useScrollTop()

  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isNavOpen, setIsNavOpen] = useState(false)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const q = searchQuery.toLowerCase()

  const filteredTournaments: ShowcaseSlide[] = showcaseSlides.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.by.toLowerCase().includes(q) ||
      t.tag.toLowerCase().includes(q)
  )

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

      {/* ═══════════════════════════════════════════════════════════
          HEADER — same section-pattern + section-gradient treatment
          as every section in HomeContent, typewriter title
      ═══════════════════════════════════════════════════════════ */}
      <section className="pt-32 sm:pt-40 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="Valiant League " speed={45} />
              <TypeText text="Tournaments" speed={45} delay={280} className="text-gold" />
            </h1>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              Real leagues run on Valiant League — from live auctions to broadcast finals.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto mt-8 fade-in-up">
              <Input
                type="text"
                placeholder="Search tournaments..."
                className="bg-black/50 border-gold/30 text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button className="bg-gold hover:bg-gold/90 text-black font-bold">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          GRID — same card anatomy as the Showcase section on Home,
          but with the real image instead of the placeholder block
      ═══════════════════════════════════════════════════════════ */}
      <section className="pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            {filteredTournaments.map((t, i) => (
              <Link
                key={t.title}
                href={`/tournament/${slugify(t.title)}`}
                className={`block rounded-lg overflow-hidden glow-effect border border-gold/20 bg-black/70 fade-in-up stagger-${
                  (i % 6) + 1
                } hover:border-gold/80 transition-all duration-300 cursor-pointer`}
              >
                <div className="relative h-40 md:h-48 border-b border-gold/20">
                  <Image
                    src={t.image || "/placeholder.svg"}
                    alt={`Tournament: ${t.title}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-gold text-black text-[10px] font-bold px-2.5 py-1 rounded font-cinzel tracking-wide">
                      {t.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white font-cinzel mb-1">{t.title}</h3>
                  <p className="text-gray-300 text-xs">{t.by}</p>
                </div>
              </Link>
            ))}
          </div>

          {filteredTournaments.length === 0 && (
            <p className="text-center text-gray-400 mt-12 fade-in">
              No tournaments match your search.
            </p>
          )}

          <div className="text-center mt-12 fade-in-up stagger-5">
            <span className="font-mono text-xs text-gray-400 tracking-widest">
              SHOWING {filteredTournaments.length} OF {showcaseSlides.length} LEAGUES
            </span>
          </div>
        </div>
      </section>

      <SectionDivider />

      <SiteFooter scrollToSection={scrollToSection} handleNavigation={handleNavigation} />
    </main>
  )
}