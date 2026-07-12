"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, useScroll, useTransform } from "framer-motion"
import {
  ArrowRight,
  Shield,
  Gavel,
  Trophy,
  MonitorPlay,
  Users,
  ShieldCheck,
  Shuffle,
  Layers,
  Check,
  Mail,
  Twitter,
  Menu,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────────────────────
   HARDCODED STYLE SHEET — mirrors globals.css + the font setup from
   layout.tsx, inlined so the page is self-contained. Same weights as your
   reference project (Cinzel 400–900, Inter 400–700). Real brand gold: #f5a623.
──────────────────────────────────────────────────────────────────────── */
const pageStyles = `
@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap");

:root { --gold: #f5a623; }

html { scroll-behavior: smooth; }
body {
  background-color: #000;
  color: #E5E5E5;
  width: 100vw;
  overflow-x: hidden;
  font-family: "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, h4, h5, h6 { font-family: "Cinzel", serif; }
.font-cinzel { font-family: "Cinzel", serif; }

.text-gold { color: var(--gold); }
.bg-gold { background-color: var(--gold); }
.border-gold { border-color: var(--gold); }

/* ── gold text shimmer ── */
.gold-gradient-text {
  background: linear-gradient(to right, #f5a623, #f8d57e, #f5a623);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: goldShimmer 2.4s infinite;
}
@keyframes goldShimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* ── hero overlay — sits directly on the hero's own bg image ── */
.hero-gradient { background: linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.55), rgba(0,0,0,0.85)); }
.section-gradient { background: linear-gradient(to bottom, rgba(0,0,0,0.95), rgba(0,0,0,0.85), rgba(0,0,0,0.95)); }

/* ── subtle dot texture ── */
.section-pattern { position: relative; }
.section-pattern::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(245,166,35,0.05) 2px, transparent 2px);
  background-size: 30px 30px;
  pointer-events: none;
}

/* ── card hover lift + glow ── */
.glow-effect { box-shadow: 0 0 15px rgba(245,166,35,0.25); transition: box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease; }
.glow-effect:hover { box-shadow: 0 0 25px rgba(245,166,35,0.55); transform: translateY(-5px); border-color: rgba(245,166,35,0.8); }

.box-hover-effect { transition: all 0.3s ease; border: 1px solid rgba(245,166,35,0.2); }
.box-hover-effect:hover { border-color: rgba(245,166,35,0.8); box-shadow: 0 0 15px rgba(245,166,35,0.3); transform: translateY(-5px); }

/* ── creator card ── */
.creator-card { transition: all 0.3s ease; border: 1px solid rgba(245,166,35,0.15); }
.creator-card:hover { border-color: rgba(245,166,35,0.8); box-shadow: 0 0 20px rgba(245,166,35,0.35); transform: translateY(-6px); }

/* ── diamond-capped divider ── */
.medieval-divider { position: relative; height: 2px; background-color: rgba(245,166,35,0.5); }
.medieval-divider::before, .medieval-divider::after {
  content: ""; position: absolute; width: 10px; height: 10px;
  background-color: var(--gold); top: -4px; transform: rotate(45deg);
}
.medieval-divider::before { left: 0; }
.medieval-divider::after { right: 0; }

/* ── section title with animated shine underline ── */
.section-title { position: relative; }
.section-title::after {
  content: "";
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 3px;
  background: linear-gradient(90deg, transparent, #f5a623, #f8d57e, #f5a623, transparent);
  background-size: 200% 100%;
  animation: goldShine 4s linear infinite;
}
@keyframes goldShine { 0% { background-position: -100% 0; } 100% { background-position: 200% 0; } }

/* ── shine sweep, for the contact card ── */
.shine { position: relative; overflow: hidden; }
.shine::after {
  content: "";
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%);
  transform: rotate(30deg);
  animation: shine 6s infinite;
}
@keyframes shine { 0% { transform: rotate(30deg) translateX(-100%); } 20%, 100% { transform: rotate(30deg) translateX(100%); } }

/* ── gentle bob, for the hero crest ── */
.floating { animation: floating 3s ease-in-out infinite; }
@keyframes floating { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }

/* ── two flavors of pulse: opacity (primary CTAs) vs scale (secondary) ── */
@keyframes slow-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
.animate-slow-pulse { animation: slow-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite; }
.animate-slow-pulse:hover { animation: none; }

@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
.pulse { animation: pulse 2s infinite; }
.pulse:hover { animation: none; }

/* ── fade-in family ── */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.fade-in { opacity: 0; animation: fadeIn 0.8s ease-in-out forwards; }
.fade-in-up { opacity: 0; transform: translateY(20px); animation: fadeInUp 0.8s ease-in-out forwards; }
.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
.stagger-4 { animation-delay: 0.4s; }
.stagger-5 { animation-delay: 0.5s; }
.stagger-6 { animation-delay: 0.6s; }

@media (prefers-reduced-motion: reduce) {
  .fade-in, .fade-in-up, .animate-slow-pulse, .pulse, .floating, .gold-gradient-text, .shine::after, .section-title::after {
    animation: none !important;
    opacity: 1 !important;
  }
}
`

/* ─────────────────────────────────────────────────────────────────────────
   NAV LINKS
──────────────────────────────────────────────────────────────────────── */
const navLinks = [
  { name: "HOME", id: "home" },
  { name: "MODULES", id: "modules" },
  { name: "CREATORS", id: "creators" },
  { name: "HOW IT WORKS", id: "flow" },
  { name: "PRICING", id: "tiers" },
  { name: "CONTACT", id: "contact" },
]

/* ─────────────────────────────────────────────────────────────────────────
   THE THREE MODULES
──────────────────────────────────────────────────────────────────────── */
const modules = [
  {
    tag: "Mod. 01",
    icon: Gavel,
    title: "Auction Room",
    description:
      "Live player auctions with a real shot clock, enforced purses, and a bid room every owner runs from their own phone.",
  },
  {
    tag: "Mod. 02",
    icon: Trophy,
    title: "Tournament Bracket",
    description:
      "Single or double-elimination knockouts, drawn from your teams and updated automatically as results come in.",
  },
  {
    tag: "Mod. 03",
    icon: MonitorPlay,
    title: "Broadcast Overlays",
    description:
      "A transparent, stream-ready layer — live score bar, scorecard, boundaries, weather — toggled from the console.",
  },
]

const flowSteps = [
  { icon: Users, title: "Build the roster", body: "Add teams and the player pool with base prices." },
  { icon: ShieldCheck, title: "Set the rules", body: "Purse size, squad limits, bid increments, timer." },
  { icon: Shuffle, title: "Shuffle the order", body: "Lock in a fair, random lot sequence before you go live." },
  { icon: Gavel, title: "Run the sale", body: "Owners bid live, the clock locks it, you hammer it down." },
  { icon: Layers, title: "Flip on overlays", body: "Weather, score bar and boundaries, live on the stream." },
  { icon: Trophy, title: "Draw the bracket", body: "Move straight into a knockout with the teams you built." },
]

/* ─────────────────────────────────────────────────────────────────────────
   CREATORS / TEAM
──────────────────────────────────────────────────────────────────────── */
const knights = [
  {
    id: 1,
    name: "KGlimited",
    role: "Founder",
    image: "/images/knights/knight-1.png",
    twitter: "#",
    description: "Founder of The Wardens community.",
  },
  {
    id: 2,
    name: "tri__",
    role: "Knight",
    image: "/images/knights/knight-2.png",
    twitter: "#",
    description: "Dedicated knight of The Wardens.",
  },
  {
    id: 3,
    name: "vpowerv",
    role: "Knight",
    image: "/images/knights/knight-3.png",
    twitter: "#",
    description: "Loyal knight serving The Wardens community.",
  },
  {
    id: 4,
    name: "s7uid",
    role: "Royal Guard",
    image: "/images/knights/knight-4.png",
    twitter: "#",
    description: "Elite member of the Royal Guard.",
  },
  {
    id: 5,
    name: "blitz7622",
    role: "Royal Guard",
    image: "/images/knights/knight-5.png",
    twitter: "#",
    description: "Protector of The Wardens realm.",
  },
  {
    id: 6,
    name: "zappzaddy",
    role: "Royal Guard",
    image: "/images/knights/knight-6.png",
    twitter: "#",
    description: "Trusted member of the Royal Guard.",
  },
  {
    id: 7,
    name: "sashin",
    role: "Royal Guard",
    image: "/images/knights/knight-7.png",
    twitter: "#",
    description: "Dedicated guardian of The Wardens.",
  },
  {
    id: 9,
    name: "haypon",
    role: "Royal Guard",
    image: "/images/knights/knight-9.png",
    twitter: "#",
    description: "Plans and executes gaming tournaments, AMAs, and community events.",
  },
]

const SECTIONS = navLinks.map((l) => l.id)

export default function Home() {
  const router = useRouter()

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const [isLoaded, setIsLoaded] = useState(false)
  useEffect(() => setIsLoaded(true), [])

  // ---- navbar state ----
  const [isNavOpen, setIsNavOpen] = useState(false)

  // ---- active section tracking, via IntersectionObserver ----
  // (a raw `scroll` listener reading offsetTop on every tick is what caused
  // the glitchy jumps when scrolling fast — this reports async & smooth)
  const [activeSection, setActiveSection] = useState(SECTIONS[0])
  const activeSectionRef = useRef(activeSection)
  activeSectionRef.current = activeSection

  useEffect(() => {
    const sections = SECTIONS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (sections.length === 0) return

    const ratios = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        })

        let bestId = activeSectionRef.current
        let bestRatio = 0
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        })

        if (bestRatio > 0 && bestId !== activeSectionRef.current) {
          setActiveSection(bestId)
        }
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: "-20% 0px -60% 0px",
      }
    )

    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      window.scrollTo({ top: element.offsetTop - 20, behavior: "smooth" })
      setActiveSection(sectionId)
    }
    setIsNavOpen(false)
  }

  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.8])

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      {/* ---- fixed smooth-scroll section indicator ---- */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden lg:block">
        <div className="flex flex-col items-center space-y-4">
          {SECTIONS.map((section) => (
            <button
              key={section}
              onClick={() => scrollToSection(section)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                activeSection === section
                  ? "bg-gold w-4 h-4 shadow-lg shadow-gold/30"
                  : "bg-gray-500 hover:bg-gold/50"
              }`}
              aria-label={`Scroll to ${section} section`}
            />
          ))}
          <div className="mt-2 text-gold">
            <Shield className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 w-full z-50 transition-all duration-500 bg-black/90 backdrop-blur-sm border-b border-gold/20 py-2">
        <div className="w-full max-w-[1600px] mx-auto px-4">
          {/* Desktop Layout — grid for control */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center justify-items-center">
            {/* Logo */}
            <div
              onClick={() => scrollToSection("home")}
              className="flex items-center space-x-2 z-20 justify-self-start cursor-pointer"
            >
              <div className="relative w-14 h-16 md:w-16 md:h-20">
                <Image
                  src="/valiant-league-logo.png"
                  alt="Valiant League Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              <span className="font-cinzel font-bold text-xl md:text-2xl text-white">
                VALIANT <span className="text-gold">LEAGUE</span>
              </span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center justify-center space-x-4">
              {navLinks.map((link) => (
                <Button
                  key={link.name}
                  variant={activeSection === link.id ? "default" : "outline"}
                  className={cn(
                    "font-cinzel text-base transition-all",
                    activeSection === link.id
                      ? "bg-gold hover:bg-gold/90 text-black"
                      : "border-gold/50 text-white hover:bg-gold/10 hover:text-gold hover:border-gold"
                  )}
                  onClick={() => scrollToSection(link.id)}
                >
                  {link.name}
                </Button>
              ))}
            </nav>

            {/* Right Side */}
            <div className="flex items-center justify-end space-x-4 justify-self-end">
              <div className="hidden md:flex items-center space-x-2">
                <Link href="#" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gold hover:text-gold/80"
                  >
                    <Twitter className="h-5 w-5" />
                  </Button>
                </Link>

                <Button
                  className="bg-gold hover:bg-gold/90 text-black font-bold font-cinzel"
                  onClick={() => handleNavigation("/admin")}
                >
                  Open the Console
                </Button>
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden text-white hover:text-gold z-20"
                onClick={() => setIsNavOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {isNavOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`md:hidden bg-black/95 border-t border-gold/20 fixed top-[68px] left-0 w-full z-10 transition-all duration-300 ${
            isNavOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-4 pointer-events-none"
          }`}
        >
          <div className="container mx-auto px-4 py-6">
            <nav className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <Button
                  key={link.name}
                  variant={activeSection === link.id ? "default" : "outline"}
                  className={cn(
                    "font-cinzel text-base w-full justify-start transition-all",
                    activeSection === link.id
                      ? "bg-gold hover:bg-gold/90 text-black"
                      : "border-gold/50 text-white hover:bg-gold/10 hover:text-gold hover:border-gold"
                  )}
                  onClick={() => scrollToSection(link.id)}
                >
                  {link.name}
                </Button>
              ))}

              <Button
                className="bg-gold hover:bg-gold/90 text-black font-bold font-cinzel w-full justify-start mt-2"
                onClick={() => {
                  handleNavigation("/admin")
                  setIsNavOpen(false)
                }}
              >
                Open the Console
              </Button>

              <div className="pt-4 border-t border-gold/20 flex justify-center">
                <Link
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsNavOpen(false)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gold hover:text-gold/80"
                  >
                    <Twitter className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="relative min-h-screen flex items-center justify-center pt-28" ref={heroRef}>
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
            <div className="relative w-[20rem] h-[22rem] md:w-[24rem] md:h-[26rem] mb-8 floating">
              <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" priority />
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 font-cinzel tracking-wider">
              VALIANT <span className="gold-gradient-text">LEAGUE</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
              Draft your teams in a live auction, settle the knockout on an
              automatic bracket, and put it all on screen with a
              broadcast-ready overlay — one platform, one league.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                className="bg-gold hover:bg-gold/90 text-black font-bold py-6 px-8 rounded-md text-lg animate-slow-pulse hover:scale-105 transition-all duration-500"
                onClick={() => scrollToSection("modules")}
              >
                Explore the Platform
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="border-gold text-gold hover:bg-gold/10 py-6 px-8 rounded-md text-lg animate-slow-pulse hover:scale-105 transition-all duration-500 bg-transparent"
                onClick={() => handleNavigation("/admin")}
              >
                <Shield className="mr-2 h-5 w-5" />
                Open the Console
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Modules */}
      <section id="modules" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              Core <span className="text-gold">Modules</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              Three tools, one league. Every one of them reads and writes the
              same live data, so a bid, a result, or a toggle shows up
              everywhere else instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {modules.map((mod, index) => (
              <div
                key={mod.tag}
                className={`rounded-lg overflow-hidden glow-effect fade-in-up stagger-${index + 1} border border-gold/20 cursor-pointer`}
              >
                <div className="relative h-48 bg-[#0d0d0d] flex items-center justify-center">
                  <mod.icon className="w-12 h-12 text-gold/70" />
                  <div className="absolute top-2 right-2 bg-gold text-black text-xs font-medium px-2 py-1 rounded">
                    {mod.tag}
                  </div>
                </div>
                <div className="p-6 bg-black/80 border-t border-gold/20">
                  <h3 className="text-xl font-bold text-white mb-2 font-cinzel">{mod.title}</h3>
                  <p className="text-gray-400 text-sm">{mod.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Creators */}
      <section id="creators" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              Knights of <span className="text-gold">Valiant League</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              The people building Valiant League — swap these placeholder
              profiles for your real team before launch.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {knights.map((k, index) => (
              <div
                key={k.name}
                className={`rounded-lg overflow-hidden creator-card fade-in-up stagger-${index + 1} bg-black/70`}
              >
                <div className="relative h-64 bg-[#0d0d0d]">
                  <Image src={k.image} alt={k.name} fill className="object-cover" />
                </div>
                <div className="p-6 border-t border-gold/20 text-center">
                  <h3 className="text-xl font-bold text-white font-cinzel">{k.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">{k.role}</p>
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
      </section>

      {/* Flow */}
      <section id="flow" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              Six Steps, <span className="text-gold">Start To Trophy</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              The whole day, walked through — from building the roster to
              handing over the trophy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-6xl mx-auto">
            {flowSteps.slice(0, isMobile ? 4 : 6).map((s, index) => (
              <div
                key={s.title}
                className={`rounded-lg overflow-hidden box-hover-effect fade-in-up stagger-${(index % 6) + 1} p-5 bg-black/70 text-center`}
              >
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center">
                    <s.icon className="h-5 w-5 text-gold" />
                  </div>
                </div>
                <span className="text-[10px] font-mono text-gray-500 tracking-widest">{`0${index + 1}`}</span>
                <h3 className="text-base font-bold text-white mt-1 mb-1 font-cinzel">{s.title}</h3>
                <p className="text-gray-400 text-xs">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section id="tiers" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              Choose Your <span className="text-gold">League Size</span>
            </h2>
            <p className="text-gray-300 max-w-3xl mx-auto mt-4">
              Every tier gets all three modules. What changes is scale and
              support, not which tools you're allowed to use.
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
                  <Button
                    className="w-full bg-[#cd7f32] hover:bg-[#cd7f32]/80 text-black font-bold pulse"
                    onClick={() => handleNavigation("/admin")}
                  >
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
                  <Button
                    className="w-full bg-[#C0C0C0] hover:bg-[#C0C0C0]/80 text-black font-bold pulse"
                    onClick={() => scrollToSection("contact")}
                  >
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
                  <Button
                    className="w-full bg-gold hover:bg-gold/80 text-black font-bold pulse"
                    onClick={() => scrollToSection("contact")}
                  >
                    Get Started
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 bg-black/90" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              Contact <span className="text-gold">Valiant League</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              Questions about running your league, a Club or Franchise plan,
              or a walkthrough before match day — reach out any time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12 max-w-3xl mx-auto">
            <div className="fade-in">
              <Card className="bg-black/50 border border-gold/20 shine hover:border-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-gold/20 h-full">
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold text-white mb-6 font-cinzel text-center">
                    Get in <span className="text-gold">Touch</span>
                  </h3>
                  <p className="text-gray-300 mb-8 text-center">
                    Have questions about our modules or interested in a Club
                    or Franchise plan? Reach out through any of the channels
                    below.
                  </p>

                  <div className="space-y-6">
                    <div className="flex items-start">
                      <Link
                        href="mailto:hello@valiantleague.app"
                        className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center mr-4 hover:bg-gold/20 transition-colors"
                      >
                        <Mail className="h-6 w-6 text-gold" />
                      </Link>
                      <div>
                        <h4 className="text-xl font-bold text-white mb-1">Email Us</h4>
                        <p className="text-gray-400">
                          hello@valiantleague.app <span className="text-gray-600">— placeholder, swap for your address</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Link
                        href="/admin"
                        className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center mr-4 hover:bg-gold/20 transition-colors"
                      >
                        <Gavel className="h-6 w-6 text-gold" />
                      </Link>
                      <div>
                        <h4 className="text-xl font-bold text-white mb-1">Book a Walkthrough</h4>
                        <p className="text-gray-400">[Link to your scheduling page]</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Link
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center mr-4 hover:bg-gold/20 transition-colors"
                      >
                        <Twitter className="h-6 w-6 text-gold" />
                      </Link>
                      <div>
                        <h4 className="text-xl font-bold text-white mb-1">Follow Us</h4>
                        <p className="text-gray-400">[@yourhandle]</p>
                      </div>
                    </div>
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

      {/* ═══════════════════════════════════════════════════════════
          FOOTER — expanded 3-column layout (brand / navigation / social)
      ═══════════════════════════════════════════════════════════ */}
      <footer className="bg-black border-t border-gold/20">
        <div className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Brand */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="relative w-12 h-12">
                  <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" />
                </div>
                <span className="font-cinzel font-bold text-2xl text-white">
                  VALIANT <span className="text-gold">LEAGUE</span>
                </span>
              </div>
              <p className="text-gray-400">
                Valiant League is the all-in-one platform for running a league —
                live auctions, automatic brackets, and broadcast-ready overlays,
                all reading from the same live data.
              </p>
            </div>

            {/* Navigation */}
            <div>
              <h3 className="font-cinzel font-bold text-xl text-white mb-6">NAVIGATION</h3>
              <ul className="space-y-4">
                {navLinks.map((link) => (
                  <li key={link.id}>
                    <div
                      onClick={() => scrollToSection(link.id)}
                      className="text-gray-400 hover:text-gold transition-colors flex items-center cursor-pointer"
                    >
                      <ArrowRight className="h-4 w-4 mr-2 text-gold" />
                      {link.name.charAt(0) + link.name.slice(1).toLowerCase()}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social + Console */}
            <div>
              <h3 className="font-cinzel font-bold text-xl text-white mb-6">SOCIAL LINKS</h3>
              <ul className="space-y-4">
                <li>
                  <Link
                    href="#"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gold transition-colors flex items-center"
                  >
                    <Twitter className="h-4 w-4 mr-2 text-gold" />
                    Twitter
                  </Link>
                </li>
                <li>
                  <Link
                    href="mailto:hello@valiantleague.app"
                    className="text-gray-400 hover:text-gold transition-colors flex items-center"
                  >
                    <Mail className="h-4 w-4 mr-2 text-gold" />
                    Email
                  </Link>
                </li>
                <li>
                  <div
                    onClick={() => handleNavigation("/admin")}
                    className="text-gray-400 hover:text-gold transition-colors flex items-center cursor-pointer"
                  >
                    <Shield className="h-4 w-4 mr-2 text-gold" />
                    Open the Console
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-gold/20">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                © {new Date().getFullYear()} Valiant League. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <div
                  onClick={() => handleNavigation("/privacy-policy")}
                  className="text-gray-400 text-sm hover:text-gold transition-colors cursor-pointer"
                >
                  Privacy Policy
                </div>
                <div
                  onClick={() => handleNavigation("/terms-of-service")}
                  className="text-gray-400 text-sm hover:text-gold transition-colors cursor-pointer"
                >
                  Terms of Service
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}