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
  Check,
  X as XIcon,
  Minus,
  Plus,
  Quote,
  ChevronLeft,
  ChevronRight,
  Mail,
  Twitter,
  Menu,
  X,
  Clock,
  MapPin,
  MessageCircle,
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

/* ── themed scrollbar ── */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: #000; }
::-webkit-scrollbar-thumb {
  background: rgba(245,166,35,0.5);
  border-radius: 6px;
  border: 2px solid #000;
}
::-webkit-scrollbar-thumb:hover { background: rgba(245,166,35,0.8); }

html { scrollbar-width: thin; scrollbar-color: rgba(245,166,35,0.5) #000; }

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

/* ── shine sweep, for the contact card + testimonials ── */
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

/* ── logo marquee ── */
@keyframes scrollMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.marquee-track { animation: scrollMarquee 28s linear infinite; }
.marquee-mask { -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }

/* ── faq chevron rotate ── */
.faq-icon { transition: transform 0.3s ease, background-color 0.3s ease; }

/* ── typewriter cursor ── */
@keyframes tw-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .fade-in, .fade-in-up, .animate-slow-pulse, .pulse, .floating, .gold-gradient-text, .shine::after, .section-title::after, .marquee-track {
    animation: none !important;
    opacity: 1 !important;
  }
}
`

/* ─────────────────────────────────────────────────────────────────────────
   TYPEWRITER REVEAL — plays once, when the text scrolls into view.
   Reserves its own width/height with an invisible ghost copy so nothing
   reflows while it types.
──────────────────────────────────────────────────────────────────────── */
function TypeText({
  text,
  className = "",
  speed = 40,
  delay = 0,
}: {
  text: string
  className?: string
  speed?: number
  delay?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [displayed, setDisplayed] = useState("")
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const hasRun = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRun.current) {
          hasRun.current = true
          setTimeout(() => {
            setStarted(true)
            let i = 0
            const interval = setInterval(() => {
              i++
              setDisplayed(text.slice(0, i))
              if (i >= text.length) {
                clearInterval(interval)
                setTimeout(() => setDone(true), 700)
              }
            }, speed)
          }, delay)
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [text, speed, delay])

  return (
    <span ref={ref} className={className} style={{ position: "relative", display: "inline-block" }}>
      <span aria-hidden="true" style={{ visibility: "hidden", whiteSpace: "pre" }}>
        {text}
      </span>
      <span aria-live="polite" style={{ position: "absolute", top: 0, left: 0, whiteSpace: "pre" }}>
        {started ? displayed : ""}
        {started && !done && (
          <span
            style={{
              display: "inline-block",
              width: "0.05em",
              height: "0.8em",
              backgroundColor: "currentColor",
              marginLeft: "2px",
              verticalAlign: "middle",
              animation: "tw-blink 0.7s step-end infinite",
            }}
          />
        )}
      </span>
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   NAV LINKS — kept short deliberately; a few sections below (Trusted By,
   Stats, Testimonials) are reachable by scroll but not given nav entries,
   the same way a long single-page site avoids overloading its header.
──────────────────────────────────────────────────────────────────────── */
const navLinks = [
  { name: "HOME", id: "home" },
  { name: "MODULES", id: "modules" },
  { name: "COMPARE", id: "compare" },
  { name: "SHOWCASE", id: "showcase" },
  { name: "FAQ", id: "faq" },
  { name: "PRICING", id: "tiers" },
  { name: "CONTACT", id: "contact" },
]

/* ─────────────────────────────────────────────────────────────────────────
   MODULES — icon block + tag chip layout
──────────────────────────────────────────────────────────────────────── */
const modules = [
  {
    icon: Gavel,
    title: "Live Auction\nRoom",
    description:
      "A real shot clock, enforced purses, and a bid room every owner runs from their own phone.",
    badge: "CORE",
    accent: "#F5A623",
  },
  {
    icon: Trophy,
    title: "Automatic\nBrackets",
    description:
      "Single or double-elimination knockouts, drawn from your teams and updated as results come in.",
    badge: "LIVE",
    accent: "#CD7F32",
  },
  {
    icon: MonitorPlay,
    title: "Broadcast\nOverlays",
    description:
      "A transparent, stream-ready layer — score bar, scorecard, boundaries, weather — toggled from the console.",
    badge: "STREAM",
    accent: "#C0C0C0",
  },
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

/* ─────────────────────────────────────────────────────────────────────────
   TRUSTED-BY / STATS / TESTIMONIALS / COMPARISON / SHOWCASE / FAQ
──────────────────────────────────────────────────────────────────────── */
const trustedClubs = ["Iron Knights CC", "Royal Strikers", "Silver Hawks", "Golden Lions", "Crimson Wardens"]

const stats = [
  { value: "500+", label: "Leagues Run" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "6s", label: "Auction Shot Clock" },
  { value: "200+", label: "Tournaments Drawn" },
]

const testimonials = [
  {
    quote:
      "Valiant League is the first platform that actually respects match day. We ran three auctions in six weeks without touching a spreadsheet.",
    name: "KGlimited",
    role: "Founder, The Wardens",
  },
  {
    quote:
      "Finally a system that doesn't fight us. The overlays are flawless and there's zero setup required on stream day.",
    name: "s7uid",
    role: "Royal Guard, The Wardens",
  },
  {
    quote:
      "We replaced four spreadsheets and a Discord bot. Owner onboarding dropped from two weeks to two days.",
    name: "vpowerv",
    role: "Knight, The Wardens",
  },
]

type CellValue = true | false | "partial"
const comparisonRows: { feature: string; vl: CellValue; sheet: CellValue; discord: CellValue; zoom: CellValue }[] = [
  { feature: "Live bid timer", vl: true, sheet: false, discord: false, zoom: "partial" },
  { feature: "Mobile bidding", vl: true, sheet: false, discord: "partial", zoom: false },
  { feature: "Automatic brackets", vl: true, sheet: false, discord: false, zoom: false },
  { feature: "Broadcast overlays", vl: true, sheet: false, discord: false, zoom: false },
  { feature: "Purse enforcement", vl: true, sheet: "partial", discord: false, zoom: false },
  { feature: "Free tier to start", vl: true, sheet: true, discord: true, zoom: false },
]
const comparisonColumns = [
  { key: "sheet" as const, label: "Spreadsheet" },
  { key: "discord" as const, label: "Discord Bot" },
  { key: "zoom" as const, label: "Zoom Call" },
]

const showcaseSlides = [
  { tag: "Auction", title: "Iron Knights Season Opener", by: "Run by The Wardens CC — 8 teams, 96 players" },
  { tag: "Bracket", title: "Silver Cup Knockout", by: "Run by Royal Strikers — double-elimination, 16 teams" },
  { tag: "Overlay", title: "Golden Lions Broadcast", by: "Streamed live — 12,000 viewers peak" },
  { tag: "League", title: "Crimson Cup Full Season", by: "Run by Valiant Originals — three months, one trophy" },
  { tag: "League", title: "Bronze Trophy Series", by: "Run by Bronze Trophy Alliance — 5 teams, round robin" },
  { tag: "Auction", title: "Wardens Winter Sale", by: "Run by The Wardens CC — 64 players moved in one night" },
]

const faqs = [
  {
    question: "Is Valiant League really free to start?",
    answer:
      "Yes. The Casual tier is free forever, no credit card required. You get one live auction, a single-elimination bracket, and a broadcast overlay page. Upgrade any time — there's no lock-in.",
  },
  {
    question: "Do owners need to install anything to bid?",
    answer:
      "No. Owners bid from any phone or laptop browser. There's no app to download and no account setup beyond a league invite link.",
  },
  {
    question: "How do the broadcast overlays work?",
    answer:
      "Toggle the score bar, scorecard, boundaries, or weather from the console, then add the transparent layer straight into OBS or the streaming software of your choice.",
  },
  {
    question: "Can I import my existing teams and players?",
    answer:
      "Yes. Upload a spreadsheet of teams, owners, and your player pool with base prices, and Valiant League sets up the auction room for you.",
  },
  {
    question: "What can I run after the auction?",
    answer:
      "Move straight into a single or double-elimination bracket, drawn from the teams you just built, with results feeding the overlay live.",
  },
]

function ComparisonCell({ value }: { value: CellValue }) {
  if (value === true) return <Check className="h-4 w-4 text-gold mx-auto" />
  if (value === false) return <XIcon className="h-4 w-4 text-gray-400 mx-auto" />
  return <Minus className="h-4 w-4 text-gray-400 mx-auto" />
}

const SECTIONS = navLinks.map((l) => l.id)

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const [isLoaded, setIsLoaded] = useState(false)
  useEffect(() => setIsLoaded(true), [])

  // ---- navbar state ----
  const [isNavOpen, setIsNavOpen] = useState(false)

  // ---- FAQ accordion ----
  const [openFaq, setOpenFaq] = useState<number | null>(0)

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
                  : "bg-gray-400 hover:bg-gold/50"
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
            <nav className="hidden md:flex items-center justify-center flex-wrap gap-2">
              {navLinks.map((link) => (
                <Button
                  key={link.name}
                  variant={activeSection === link.id ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "font-cinzel text-sm xl:text-base transition-all",
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
            <div className="relative w-[10rem] h-[11rem] sm:w-[14rem] sm:h-[15rem] md:w-[18rem] md:h-[19rem] lg:w-[20rem] lg:h-[21rem] mb-4 md:mb-6 floating">
              <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" priority />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-3 md:mb-6 font-cinzel tracking-wider">
              VALIANT <span className="gold-gradient-text">LEAGUE</span>
            </h1>


            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
              <Button
                className="bg-gold hover:bg-gold/90 text-black font-bold py-4 md:py-6 px-6 md:px-8 rounded-md text-base md:text-lg animate-slow-pulse hover:scale-105 transition-all duration-500"
                onClick={() => scrollToSection("modules")}
              >
                Explore the Platform
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="border-gold text-gold hover:bg-gold/10 py-4 md:py-6 px-6 md:px-8 rounded-md text-base md:text-lg animate-slow-pulse hover:scale-105 transition-all duration-500 bg-transparent"
                onClick={() => handleNavigation("/admin")}
              >
                <Shield className="mr-2 h-5 w-5" />
                Open the Console
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TRUSTED BY — logo marquee
      ═══════════════════════════════════════════════════════════ */}
      <section className="py-10 md:py-14 relative bg-black border-y border-gold/10">
        <div className="container mx-auto px-4 text-center mb-6 fade-in">
          <span className="font-cinzel text-xs md:text-sm tracking-[3px] text-gray-300">
            TRUSTED BY CLUBS LIKE
          </span>
        </div>
        <div className="relative w-full overflow-hidden marquee-mask">
          <div className="flex items-center gap-16 w-max marquee-track">
            {[...trustedClubs, ...trustedClubs].map((club, i) => (
              <span
                key={`${club}-${i}`}
                className="font-cinzel font-semibold text-lg md:text-xl text-gray-400 tracking-wide whitespace-nowrap"
              >
                {club}
              </span>
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
              Three tools, one league. Every one of them reads and writes the
              same live data, so a bid, a result, or a toggle shows up
              everywhere else instantly.
            </p>
          </div>

          <div className="flex flex-col md:flex-row w-full gap-[2px] max-w-5xl mx-auto rounded-lg overflow-hidden">
            {modules.map((mod, index) => (
              <div
                key={mod.badge}
                className={`flex flex-col gap-5 p-8 md:p-10 md:flex-1 md:h-[340px] bg-black/70 box-hover-effect fade-in-up stagger-${index + 1}`}
                style={{ borderColor: `${mod.accent}55` }}
              >
                <div
                  className="w-12 h-12 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${mod.accent}1A`, border: `1px solid ${mod.accent}` }}
                >
                  <mod.icon className="w-6 h-6" style={{ color: mod.accent }} />
                </div>
                <h3 className="text-xl font-bold text-white font-cinzel leading-tight whitespace-pre-line">
                  {mod.title}
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">{mod.description}</p>
                <div
                  className="mt-auto flex items-center justify-center h-7 px-3 border rounded w-fit"
                  style={{ borderColor: mod.accent, backgroundColor: "rgba(0,0,0,0.4)" }}
                >
                  <span className="text-[11px] font-mono tracking-[2px]" style={{ color: mod.accent }}>
                    {mod.badge}
                  </span>
                </div>
              </div>
            ))}
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
                <span className="font-cinzel text-4xl md:text-5xl font-bold gold-gradient-text mb-2">
                  {stat.value}
                </span>
                <span className="text-gray-300 text-xs md:text-sm tracking-widest uppercase">
                  {stat.label}
                </span>
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
              <TypeText text="Knights of " speed={40} />
              <TypeText text="Valiant League" speed={40} delay={400} className="text-gold" />
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
              Real leagues, run live, by people who used to run them from a
              spreadsheet.
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
              See how it stacks up against running your league by hand. No
              spin, just what each option actually does on match day.
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
              <div
                key={row.feature}
                className={`rounded-lg border border-gold/20 bg-black/60 p-4 fade-in-up stagger-${(i % 6) + 1}`}
              >
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
              <div
                key={s.title}
                className={`rounded-lg overflow-hidden glow-effect border border-gold/20 bg-black/70 fade-in-up stagger-${i + 1}`}
              >
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
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              Everything you need to know before your first auction.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <div
                  key={faq.question}
                  className={`group rounded-lg border bg-black/50 overflow-hidden transition-all duration-300 fade-in-up stagger-${(i % 6) + 1} ${
                    isOpen
                      ? "border-gold/70 shadow-[0_0_20px_rgba(245,166,35,0.15)]"
                      : "border-gold/20 hover:border-gold/40"
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-start gap-4 p-5 md:p-6 text-left"
                  >
                    <span
                      className={`font-cinzel text-xs font-bold shrink-0 mt-1 transition-colors duration-300 ${
                        isOpen ? "text-gold" : "text-gold/40 group-hover:text-gold/70"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <span className="flex-1 font-cinzel text-base md:text-lg font-bold text-white leading-snug">
                      {faq.question}
                    </span>

                    <div
                      className={`faq-icon h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        isOpen ? "bg-gold" : "bg-gold/10 border border-gold/40"
                      }`}
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      {isOpen ? (
                        <Minus className="h-4 w-4 text-black" />
                      ) : (
                        <Plus className="h-4 w-4 text-gold" />
                      )}
                    </div>
                  </button>

                  <div
                    className="grid transition-all duration-300 ease-in-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 md:px-6 pb-5 md:pb-6 pl-[3.25rem] md:pl-[3.5rem]">
                        <div className="h-px w-full bg-gold/10 mb-4" />
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {faq.answer}
                        </p>
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
              Questions about running your league, a Club or Franchise plan,
              or a walkthrough before match day — reach out any time.
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
                    Have questions about our modules or interested in a Club
                    or Franchise plan? Reach out through any of the channels
                    below.
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
                        <p className="text-gray-300 text-sm">
                          Fully online — leagues run from anywhere, no local office required.
                        </p>
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
              <p className="text-gray-300">
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
                      className="text-gray-300 hover:text-gold transition-colors flex items-center cursor-pointer"
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
                    className="text-gray-300 hover:text-gold transition-colors flex items-center"
                  >
                    <Twitter className="h-4 w-4 mr-2 text-gold" />
                    Twitter
                  </Link>
                </li>
                <li>
                  <Link
                    href="mailto:hello@valiantleague.app"
                    className="text-gray-300 hover:text-gold transition-colors flex items-center"
                  >
                    <Mail className="h-4 w-4 mr-2 text-gold" />
                    Email
                  </Link>
                </li>
                <li>
                  <div
                    onClick={() => handleNavigation("/admin")}
                    className="text-gray-300 hover:text-gold transition-colors flex items-center cursor-pointer"
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
              <p className="text-gray-300 text-sm">
                © {new Date().getFullYear()} Valiant League. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <div
                  onClick={() => handleNavigation("/privacy-policy")}
                  className="text-gray-300 text-sm hover:text-gold transition-colors cursor-pointer"
                >
                  Privacy Policy
                </div>
                <div
                  onClick={() => handleNavigation("/terms-of-service")}
                  className="text-gray-300 text-sm hover:text-gold transition-colors cursor-pointer"
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