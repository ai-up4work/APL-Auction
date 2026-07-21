"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gavel,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  MonitorPlay,
  Plus,
  Quote,
  Shield,
  Trophy,
  Twitter,
  X as XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TypeText } from "@/components/landing/type-text"
import {
  CellValue,
  comparisonColumns,
  comparisonRows,
  faqs,
  moduleData,
  showcaseSlides,
  slugify,
  stats,
  testimonials,
  trustedClubs,
  knights,
} from "@/data/site-data"

const moduleIcons = { gavel: Gavel, trophy: Trophy, monitor: MonitorPlay } as const

function ComparisonCell({ value }: { value: CellValue }) {
  if (value === true) return <Check className="h-4 w-4 text-gold mx-auto" />
  if (value === false) return <XIcon className="h-4 w-4 text-gray-400 mx-auto" />
  return <Minus className="h-4 w-4 text-gray-400 mx-auto" />
}

interface HomeContentProps {
  scrollToSection: (sectionId: string) => void
  handleNavigation: (path: string) => void
}

export function HomeContent({ scrollToSection, handleNavigation }: HomeContentProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  useEffect(() => setIsLoaded(true), [])

  // ---- FAQ accordion ----
  const [openFaq, setOpenFaq] = useState<number | null>(100)

  // ---- showcase grid paging (3 cards per page) ----
  const [showcasePage, setShowcasePage] = useState(0)
  const showcasePageSize = 3
  const showcaseTotalPages = Math.ceil(showcaseSlides.length / showcasePageSize)
  const showcaseVisible = showcaseSlides.slice(
    showcasePage * showcasePageSize,
    showcasePage * showcasePageSize + showcasePageSize
  )
  const showcasePrev = () => setShowcasePage((p) => (p === 0 ? showcaseTotalPages - 1 : p - 1))
  const showcaseNext = () => setShowcasePage((p) => (p === showcaseTotalPages - 1 ? 0 : p + 1))

  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.8])

  // ---- trusted clubs marquee: auto color-in as each logo passes center ----
  const marqueeRef = useRef<HTMLDivElement>(null)
  const logoRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let frameId: number

    const update = () => {
      const container = marqueeRef.current
      if (container) {
        const containerRect = container.getBoundingClientRect()
        const centerX = containerRect.left + containerRect.width / 2

        logoRefs.current.forEach((el) => {
          if (!el) return
          const rect = el.getBoundingClientRect()
          const logoCenterX = rect.left + rect.width / 2
          const distance = Math.abs(logoCenterX - centerX)

          // distance (px) where color is fully "on" vs fully "off"
          const fullColorRange = containerRect.width * 0.12
          const fullGrayRange = containerRect.width * 0.4

          let t = (distance - fullColorRange) / (fullGrayRange - fullColorRange)
          t = Math.min(1, Math.max(0, t))

          const grayscale = t * 100
          const logoOpacity = 1 - t * 0.1 // fully in color -> 1, fully out -> 0.6

          el.style.filter = `grayscale(${grayscale}%)`
          el.style.opacity = String(logoOpacity)
        })
      }
      frameId = requestAnimationFrame(update)
    }

    frameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <>
      {/* Hero */}
      <section
        id="home"
        className="relative h-screen min-h-[560px] flex items-center justify-center overflow-hidden"
        ref={heroRef}
      >
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/website-background.png"
            alt="Valiant League background"
            fill
            priority
            className="object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 z-0 hero-gradient" />

        <motion.div
          style={{ opacity, scale }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.8 }}
          className="container mx-auto px-4 z-10 pt-20"
        >
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <div className="relative w-[18rem] h-[20rem] sm:w-[20rem] sm:h-[22rem] md:w-[18rem] md:h-[19rem] lg:w-[20rem] lg:h-[21rem] mb-4 md:mb-6 floating">
              <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" priority />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-3 md:mb-6 font-cinzel tracking-wider">
              VALIANT <span className="gold-gradient-text">LEAGUE</span>
            </h1>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
              <Button
                className="bg-gold hover:bg-gold/90 text-black font-bold py-4 md:py-6 px-6 md:px-8 rounded-md text-base md:text-lg animate-slow-pulse hover:scale-105 transition-all duration-500"
                onClick={() => scrollToSection("")}
              >
                Explore the Platform
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="border-gold text-gold hover:bg-gold/10 py-4 md:py-6 px-6 md:px-8 rounded-md text-base md:text-lg animate-slow-pulse hover:scale-105 transition-all duration-500 bg-transparent"
                onClick={() => handleNavigation("/auth/login")}
              >
                <Shield className="mr-2 h-5 w-5" />
                Open the Console
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TRUSTED BY — logo marquee, auto color-in near center
      ═══════════════════════════════════════════════════════════ */}
      <section className="py-10 md:py-14 relative bg-black border-y border-gold/10">
        <div className="container mx-auto px-4 text-center mb-6 fade-in">
          <span className="font-cinzel text-xs md:text-sm tracking-[3px] text-gray-300">
            TRUSTED BY CLUBS LIKE
          </span>
        </div>
        <div className="relative w-full overflow-hidden marquee-mask" ref={marqueeRef}>
          <div className="flex items-center gap-16 md:gap-24 w-max marquee-track">
            {[...trustedClubs, ...trustedClubs, ...trustedClubs, ...trustedClubs, ...trustedClubs, ...trustedClubs].map((club, i) => (
              <div
                key={`${club.name || "club"}-${i}`}
                ref={(el) => {
                  logoRefs.current[i] = el
                }}
                className="flex-shrink-0 w-24 md:w-32 flex items-center justify-center transition-[filter,opacity] duration-150 ease-linear"
              >
                <img
                  src={club.logo}
                  alt={`${club.name} logo`}
                  className="w-full h-auto object-contain"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          MODULES — icon block + description + tag chip
      ═══════════════════════════════════════════════════════════ */}
      <section id="modules" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="Core " speed={45} />
              <TypeText text="Modules" speed={45} delay={280} className="text-gold" />
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              Three tools, one login. Each one runs its own live data in real time — bids,
              brackets, and scores update instantly for everyone watching that module.
            </p>
          </div>

          <div className="flex flex-col md:flex-row w-full gap-[2px] max-w-5xl mx-auto rounded-lg overflow-hidden">
            {moduleData.map((mod, index) => {
              const Icon = moduleIcons[mod.iconKey]
              return (
                <div
                  key={mod.badge}
                  className={`flex flex-col gap-5 p-8 md:p-10 md:flex-1 md:h-[380px] bg-black/70 box-hover-effect fade-in-up stagger-${index + 1}`}
                  style={{ borderColor: `${mod.accent}55` }}
                >
                  <div
                    className="w-12 h-12 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${mod.accent}1A`, border: `1px solid ${mod.accent}` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: mod.accent }} />
                  </div>
                  <h3 className="text-xl font-bold text-white font-cinzel leading-tight whitespace-pre-line">
                    {mod.title}
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{mod.description}</p>
                  <div
                    className="mt-auto flex items-center justify-center h-7 px-3 border rounded w-fit"
                    style={{
                      borderColor: mod.accent,
                      backgroundColor: "rgba(0,0,0,0.4)",
                    }}
                  >
                    <a
                      href={mod.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono tracking-[2px]"
                      style={{ color: mod.accent }}
                    >
                      {mod.badge}
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          STATS — gold numbers on black, dividers between
      ═══════════════════════════════════════════════════════════ */}
      <section className="py-16 relative section-pattern bg-black">
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 max-w-5xl mx-auto">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center text-center px-4 fade-in-up stagger-${index + 1} ${
                  index < 3 ? "md:border-r md:border-gold/20" : ""
                }`}
              >
                <span className="font-cinzel text-4xl md:text-5xl font-bold gold-gradient-text mb-2">{stat.value}</span>
                <span className="text-gray-300 text-xs md:text-sm tracking-widest uppercase">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Creators */}
      {/* <section id="creators" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="Knights of " speed={40} />
              <TypeText text="Valiant League" speed={40} delay={400} className="text-gold" />
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              The people building Valiant League — swap these placeholder profiles for your real team before launch.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {knights.map((k, index) => (
              <div key={k.name} className={`rounded-lg overflow-hidden creator-card fade-in-up stagger-${index + 1} bg-black/70`}>
                <div className="relative h-64 bg-[#0d0d0d]">
                  <Image src={k.image} alt={k.name} fill className="object-cover" />
                </div>
                <div className="p-6 border-t border-gold/20 text-center">
                  <h3 className="text-xl font-bold text-white font-cinzel">{k.name}</h3>
                  <p className="text-gray-300 text-sm mb-4">{k.role}</p>
                  <Link
                    href={k.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gold/10 hover:bg-gold/20 transition-colors"
                  >
                    <Twitter className="h-4 w-4 text-gold" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* ═══════════════════════════════════════════════════════════
      HOW IT WORKS — the Auction → Bracket → Overlay pipeline
      ═══════════════════════════════════════════════════════════ */}
      {/* <section id="how-it-works" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="How It " speed={45} />
              <TypeText text="Works" speed={45} delay={200} className="text-gold" />
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              One flow, three stages — from drafting teams to broadcasting the final.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                title: "Draft Your Teams",
                desc: "Run a live, points-based auction. Owners bid from their phones, purses are enforced automatically, and squads are built in real time.",
                accent: "#F5A623",
              },
              {
                step: "02",
                title: "Build the Bracket",
                desc: "Generate a single or double-elimination tournament from the teams you just drafted. Results advance winners automatically.",
                accent: "#CD7F32",
              },
              {
                step: "03",
                title: "Go Live",
                desc: "Score matches ball-by-ball with automatic milestone detection, and broadcast a stream-ready overlay straight into OBS.",
                accent: "#C0C0C0",
              },
            ].map((s, i) => (
              <div key={s.step} className={`rounded-lg border border-gold/20 bg-black/70 p-8 box-hover-effect fade-in-up stagger-${i + 1}`}>
                <span className="font-cinzel text-4xl font-bold" style={{ color: s.accent }}>
                  {s.step}
                </span>
                <h3 className="text-xl font-bold text-white font-cinzel mt-4 mb-3">{s.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* ═══════════════════════════════════════════════════════════
      FEATURED TOURNAMENTS — small teaser, full list lives on /tournament
      ═══════════════════════════════════════════════════════════ */}
      <section id="tournaments" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="Featured " speed={45} />
              <TypeText text="Tournaments" speed={45} delay={280} className="text-gold" />
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              A look at leagues run on Valiant League — from live auctions to broadcast finals.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            {showcaseSlides.filter((slide) => slide.featured).slice(0, 3).map((t, i) => (
              <Link
                key={t.title}
                href={`/tournament/${slugify(t.title)}`}
                className={`block rounded-lg overflow-hidden glow-effect border border-gold/20 bg-black/70 fade-in-up stagger-${i + 1} hover:border-gold/80 transition-all duration-300`}
              >
                <div className="relative h-40 md:h-48 border-b border-gold/20">
                  <Image src={t.image || "/placeholder.svg"} alt={`Tournament: ${t.title}`} fill className="object-cover" />
                </div>
                <div className="p-5 md:p-6">
                  <span className="bg-gold text-black text-[10px] font-bold px-2.5 py-1 rounded font-cinzel tracking-wide">
                    {t.tag}
                  </span>
                  <h3 className="text-lg font-bold text-white font-cinzel mt-3 mb-1">{t.title}</h3>
                  <p className="text-gray-300 text-xs">{t.by}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10 fade-in-up stagger-4">
            <Button
              variant="outline"
              className="border-gold text-gold hover:bg-gold/10"
              onClick={() => handleNavigation("/tournament")}
            >
              View All Tournaments
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════════════════════════ */}
      <section id="testimonials" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="What " speed={45} />
              <TypeText text="Owners Say" speed={45} delay={220} className="text-gold" />
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              Real leagues, run live, by people who used to run them from a spreadsheet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((t, index) => (
              <Card
                key={t.name}
                className={`bg-black/50 border border-gold/20 shine hover:border-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-gold/20 fade-in-up stagger-${index + 1}`}
              >
                <CardContent className="p-6 flex flex-col h-full">
                  <Quote className="h-6 w-6 text-gold/60 mb-4" />
                  <p className="text-gray-300 text-sm leading-relaxed flex-1">{t.quote}</p>
                  <div className="mt-6 pt-4 border-t border-gold/10">
                    <p className="font-cinzel font-bold text-white">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          COMPARISON — Valiant League vs. running it by hand
      ═══════════════════════════════════════════════════════════ */}
      <section id="compare" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="Why " speed={45} />
              <TypeText text="Valiant League" speed={45} delay={200} className="text-gold" />
              <TypeText text=" Wins" speed={45} delay={800} />
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              See how it stacks up against running your league by hand. No spin, just what each option actually
              does on match day.
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block max-w-5xl mx-auto rounded-lg overflow-hidden border border-gold/20 fade-in-up stagger-2">
            <div className="grid grid-cols-4 bg-black/90 border-b border-gold/30">
              <div className="p-4">
                <span className="font-cinzel text-sm text-gray-300 tracking-widest">FEATURE</span>
              </div>
              <div className="p-4 bg-gold/10 border-x border-gold/20 text-center">
                <span className="font-cinzel text-sm font-bold text-gold tracking-widest">VALIANT LEAGUE</span>
              </div>
              {comparisonColumns.map((col) => (
                <div key={col.key} className="p-4 text-center">
                  <span className="font-cinzel text-sm text-gray-300 tracking-widest">{col.label.toUpperCase()}</span>
                </div>
              ))}
            </div>
            {comparisonRows.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-4 ${i % 2 === 0 ? "bg-black/60" : "bg-black/40"} ${
                  i < comparisonRows.length - 1 ? "border-b border-gold/10" : ""
                }`}
              >
                <div className="p-4 flex items-center">
                  <span className="text-gray-300 text-sm">{row.feature}</span>
                </div>
                <div className="p-4 flex items-center justify-center bg-gold/5 border-x border-gold/10">
                  <ComparisonCell value={row.vl} />
                </div>
                <div className="p-4 flex items-center justify-center">
                  <ComparisonCell value={row.sheet} />
                </div>
                <div className="p-4 flex items-center justify-center">
                  <ComparisonCell value={row.discord} />
                </div>
              </div>
            ))}
          </div>

          {/* Mobile stacked cards */}
          <div className="md:hidden flex flex-col gap-4 max-w-md mx-auto">
            {comparisonRows.map((row, i) => (
              <div key={row.feature} className={`rounded-lg border border-gold/20 bg-black/60 p-4 fade-in-up stagger-${(i % 6) + 1}`}>
                <p className="text-white font-cinzel text-sm mb-3">{row.feature}</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <ComparisonCell value={row.vl} />
                    <span className="text-[9px] text-gray-400 tracking-wide">VL</span>
                  </div>
                  {comparisonColumns.map((col) => (
                    <div key={col.key} className="flex flex-col items-center gap-1">
                      <ComparisonCell value={row[col.key]} />
                      <span className="text-[9px] text-gray-400 tracking-wide">{col.label.split(" ")[0].toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SHOWCASE — 3-up grid, paged
      ═══════════════════════════════════════════════════════════ */}
      <section id="showcase" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16 fade-in max-w-6xl mx-auto">
            <div className="text-center md:text-left">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 md:mb-2 section-title inline-block">
                <TypeText text="Run on " speed={45} />
                <TypeText text="Valiant League" speed={45} delay={280} className="text-gold" />
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mt-4">
                A look at leagues that have gone through the auction room and out the other side with a trophy.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={showcasePrev}
                aria-label="Previous"
                className="h-11 w-11 rounded-full border border-gold/40 flex items-center justify-center text-gold hover:bg-gold/10 hover:border-gold transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={showcaseNext}
                aria-label="Next"
                className="h-11 w-11 rounded-full bg-gold flex items-center justify-center text-black hover:bg-gold/90 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            {showcaseVisible.map((s, i) => (
              <div key={s.title} className={`rounded-lg overflow-hidden glow-effect border border-gold/20 bg-black/70 fade-in-up stagger-${i + 1}`}>
                <div className="h-40 md:h-48 bg-[#0d0d0d] flex items-center justify-center border-b border-gold/20">
                  <span className="font-mono text-[10px] text-gray-400 tracking-[2px]">[ SCREENSHOT PLACEHOLDER ]</span>
                </div>
                <div className="p-5 md:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-gold text-black text-[10px] font-bold px-2.5 py-1 rounded font-cinzel tracking-wide">
                      {s.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white font-cinzel mb-1">{s.title}</h3>
                  <p className="text-gray-300 text-xs">{s.by}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4 mt-10">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: showcaseTotalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setShowcasePage(i)}
                  aria-label={`Go to page ${i + 1}`}
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: i === showcasePage ? "28px" : "8px",
                    backgroundColor: i === showcasePage ? "#f5a623" : "rgba(245,166,35,0.25)",
                  }}
                />
              ))}
            </div>
            <span className="font-mono text-xs text-gray-400 tracking-widest">
              SHOWING {showcasePage * showcasePageSize + 1}–
              {Math.min(showcasePage * showcasePageSize + showcasePageSize, showcaseSlides.length)} OF {showcaseSlides.length} LEAGUES
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FAQ — two-column on desktop, numbered accent, gold divider
      ═══════════════════════════════════════════════════════════ */}
      <section id="faq" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="Got " speed={45} />
              <TypeText text="Questions?" speed={45} delay={200} className="text-gold" />
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">Everything you need to know before your first auction.</p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <div
                  key={faq.question}
                  className={`group rounded-lg border bg-black/50 overflow-hidden transition-all duration-300 fade-in-up stagger-${(i % 6) + 1} ${
                    isOpen ? "border-gold/70 shadow-[0_0_20px_rgba(245,166,35,0.15)]" : "border-gold/20 hover:border-gold/40"
                  }`}
                >
                  <button onClick={() => setOpenFaq(isOpen ? null : i)} className="w-full flex items-start gap-4 p-5 md:p-6 text-left">
                    <span
                      className={`font-cinzel text-xs font-bold shrink-0 mt-1 transition-colors duration-300 ${
                        isOpen ? "text-gold" : "text-gold/40 group-hover:text-gold/70"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <span className="flex-1 font-cinzel text-base md:text-lg font-bold text-white leading-snug">{faq.question}</span>

                    <div
                      className={`faq-icon h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        isOpen ? "bg-gold" : "bg-gold/10 border border-gold/40"
                      }`}
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      {isOpen ? <Minus className="h-4 w-4 text-black" /> : <Plus className="h-4 w-4 text-gold" />}
                    </div>
                  </button>

                  <div className="grid transition-all duration-300 ease-in-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      <div className="px-5 md:px-6 pb-5 md:pb-6 pl-[3.25rem] md:pl-[3.5rem]">
                        <div className="h-px w-full bg-gold/10 mb-4" />
                        <p className="text-gray-300 text-sm leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-center mt-12 fade-in">
            <p className="text-gray-300">
              Still have questions?{" "}
              <button onClick={() => scrollToSection("contact")} className="text-gold hover:underline font-medium">
                Talk to a human →
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section id="tiers" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="Choose Your " speed={40} />
              <TypeText text="League Size" speed={40} delay={480} className="text-gold" />
            </h2>
            <p className="text-gray-300 max-w-3xl mx-auto mt-4">
              Every tier gets all three modules. What changes is scale and support, not which tools you're allowed
              to use.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Casual */}
            <div className="bg-gradient-to-b from-[#cd7f32]/30 to-black border-2 border-[#cd7f32] rounded-lg overflow-hidden shadow-[0_0_15px_5px_rgba(205,127,50,0.3)] hover:shadow-[0_0_25px_8px_rgba(205,127,50,0.5)] transition-all duration-300 transform hover:scale-[1.02] fade-in-up stagger-1">
              <div className="bg-[#cd7f32] p-4 text-center">
                <h3 className="text-2xl font-bold text-black">CASUAL</h3>
                <p className="text-lg font-bold text-black mt-2">Free to run</p>
              </div>
              <div className="p-6">
                <ul className="space-y-2">
                  {["One live auction at a time", "Single-elimination bracket", "Broadcast overlay page"].map((f, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#cd7f32] mr-2 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button className="w-full bg-[#cd7f32] hover:bg-[#cd7f32]/80 text-black font-bold pulse" onClick={() => handleNavigation("/admin")}>
                    Get Started
                  </Button>
                </div>
              </div>
            </div>

            {/* Club */}
            <div className="bg-gradient-to-b from-[#C0C0C0]/30 to-black border-2 border-[#C0C0C0] rounded-lg overflow-hidden shadow-[0_0_15px_5px_rgba(192,192,192,0.3)] hover:shadow-[0_0_25px_8px_rgba(192,192,192,0.5)] transition-all duration-300 transform hover:scale-[1.02] scale-105 fade-in-up stagger-2">
              <div className="bg-[#C0C0C0] p-4 text-center">
                <h3 className="text-2xl font-bold text-black">CLUB</h3>
                <p className="text-lg font-bold text-black mt-2">Contact for pricing</p>
              </div>
              <div className="p-6">
                <ul className="space-y-2">
                  {[
                    "Everything in Casual",
                    "Unlimited concurrent auctions",
                    "Double-elimination brackets",
                    "Unsold-player re-entry rounds",
                  ].map((f, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#C0C0C0] mr-2 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button className="w-full bg-[#C0C0C0] hover:bg-[#C0C0C0]/80 text-black font-bold pulse" onClick={() => scrollToSection("contact")}>
                    Get Started
                  </Button>
                </div>
              </div>
            </div>

            {/* Franchise */}
            <div className="bg-gradient-to-b from-gold/30 to-black border-2 border-gold rounded-lg overflow-hidden shadow-[0_0_15px_5px_rgba(245,166,35,0.3)] hover:shadow-[0_0_25px_8px_rgba(245,166,35,0.5)] transition-all duration-300 transform hover:scale-[1.02] fade-in-up stagger-3">
              <div className="bg-gold p-4 text-center">
                <h3 className="text-2xl font-bold text-black">FRANCHISE</h3>
                <p className="text-lg font-bold text-black mt-2">Contact for pricing</p>
              </div>
              <div className="p-6">
                <ul className="space-y-2">
                  {[
                    "Everything in Club",
                    "Custom overlay branding",
                    "Priority support on match day",
                    "Multi-tournament season tracking",
                  ].map((f, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-gold mr-2 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button className="w-full bg-gold hover:bg-gold/80 text-black font-bold pulse" onClick={() => scrollToSection("contact")}>
                    Get Started
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CONTACT — two-column on desktop: form/channels card + quick-info card
      ═══════════════════════════════════════════════════════════ */}
      <section id="contact" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 bg-black/90" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="Contact " speed={45} />
              <TypeText text="Valiant League" speed={45} delay={280} className="text-gold" />
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              Questions about running your league, a Club or Franchise plan, or a walkthrough before match day —
              reach out any time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 max-w-5xl mx-auto">
            {/* Main channels card */}
            <div className="md:col-span-3 fade-in">
              <Card className="bg-black/50 border border-gold/20 shine hover:border-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-gold/20 h-full">
                <CardContent className="p-6 md:p-8">
                  <h3 className="text-2xl font-bold text-white mb-6 font-cinzel">
                    Get in <span className="text-gold">Touch</span>
                  </h3>
                  <p className="text-gray-300 mb-8">
                    Have questions about our modules or interested in a Club or Franchise plan? Reach out through
                    any of the channels below.
                  </p>

                  <div className="space-y-6">
                    <div className="flex items-start">
                      <Link
                        href="mailto:hello@valiantleague.app"
                        className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center mr-4 hover:bg-gold/20 transition-colors shrink-0"
                      >
                        <Mail className="h-6 w-6 text-gold" />
                      </Link>
                      <div>
                        <h4 className="text-xl font-bold text-white mb-1">Email Us</h4>
                        <p className="text-gray-300">
                          hello@valiantleague.app <span className="text-gray-400">— placeholder, swap for your address</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Link
                        href="/admin"
                        className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center mr-4 hover:bg-gold/20 transition-colors shrink-0"
                      >
                        <Gavel className="h-6 w-6 text-gold" />
                      </Link>
                      <div>
                        <h4 className="text-xl font-bold text-white mb-1">Book a Walkthrough</h4>
                        <p className="text-gray-300">[Link to your scheduling page]</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Link
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center mr-4 hover:bg-gold/20 transition-colors shrink-0"
                      >
                        <Twitter className="h-6 w-6 text-gold" />
                      </Link>
                      <div>
                        <h4 className="text-xl font-bold text-white mb-1">Follow Us</h4>
                        <p className="text-gray-300">[@yourhandle]</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick info card */}
            <div className="md:col-span-2 fade-in-up stagger-2">
              <Card className="bg-black/50 border border-gold/20 h-full">
                <CardContent className="p-6 md:p-8 flex flex-col h-full">
                  <h3 className="text-xl font-bold text-white mb-6 font-cinzel">
                    Quick <span className="text-gold">Info</span>
                  </h3>

                  <div className="space-y-6 flex-1">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                        <Clock className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-white font-cinzel font-bold text-sm mb-1">Response Time</p>
                        <p className="text-gray-300 text-sm">Usually within 24 hours on business days.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                        <MessageCircle className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-white font-cinzel font-bold text-sm mb-1">Best For Quick Questions</p>
                        <p className="text-gray-300 text-sm">
                          Check the{" "}
                          <button onClick={() => scrollToSection("faq")} className="text-gold hover:underline">
                            FAQ
                          </button>{" "}
                          first — most match-day questions are answered there.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-white font-cinzel font-bold text-sm mb-1">Based Remote</p>
                        <p className="text-gray-300 text-sm">Fully online — leagues run from anywhere, no local office required.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gold/10">
                    <Button
                      variant="outline"
                      className="w-full border-gold/50 text-gold hover:bg-gold/10 hover:border-gold bg-transparent"
                      onClick={() => scrollToSection("tiers")}
                    >
                      View Pricing Tiers
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="text-center mt-12 fade-in-up stagger-4">
            <Button
              className="pulse inline-flex items-center bg-gold hover:bg-gold/90 text-black font-bold py-6 px-8 rounded-md text-lg"
              onClick={() => handleNavigation("/admin")}
            >
              Start Your League
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}