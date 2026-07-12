"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Shield, Twitter, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ════════════════════════════════════════════════════════════════════
   REUSED HELPERS (used more than once across the page)
   ════════════════════════════════════════════════════════════════════ */

/** Typewriter-style reveal with a blinking cursor, triggered on scroll into view. */
function GlitchText({
  text,
  className = "",
  delay = 0,
  speed = 40,
}: {
  text: string;
  className?: string;
  /** ms before typing starts after entering viewport */
  delay?: number;
  /** ms between each character */
  speed?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRun.current) {
          hasRun.current = true;
          setTimeout(() => {
            setStarted(true);
            let i = 0;
            const interval = setInterval(() => {
              i++;
              setDisplayed(text.slice(0, i));
              if (i >= text.length) {
                clearInterval(interval);
                setTimeout(() => setDone(true), 800);
              }
            }, speed);
          }, delay);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [text, speed, delay]);

  return (
    // Outer span: holds the full text invisibly to reserve exact dimensions
    <span ref={ref} className={className} style={{ position: "relative", display: "inline-block" }}>
      {/* Ghost text — always here, reserves width + height, never visible */}
      <span aria-hidden="true" style={{ visibility: "hidden", whiteSpace: "pre" }}>
        {text}
      </span>

      {/* Animated text — absolutely overlaid, same position */}
      <span aria-live="polite" style={{ position: "absolute", top: 0, left: 0, whiteSpace: "pre" }}>
        {started ? displayed : ""}
        {started && !done && (
          <span
            style={{
              display: "inline-block",
              width: "0.06em",
              height: "0.85em",
              backgroundColor: "currentColor",
              marginLeft: "2px",
              verticalAlign: "middle",
              animation: "tw-blink 0.7s step-end infinite",
            }}
          />
        )}
      </span>

      <style>{`
        @keyframes tw-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}

function SectionHeader({
  label,
  title,
  subtitle,
  titleWidth = "w-full max-w-[700px]",
  subtitleWidth = "w-full max-w-[600px]",
}: {
  label: string;
  title: string;
  subtitle?: string;
  titleWidth?: string;
  subtitleWidth?: string;
}) {
  return (
    <div className="flex flex-col gap-[16px] w-full">
      <span className="font-inter text-[10px] md:text-[12px] font-bold text-[#F5A623] tracking-[1.5px] md:tracking-[3px]">
        <GlitchText text={label} speed={30} />
      </span>
      <h2 className={`font-cinzel text-[36px] md:text-[56px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.05] whitespace-pre-line ${titleWidth}`}>
        <GlitchText text={title} speed={40} delay={150} />
      </h2>
      {subtitle && (
        <p className={`font-inter text-[10px] md:text-[13px] text-[#666666] tracking-[0.5px] md:tracking-[1px] leading-[1.6] text-pretty ${subtitleWidth}`}>
          <GlitchText text={subtitle} speed={20} delay={350} />
        </p>
      )}
    </div>
  );
}

/* Card renderers used 3x per section — kept as functions to avoid repeating markup */

function FeatureCard({
  iconColor, title, description, tag, tagColor, bgColor = "#111111", borderColor = "#2D2D2D",
}: {
  iconColor: string; title: string; description: string; tag: string; tagColor: string; bgColor?: string; borderColor?: string;
}) {
  return (
    <div className="flex flex-col gap-5 p-8 md:p-[32px] border w-full md:flex-1 md:h-[320px]" style={{ backgroundColor: bgColor, borderColor }}>
      <div className="w-[40px] h-[40px] shrink-0" style={{ backgroundColor: iconColor }} />
      <h3 className="font-cinzel text-[18px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">{title}</h3>
      <p className="font-inter text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">{description}</p>
      <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border w-fit" style={{ borderColor: tagColor }}>
        <span className="font-inter text-[11px] tracking-[2px]" style={{ color: tagColor }}>{tag}</span>
      </div>
    </div>
  );
}

function StepCard({
  number, title, description, bgColor = "#0A0A0A", borderColor = "#2D2D2D", borderWidth = 1,
}: {
  number: string; title: string; description: string; bgColor?: string; borderColor?: string; borderWidth?: number;
}) {
  return (
    <div className="flex flex-col gap-4 p-8 md:p-[40px] border w-full md:flex-1 md:h-[260px]" style={{ backgroundColor: bgColor, borderColor, borderWidth }}>
      <span className="font-cinzel text-[48px] font-bold text-[#F5A623] tracking-[-2px]">{number}</span>
      <h3 className="font-cinzel text-[20px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">{title}</h3>
      <p className="font-inter text-[11px] text-[#555555] tracking-[1px] leading-[1.5]">{description}</p>
    </div>
  );
}

function TestimonialCard({
  quote, name, role, bgColor = "#111111", accentColor,
}: {
  quote: string; name: string; role: string; bgColor?: string; accentColor: string;
}) {
  return (
    <div className="flex flex-col gap-6 p-8 md:p-[40px] border-l-4 w-full md:flex-1" style={{ backgroundColor: bgColor, borderLeftColor: accentColor }}>
      <p className="font-inter text-[13px] text-[#CCCCCC] tracking-[1px] leading-[1.6]">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-[12px]">
        <div className="w-[36px] h-[36px] rounded-full bg-[#333333] shrink-0" />
        <div className="flex flex-col gap-[2px]">
          <span className="font-cinzel text-[13px] font-bold text-[#F5F5F0] tracking-[1px]">{name}</span>
          <span className="font-inter text-[11px] text-[#555555] tracking-[1px]">{role}</span>
        </div>
      </div>
    </div>
  );
}

function PricingCard({
  tier, tierColor = "#888888", name, nameColor = "#F5F5F0", price, priceColor = "#F5F5F0",
  btnLabel, btnLabelColor = "#888888", bgColor = "#0F0F0F", borderColor = "#2D2D2D", borderWidth = 1,
  btnBg = "#1A1A1A", btnBorderColor = "#3D3D3D", tierBg = "#1A1A1A", tierBorderColor = "#3D3D3D",
  features, accentColor = "#555555",
}: {
  tier: string; tierColor?: string; name: string; nameColor?: string; price: string; priceColor?: string;
  btnLabel: string; btnLabelColor?: string; bgColor?: string; borderColor?: string; borderWidth?: number;
  btnBg?: string; btnBorderColor?: string; tierBg?: string; tierBorderColor?: string;
  features: { label: string; included: boolean }[]; accentColor?: string;
}) {
  return (
    <div className="flex flex-col gap-8 p-8 md:p-[40px] w-full md:flex-1" style={{ backgroundColor: bgColor, border: `${borderWidth}px solid ${borderColor}` }}>
      <div className="flex items-center justify-center h-[28px] px-[12px] w-fit" style={{ backgroundColor: tierBg, border: `1px solid ${tierBorderColor}` }}>
        <span className="font-inter text-[11px] tracking-[2px]" style={{ color: tierColor }}>{tier}</span>
      </div>
      <span className="font-cinzel text-[28px] font-bold tracking-[1px]" style={{ color: nameColor }}>{name}</span>
      <div className="flex items-end gap-[4px]">
        <span className="font-cinzel text-[48px] font-bold tracking-[-2px] leading-none" style={{ color: priceColor }}>{price}</span>
        <span className="font-inter text-[13px] text-[#555555] tracking-[1px] mb-[6px]">/MO</span>
      </div>
      <div className="flex flex-col gap-[10px]" style={{ borderTop: `1px solid ${borderColor === "#0F0F0F" ? "#2D2D2D" : borderColor}` }}>
        <div className="pt-6 flex flex-col gap-[10px]">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="font-inter text-[14px] leading-none shrink-0" style={{ color: f.included ? accentColor : "#333333" }}>
                {f.included ? "+" : "—"}
              </span>
              <span className="font-inter text-[11px] tracking-[1px]" style={{ color: f.included ? "#A0A09A" : "#3D3D3D" }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="flex items-center justify-center w-full h-[48px] mt-auto" style={{ backgroundColor: btnBg, border: `2px solid ${btnBorderColor}` }}>
        <span className="font-inter text-[12px] tracking-[2px]" style={{ color: btnLabelColor }}>{btnLabel}</span>
      </button>
    </div>
  );
}

function cellStyle(val: string) {
  if (val === "[✓]") return "font-bold text-[14px]";
  if (val === "[✗]") return "text-[#3D3D3D] text-[13px]";
  if (val === "[—]") return "text-[#444444] text-[13px]";
  return "text-[#444444] text-[10px]";
}
function cellColor(val: string) {
  return val === "[✓]" ? "text-[#444444]" : "";
}

/* ════════════════════════════════════════════════════════════════════
   STATIC DATA
   ════════════════════════════════════════════════════════════════════ */

const NAV_LINKS = [
  { label: "HOME", section: "home" },
  { label: "MODULES", section: "features" },
  { label: "COMPARE", section: "comparison" },
  { label: "SHOWCASE", section: "showcase" },
  { label: "FAQ", section: "faq" },
  { label: "PRICING", section: "pricing" },
];

const logos = ["IRON KNIGHTS CC", "ROYAL STRIKERS", "SILVER HAWKS", "GOLDEN LIONS", "CRIMSON WARDENS"];

const stats = [
  { value: "500+", label: "LEAGUES RUN", border: true },
  { value: "99.9%", label: "UPTIME SLA", border: true },
  { value: "6s", label: "AUCTION SHOT CLOCK", border: true },
  { value: "200+", label: "TOURNAMENTS DRAWN", border: false },
];

const comparisonRows = [
  { feature: "LIVE BID TIMER", pc: "[✓]", figma: "[✗]", sketch: "[—]", framer: "[✗]" },
  { feature: "MOBILE BIDDING", pc: "[✓]", figma: "[—]", sketch: "[✓]", framer: "[✗]" },
  { feature: "AUTOMATIC BRACKETS", pc: "[✓]", figma: "[✗]", sketch: "[✗]", framer: "[✗]" },
  { feature: "BROADCAST OVERLAYS", pc: "[✓]", figma: "[✗]", sketch: "[✗]", framer: "[BETA]" },
  { feature: "PURSE ENFORCEMENT", pc: "[✓]", figma: "[✗]", sketch: "[—]", framer: "[✗]" },
  { feature: "FREE CASUAL TIER", pc: "[✓]", figma: "[✓]", sketch: "[✓]", framer: "[—]" },
];

const showcaseSlides = [
  { tag: "[AUCTION]", tagBg: "#F5A623", tagColor: "#0A0A0A", idx: "01 / 04", idxColor: "#444444", title: "IRON KNIGHTS\nSEASON OPENER", by: "RUN BY THE WARDENS CC // 8 TEAMS, 96 PLAYERS", border: "#2D2D2D", bg: "#111111", tagBorder: "" },
  { tag: "[BRACKET]", tagBg: "#111111", tagColor: "#F5A623", idx: "02 / 04", idxColor: "#F5A623", title: "SILVER CUP\nKNOCKOUT", by: "RUN BY ROYAL STRIKERS // DOUBLE-ELIM, 16 TEAMS", border: "#F5A623", bg: "#0F0F0F", tagBorder: "#F5A623" },
  { tag: "[OVERLAY]", tagBg: "#1A1A1A", tagColor: "#CD7F32", idx: "03 / 04", idxColor: "#444444", title: "GOLDEN LIONS\nBROADCAST", by: "STREAMED LIVE // 12,000 VIEWERS PEAK", border: "#2D2D2D", bg: "#0A0A0A", tagBorder: "#CD7F32" },
  { tag: "[LEAGUE]", tagBg: "#F5A623", tagColor: "#0A0A0A", idx: "04 / 04", idxColor: "#444444", title: "CRIMSON CUP\nFULL SEASON", by: "RUN BY VALIANT ORIGINALS // 3 MONTHS, 1 TROPHY", border: "#2D2D2D", bg: "#111111", tagBorder: "" },
];

const faqs = [
  { question: "IS VALIANT LEAGUE REALLY FREE TO START?", answer: "YES. THE CASUAL TIER IS FREE FOREVER. NO CREDIT CARD REQUIRED. ONE LIVE AUCTION, A SINGLE-ELIMINATION BRACKET, AND A BROADCAST OVERLAY PAGE. UPGRADE ANYTIME — NO LOCK-IN, NO DARK PATTERNS." },
  { question: "DO OWNERS NEED TO INSTALL ANYTHING TO BID?", answer: "NO. OWNERS BID FROM ANY PHONE OR LAPTOP BROWSER. NO APP DOWNLOAD, NO ACCOUNT SETUP BEYOND A LEAGUE INVITE." },
  { question: "HOW DO THE BROADCAST OVERLAYS WORK?", answer: "TOGGLE THE SCORE BAR, SCORECARD, BOUNDARIES, OR WEATHER FROM THE CONSOLE AND ADD THE TRANSPARENT LAYER STRAIGHT INTO OBS OR YOUR STREAMING SOFTWARE OF CHOICE." },
  { question: "CAN I IMPORT MY EXISTING TEAMS AND PLAYERS?", answer: "YES. UPLOAD A SPREADSHEET OF TEAMS, OWNERS, AND YOUR PLAYER POOL WITH BASE PRICES, AND VALIANT LEAGUE SETS UP THE AUCTION ROOM FOR YOU." },
  { question: "WHAT CAN I RUN AFTER THE AUCTION?", answer: "MOVE STRAIGHT INTO A SINGLE OR DOUBLE-ELIMINATION BRACKET, DRAWN FROM THE TEAMS YOU JUST BUILT, WITH RESULTS FEEDING THE OVERLAY LIVE." },
];

const CASUAL_FEATURES = [
  { label: "ONE LIVE AUCTION AT A TIME", included: true },
  { label: "SINGLE-ELIMINATION BRACKET", included: true },
  { label: "BROADCAST OVERLAY PAGE", included: true },
  { label: "UP TO 8 TEAMS", included: true },
  { label: "UNLIMITED CONCURRENT AUCTIONS", included: false },
  { label: "DOUBLE-ELIMINATION BRACKETS", included: false },
  { label: "UNSOLD-PLAYER RE-ENTRY ROUNDS", included: false },
  { label: "CUSTOM OVERLAY BRANDING", included: false },
];
const CLUB_FEATURES = [
  { label: "EVERYTHING IN CASUAL", included: true },
  { label: "UNLIMITED CONCURRENT AUCTIONS", included: true },
  { label: "DOUBLE-ELIMINATION BRACKETS", included: true },
  { label: "UNSOLD-PLAYER RE-ENTRY ROUNDS", included: true },
  { label: "PRIORITY SUPPORT ON MATCH DAY", included: true },
  { label: "UP TO 32 TEAMS", included: true },
  { label: "CUSTOM OVERLAY BRANDING", included: false },
  { label: "MULTI-TOURNAMENT SEASON TRACKING", included: false },
];
const FRANCHISE_FEATURES = [
  { label: "EVERYTHING IN CLUB", included: true },
  { label: "CUSTOM OVERLAY BRANDING", included: true },
  { label: "PRIORITY SUPPORT ON MATCH DAY", included: true },
  { label: "MULTI-TOURNAMENT SEASON TRACKING", included: true },
  { label: "UNLIMITED TEAMS", included: true },
  { label: "DEDICATED ONBOARDING", included: true },
  { label: "UNSOLD-PLAYER RE-ENTRY ROUNDS", included: true },
  { label: "DOUBLE-ELIMINATION BRACKETS", included: true },
];

const productLinks = ["MODULES", "PRICING", "CHANGELOG", "ROADMAP"];
const companyLinks = ["ABOUT", "KNIGHTS", "CAREERS"];
const resourceLinks = ["DOCS", "CONSOLE", "COMMUNITY"];

/* ════════════════════════════════════════════════════════════════════
   PAGE — everything below is one-time-use, so it's all inlined
   directly into this single component instead of being split into
   separate Navbar/Hero/Features/... components.
   ════════════════════════════════════════════════════════════════════ */

const SECTIONS = NAV_LINKS.map((l) => l.section);

export default function Home() {
  const router = useRouter();

  // ---- mobile detection ----
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ---- hero load-in ----
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => setIsLoaded(true), []);

  // ---- navbar state ----
  const [isNavOpen, setIsNavOpen] = useState(false);

  // ---- active section tracking, via IntersectionObserver ----
  const [activeSection, setActiveSection] = useState(SECTIONS[0]);
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  useEffect(() => {
    const sections = SECTIONS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let bestId = activeSectionRef.current;
        let bestRatio = 0;
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });

        if (bestRatio > 0 && bestId !== activeSectionRef.current) {
          setActiveSection(bestId);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-20% 0px -60% 0px" }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      window.scrollTo({ top: element.offsetTop - 20, behavior: "smooth" });
      setActiveSection(sectionId);
    }
    setIsNavOpen(false);
  };

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);

  const handleNavigation = (path: string) => {
    router.push(path);
    window.scrollTo(0, 0);
  };

  // Showcase
  const [showcaseActive, setShowcaseActive] = useState(1);
  const showcasePrev = () => setShowcaseActive((p) => Math.max(0, p - 1));
  const showcaseNext = () => setShowcaseActive((p) => Math.min(showcaseSlides.length - 1, p + 1));
  const slide = showcaseSlides[showcaseActive];

  // FAQ
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="flex flex-col w-full bg-[#0A0A0A] pt-[60px]">
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap");
        .font-cinzel { font-family: "Cinzel", serif; }
        .font-inter { font-family: "Inter", sans-serif; }
        .text-gold { color: #F5A623; }
        .bg-gold { background-color: #F5A623; }
        .border-gold { border-color: #F5A623; }
        .hero-gradient { background: linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.55), rgba(0,0,0,0.85)); }
        .gold-gradient-text {
          background: linear-gradient(to right, #F5A623, #f8d57e, #F5A623);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: goldShimmer 2.4s infinite;
        }
        @keyframes goldShimmer { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .floating { animation: floating 3s ease-in-out infinite; }
        @keyframes floating { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
        @keyframes slow-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        .animate-slow-pulse { animation: slow-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite; }
        .animate-slow-pulse:hover { animation: none; }
        @media (prefers-reduced-motion: reduce) {
          .floating, .gold-gradient-text, .animate-slow-pulse { animation: none !important; opacity: 1 !important; }
        }
      `}</style>

      {/* ── SECTION DOT INDICATOR ── */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden lg:block">
        <div className="flex flex-col items-center space-y-4">
          {SECTIONS.map((section) => (
            <button
              key={section}
              onClick={() => scrollToSection(section)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                activeSection === section ? "bg-gold w-4 h-4 shadow-lg shadow-[#F5A623]/30" : "bg-gray-500 hover:bg-[#F5A623]/50"
              }`}
              aria-label={`Scroll to ${section} section`}
            />
          ))}
          <div className="mt-2 text-gold">
            <Shield className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ── NAVBAR ── */}
      <header className="fixed top-0 left-0 w-full z-50 transition-all duration-500 bg-black/90 backdrop-blur-sm border-b border-[#F5A623]/20 py-2">
        <div className="w-full max-w-[1600px] mx-auto px-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center justify-items-center">
            {/* Logo */}
            <div
              onClick={() => scrollToSection("home")}
              className="flex items-center space-x-2 z-20 justify-self-start cursor-pointer"
            >
              <div className="relative w-14 h-16 md:w-16 md:h-20">
                <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" priority />
              </div>
              <span className="font-cinzel font-bold text-xl md:text-2xl text-white">
                VALIANT <span className="text-gold">LEAGUE</span>
              </span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center justify-center space-x-4">
              {NAV_LINKS.map((link) => (
                <Button
                  key={link.label}
                  variant={activeSection === link.section ? "default" : "outline"}
                  className={cn(
                    "font-cinzel text-base transition-all",
                    activeSection === link.section
                      ? "bg-gold hover:bg-[#F5A623]/90 text-black"
                      : "border-[#F5A623]/50 text-white hover:bg-[#F5A623]/10 hover:text-gold hover:border-gold"
                  )}
                  onClick={() => scrollToSection(link.section)}
                >
                  {link.label}
                </Button>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center justify-end space-x-4 justify-self-end">
              <div className="hidden md:flex items-center space-x-2">
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="text-gold hover:text-[#F5A623]/80">
                    <Twitter className="h-5 w-5" />
                  </Button>
                </a>
                <Button className="bg-gold hover:bg-[#F5A623]/90 text-black font-bold font-cinzel" onClick={() => handleNavigation("/admin")}>
                  Open the Console
                </Button>
              </div>

              <button className="md:hidden text-white hover:text-gold z-20" onClick={() => setIsNavOpen((v) => !v)} aria-label="Toggle menu">
                {isNavOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <div
          className={`md:hidden bg-black/95 border-t border-[#F5A623]/20 fixed top-[68px] left-0 w-full z-10 transition-all duration-300 ${
            isNavOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
          }`}
        >
          <div className="container mx-auto px-4 py-6">
            <nav className="flex flex-col space-y-4">
              {NAV_LINKS.map((link) => (
                <Button
                  key={link.label}
                  variant={activeSection === link.section ? "default" : "outline"}
                  className={cn(
                    "font-cinzel text-base w-full justify-start transition-all",
                    activeSection === link.section
                      ? "bg-gold hover:bg-[#F5A623]/90 text-black"
                      : "border-[#F5A623]/50 text-white hover:bg-[#F5A623]/10 hover:text-gold hover:border-gold"
                  )}
                  onClick={() => scrollToSection(link.section)}
                >
                  {link.label}
                </Button>
              ))}
              <Button
                className="bg-gold hover:bg-[#F5A623]/90 text-black font-bold font-cinzel w-full justify-start mt-2"
                onClick={() => { handleNavigation("/admin"); setIsNavOpen(false); }}
              >
                Open the Console
              </Button>
              <div className="pt-4 border-t border-[#F5A623]/20 flex justify-center">
                <a href="#" target="_blank" rel="noopener noreferrer" onClick={() => setIsNavOpen(false)}>
                  <Button variant="ghost" size="icon" className="text-gold hover:text-[#F5A623]/80">
                    <Twitter className="h-5 w-5" />
                  </Button>
                </a>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section id="home" className="relative min-h-screen flex items-center justify-center pt-28" ref={heroRef}>
        <div className="absolute inset-0 z-0">
          <Image src="/images/website-background.png" alt="Valiant League background" fill priority className="object-cover object-center" />
        </div>
        <div className="absolute inset-0 z-0 hero-gradient" />

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
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
                className="bg-gold hover:bg-[#F5A623]/90 text-black font-bold py-6 px-8 rounded-md text-lg animate-slow-pulse hover:scale-105 transition-all duration-500"
                onClick={() => scrollToSection("features")}
              >
                Explore the Platform
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="border-gold text-gold hover:bg-[#F5A623]/10 py-6 px-8 rounded-md text-lg animate-slow-pulse hover:scale-105 transition-all duration-500 bg-transparent"
                onClick={() => handleNavigation("/admin")}
              >
                <Shield className="mr-2 h-5 w-5" />
                Open the Console
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── PIXEL DIVIDER ── */}
      <div className="flex w-full">
        <div className="flex-1 h-[4px] bg-[#F5A623]" />
        <div className="flex-1 h-[4px] bg-[#0A0A0A]" />
        <div className="flex-1 h-[4px] bg-[#F5A623]" />
        <div className="flex-1 h-[4px] bg-[#0A0A0A]" />
        <div className="flex-1 h-[4px] bg-[#F5A623]" />
      </div>

      {/* ── LOGOS ── */}
      <section className="flex flex-col items-center w-full bg-[#0F0F0F] py-[48px] px-6 md:px-[120px] gap-[32px]">
        <span className="font-inter text-[11px] text-[#444444] tracking-[3px]">TRUSTED BY CLUBS LIKE</span>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-[64px] w-full">
          {logos.map((logo) => (
            <span key={logo} className="font-cinzel text-[13px] md:text-[14px] font-bold text-[#333333] tracking-[2px]">{logo}</span>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="flex flex-col w-full bg-[#0A0A0A] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]">
        <SectionHeader label="[01] // MODULES" title={"EVERY TOOL YOUR LEAGUE\nNEEDS. NOTHING IT DOESN'T."} subtitle="BUILT FOR MATCH DAY. TRUSTED BY LEAGUE OWNERS. READY FOR THE STREAM." />
        <div className="flex flex-col md:flex-row w-full gap-[2px]">
          <FeatureCard iconColor="#F5A623" title={"LIVE AUCTION\nROOM"} description="A REAL SHOT CLOCK, ENFORCED PURSES, AND A BID ROOM EVERY OWNER RUNS FROM THEIR OWN PHONE." tag="CORE" tagColor="#F5A623" borderColor="#F5A623" />
          <FeatureCard iconColor="#CD7F32" title={"AUTOMATIC\nBRACKETS"} description="SINGLE OR DOUBLE-ELIMINATION KNOCKOUTS, DRAWN FROM YOUR TEAMS AND UPDATED AS RESULTS COME IN." tag="LIVE" tagColor="#CD7F32" bgColor="#0F0F0F" borderColor="#CD7F32" />
          <FeatureCard iconColor="#F5F5F0" title={"BROADCAST\nOVERLAYS"} description="A TRANSPARENT, STREAM-READY LAYER — SCORE BAR, SCORECARD, BOUNDARIES, WEATHER — TOGGLED FROM THE CONSOLE." tag="STREAM" tagColor="#888888" borderColor="#555555" />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="flex flex-col w-full bg-[#0D0D0D] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]">
        <SectionHeader label="[02] // HOW IT WORKS" title={"THREE STEPS.\nONE CHAMPION."} />
        <div className="flex flex-col md:flex-row w-full gap-[2px]">
          <StepCard number="01" title={"BUILD THE\nROSTER"} description="ADD YOUR TEAMS AND THE PLAYER POOL WITH BASE PRICES." />
          <StepCard number="02" title={"RUN THE\nAUCTION"} description="OWNERS BID LIVE. THE CLOCK LOCKS IT. YOU HAMMER IT DOWN." bgColor="#111111" borderColor="#F5A623" borderWidth={1} />
          <StepCard number="03" title={"DRAW THE\nBRACKET"} description="MOVE STRAIGHT INTO A KNOCKOUT WITH THE TEAMS YOU JUST BUILT." />
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="flex flex-col w-full bg-[#F5A623] py-12 px-6 md:py-[80px] md:px-[120px]">
        <span className="font-inter text-[12px] font-bold text-[#0A0A0A] tracking-[3px]">[03] // BY THE NUMBERS</span>
        <div className="h-8 md:h-[32px]" />
        <div className="grid grid-cols-2 md:flex w-full gap-[2px] md:gap-0">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col gap-2 items-center justify-center py-6 md:py-0 md:h-[160px] md:flex-1
                ${stat.border ? "md:border-r-2 md:border-r-[#0A0A0A]" : ""}
                ${i === 0 ? "md:pr-[40px]" : i === stats.length - 1 ? "md:pl-[40px]" : "md:px-[40px]"}
                ${i % 2 === 0 ? "border-r-2 border-r-[#0A0A0A] pr-4 md:border-r-0 md:pr-0" : "pl-4 md:pl-0"}
                ${i >= 2 ? "border-t-2 border-t-[#0A0A0A] pt-4 md:border-t-0 md:pt-0" : ""}
              `}
            >
              <span className="font-cinzel text-[40px] md:text-[64px] font-bold text-[#0A0A0A] tracking-[-2px] leading-none">{stat.value}</span>
              <span className="font-inter text-[10px] md:text-[12px] font-bold text-[#1A1A1A] tracking-[2px]">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="flex flex-col w-full bg-[#0A0A0A] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]">
        <SectionHeader label="[04] // WHAT OWNERS SAY" title={"REAL LEAGUES.\nREAL AUCTIONS."} />
        <div className="flex flex-col md:flex-row w-full gap-[2px]">
          <TestimonialCard quote="VALIANT LEAGUE IS THE FIRST PLATFORM THAT ACTUALLY RESPECTS MATCH DAY. WE RAN THREE AUCTIONS IN SIX WEEKS." name="KGLIMITED" role="FOUNDER, THE WARDENS" accentColor="#F5A623" />
          <TestimonialCard quote="FINALLY A SYSTEM THAT DOESN'T FIGHT US. THE OVERLAYS ARE FLAWLESS. ZERO SETUP ON STREAM DAY." name="S7UID" role="ROYAL GUARD, THE WARDENS" bgColor="#0D0D0D" accentColor="#CD7F32" />
          <TestimonialCard quote="WE REPLACED FOUR SPREADSHEETS AND A DISCORD BOT. OWNER ONBOARDING DROPPED FROM TWO WEEKS TO TWO DAYS." name="VPOWERV" role="KNIGHT, THE WARDENS" accentColor="#F5F5F0" />
        </div>
      </section>

      {/* ── BENTO ── */}
      <section className="flex flex-col w-full bg-[#0D0D0D] py-16 px-6 md:py-[100px] md:px-[120px] gap-10 md:gap-[48px]">
        <SectionHeader label="[05] // CAPABILITIES" title={"THE FULL SEASON.\nIN ONE SYSTEM."} titleWidth="w-full max-w-[800px]" />
        <div className="flex flex-col w-full gap-[2px]">
          <div className="flex flex-col md:flex-row w-full gap-[2px]">
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#F5A623] w-full md:flex-1">
              <span className="font-inter text-[11px] font-bold text-[#1A1A1A] tracking-[2px]">[01]</span>
              <h3 className="font-cinzel text-[24px] md:text-[28px] font-bold text-[#0A0A0A] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"LIVE BID\nSYNC"}</h3>
              <p className="font-inter text-[12px] text-[#1A1A1A] tracking-[1px] leading-[1.6]">EVERY OWNER'S BID, INSTANTLY REFLECTED EVERYWHERE. THE AUCTION ROOM, THE OVERLAY, THE STANDINGS.</p>
              <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#0A0A0A] w-fit">
                <span className="font-inter text-[10px] font-bold text-[#F5A623] tracking-[2px]">[LIVE]</span>
              </div>
            </div>
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#111111] border border-[#2D2D2D] w-full md:flex-1">
              <span className="font-inter text-[11px] font-bold text-[#F5A623] tracking-[2px]">[02]</span>
              <h3 className="font-cinzel text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"RESULT\nHISTORY"}</h3>
              <p className="font-inter text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">EVERY MATCH LOGGED. ROLL BACK ANY ROUND IN &lt; 1 SECOND. RE-RUN A BRACKET IF YOU NEED TO.</p>
            </div>
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#0A0A0A] border border-[#2D2D2D] w-full md:flex-1">
              <span className="font-inter text-[11px] font-bold text-[#F5A623] tracking-[2px]">[03]</span>
              <h3 className="font-cinzel text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"OWNER\nCONSOLE"}</h3>
              <p className="font-inter text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">INVITE OWNERS, ASSIGN PURSES, AND MANAGE THE WHOLE LEAGUE FROM ONE DASHBOARD.</p>
              <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border border-[#CD7F32] w-fit">
                <span className="font-inter text-[10px] font-bold text-[#CD7F32] tracking-[2px]">[OPEN]</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row w-full gap-[2px]">
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#111111] border border-[#2D2D2D] w-full md:flex-1">
              <span className="font-inter text-[11px] font-bold text-[#F5A623] tracking-[2px]">[04]</span>
              <h3 className="font-cinzel text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"STREAM\nEXPORT"}</h3>
              <p className="font-inter text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">SCORE BAR // SCORECARD // BOUNDARIES // WEATHER. ONE CLICK. STRAIGHT INTO OBS.</p>
            </div>
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#0F0F0F] border-2 border-[#CD7F32] w-full md:flex-1">
              <span className="font-inter text-[11px] font-bold text-[#CD7F32] tracking-[2px]">[05]</span>
              <h3 className="font-cinzel text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"SMART\nSHUFFLE"}</h3>
              <p className="font-inter text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">A FAIR, RANDOM LOT ORDER AND BRACKET SEEDING, GENERATED IN ONE CLICK BEFORE YOU GO LIVE.</p>
              <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border border-[#CD7F32] w-fit">
                <span className="font-inter text-[10px] font-bold text-[#CD7F32] tracking-[2px]">[FAIR]</span>
              </div>
            </div>
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#0A0A0A] border border-[#2D2D2D] w-full md:flex-1">
              <span className="font-inter text-[11px] font-bold text-[#F5A623] tracking-[2px]">[06]</span>
              <h3 className="font-cinzel text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"LEAGUE\nANALYTICS"}</h3>
              <p className="font-inter text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">PURSE SPEND. BID VELOCITY. VIEWER COUNTS. ALL IN ONE DASHBOARD.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section id="comparison" className="flex flex-col w-full bg-[#050505] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]">
        <SectionHeader label="[06] // VS. THE REST" title={"WHY VALIANT LEAGUE\nWINS."} subtitle="SEE HOW WE STACK UP AGAINST RUNNING IT BY HAND. NO SPIN. JUST RESULTS." />

        <div className="hidden md:flex flex-col w-full border border-[#2D2D2D]">
          <div className="flex w-full h-[56px] bg-[#111111] border-b-2 border-b-[#F5A623]">
            <div className="flex items-center w-[400px] shrink-0 px-[32px] border-r border-r-[#2D2D2D]">
              <span className="font-cinzel text-[11px] font-bold text-[#888888] tracking-[2px]">FEATURE</span>
            </div>
            <div className="flex items-center flex-1 px-[32px] bg-[#1A1A1A] border-r border-r-[#2D2D2D]">
              <span className="font-cinzel text-[11px] font-bold text-[#F5A623] tracking-[2px]">VALIANT LEAGUE</span>
            </div>
            {["SPREADSHEET", "DISCORD BOT", "ZOOM CALL"].map((tool, i) => (
              <div key={tool} className={`flex items-center flex-1 px-[32px] ${i < 2 ? "border-r border-r-[#2D2D2D]" : ""}`}>
                <span className="font-cinzel text-[11px] font-bold text-[#555555] tracking-[2px]">{tool}</span>
              </div>
            ))}
          </div>

          {comparisonRows.map((row, i) => (
            <div key={row.feature} className={`flex w-full h-[56px] ${i < comparisonRows.length - 1 ? "border-b border-b-[#1D1D1D]" : ""}`}>
              <div className="flex items-center w-[400px] shrink-0 px-[32px] border-r border-r-[#2D2D2D]">
                <span className="font-inter text-[12px] text-[#CCCCCC] tracking-[1px]">{row.feature}</span>
              </div>
              <div className="flex items-center flex-1 px-[32px] bg-[#0D0D0D] border-r border-r-[#2D2D2D]">
                <span className="font-inter tracking-[1px] text-[#F5A623] font-bold text-[14px]">{row.pc}</span>
              </div>
              {[row.figma, row.sketch, row.framer].map((val, j) => (
                <div key={j} className={`flex items-center flex-1 px-[32px] ${j < 2 ? "border-r border-r-[#2D2D2D]" : ""}`}>
                  <span className={`font-inter tracking-[1px] ${cellStyle(val)} ${cellColor(val)}`}>{val}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col md:hidden w-full gap-[2px]">
          <div className="grid grid-cols-5 bg-[#111111] border border-[#F5A623] border-b-2">
            <div className="col-span-2 px-3 py-3"><span className="font-cinzel text-[9px] font-bold text-[#888888] tracking-[1px]">FEATURE</span></div>
            <div className="px-2 py-3 bg-[#1A1A1A]"><span className="font-cinzel text-[9px] font-bold text-[#F5A623] tracking-[1px]">VL</span></div>
            <div className="px-2 py-3"><span className="font-cinzel text-[9px] font-bold text-[#555555] tracking-[1px]">SHT</span></div>
            <div className="px-2 py-3"><span className="font-cinzel text-[9px] font-bold text-[#555555] tracking-[1px]">BOT</span></div>
          </div>
          {comparisonRows.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-5 border border-[#1D1D1D] ${i % 2 === 0 ? "bg-[#0A0A0A]" : "bg-[#0D0D0D]"}`}>
              <div className="col-span-2 flex items-center px-3 py-4"><span className="font-inter text-[9px] text-[#CCCCCC] tracking-[1px] leading-[1.4]">{row.feature}</span></div>
              <div className="flex items-center px-2 py-4 bg-[#0D0D0D]"><span className="font-inter text-[12px] text-[#F5A623] font-bold">{row.pc}</span></div>
              <div className="flex items-center px-2 py-4"><span className={`font-inter text-[11px] ${cellColor(row.figma)}`}>{row.figma}</span></div>
              <div className="flex items-center px-2 py-4"><span className={`font-inter text-[11px] ${cellColor(row.sketch)}`}>{row.sketch}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SHOWCASE ── */}
      <section id="showcase" className="flex flex-col w-full bg-[#080808] pt-16 md:pt-[100px] pb-0 gap-8 md:gap-[48px]">
        <div className="flex items-end justify-between px-6 md:px-[120px]">
          <SectionHeader label="[07] // SHOWCASE" title={"RUN ON\nVALIANT LEAGUE."} titleWidth="w-full max-w-[600px]" />
          <div className="flex items-center gap-[8px] shrink-0">
            <button onClick={showcasePrev} className="flex items-center justify-center w-[48px] h-[48px] bg-[#111111] border-2 border-[#3D3D3D] hover:border-[#888888] transition-colors">
              <span className="font-cinzel text-[18px] font-bold text-[#888888]">&lt;</span>
            </button>
            <button onClick={showcaseNext} className="flex items-center justify-center w-[48px] h-[48px] bg-[#F5A623] hover:bg-[#d6931f] transition-colors">
              <span className="font-cinzel text-[18px] font-bold text-[#0A0A0A]">&gt;</span>
            </button>
          </div>
        </div>

        <div className="md:hidden px-6">
          <div className="flex flex-col gap-5 p-6 border-2 w-full" style={{ backgroundColor: slide.bg, borderColor: slide.border }}>
            <div className="flex items-center justify-center h-[160px] bg-[#1A1A1A] border border-[#2D2D2D]">
              <span className="font-inter text-[11px] text-[#333333] tracking-[2px]">[SCREENSHOT]</span>
            </div>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center justify-center h-[24px] px-[10px] border" style={{ backgroundColor: slide.tagBg, borderColor: slide.tagBorder || "transparent" }}>
                <span className="font-inter text-[9px] font-bold tracking-[1px]" style={{ color: slide.tagColor }}>{slide.tag}</span>
              </div>
              <span className="font-inter text-[11px] tracking-[2px]" style={{ color: slide.idxColor }}>{slide.idx}</span>
            </div>
            <h3 className="font-cinzel text-[20px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">{slide.title}</h3>
            <p className="font-inter text-[11px] text-[#555555] tracking-[1px]">{slide.by}</p>
          </div>
        </div>

        <div className="hidden md:overflow-hidden h-[416px] md:block px-[120px]">
          <div className="flex gap-[2px] transition-transform duration-500 ease-in-out" style={{ transform: `translateX(calc(-${showcaseActive} * (560px + 2px)))` }}>
            {showcaseSlides.map((s, i) => (
              <div key={i} className="flex flex-col gap-[24px] p-[40px] h-[412px] w-[560px] shrink-0 border-2" style={{ backgroundColor: s.bg, borderColor: s.border }}>
                <div className="flex items-center justify-center h-[200px] bg-[#1A1A1A] border border-[#2D2D2D]">
                  <span className="font-inter text-[11px] text-[#333333] tracking-[2px]">[SCREENSHOT]</span>
                </div>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center justify-center h-[24px] px-[10px] border" style={{ backgroundColor: s.tagBg, borderColor: s.tagBorder || "transparent" }}>
                    <span className="font-inter text-[9px] font-bold tracking-[1px]" style={{ color: s.tagColor }}>{s.tag}</span>
                  </div>
                  <span className="font-inter text-[11px] tracking-[2px]" style={{ color: s.idxColor }}>{s.idx}</span>
                </div>
                <h3 className="font-cinzel text-[20px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">{s.title}</h3>
                <p className="font-inter text-[11px] text-[#555555] tracking-[1px]">{s.by}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-[8px] px-6 md:px-[120px]">
          {showcaseSlides.map((_, i) => (
            <button key={i} onClick={() => setShowcaseActive(i)} className="h-[4px] transition-all" style={{ width: i === showcaseActive ? 32 : 8, backgroundColor: i === showcaseActive ? "#F5A623" : "#333333" }} />
          ))}
        </div>

        <div className="flex items-center justify-between px-6 md:px-[120px] pb-16 md:pb-[100px]">
          <span className="font-inter text-[11px] text-[#444444] tracking-[2px]">SHOWING 0{showcaseActive + 1} OF 04 LEAGUES</span>
          <span className="font-inter text-[11px] text-[#F5A623] tracking-[2px] cursor-pointer hover:underline">VIEW ALL &gt;</span>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="flex flex-col w-full bg-[#060606] py-16 px-6 md:py-[100px] md:px-[120px]">
        <div className="w-full max-w-[480px]">
          <SectionHeader label="[08] // FAQ" title={"GOT\nQUESTIONS?"} subtitle="EVERYTHING YOU NEED TO KNOW BEFORE YOUR FIRST AUCTION." titleWidth="w-full" subtitleWidth="w-full" />
        </div>

        <div className="h-10 md:h-[64px]" />

        <div className="flex flex-col w-full">
          {faqs.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className="flex flex-col w-full border-t border-t-[#1D1D1D]">
                <button className="flex items-center justify-between w-full py-5 md:h-[72px] text-left gap-4" onClick={() => setOpenFaq(isOpen ? -1 : i)}>
                  <span className="font-cinzel text-[14px] md:text-[16px] font-bold text-[#F5F5F0] tracking-[1px]">{faq.question}</span>
                  <div className="flex items-center justify-center w-[32px] h-[32px] shrink-0" style={{ backgroundColor: isOpen ? "#F5A623" : "#1A1A1A", border: isOpen ? "none" : "1px solid #3D3D3D" }}>
                    <span className="font-inter text-[14px] font-bold" style={{ color: isOpen ? "#0A0A0A" : "#888888" }}>{isOpen ? "—" : "+"}</span>
                  </div>
                </button>
                {isOpen && faq.answer && (
                  <div className="pb-8">
                    <p className="font-inter text-[12px] md:text-[13px] text-[#888888] tracking-[1px] leading-[1.6]">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
          <div className="border-t border-t-[#1D1D1D]" />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-[16px] pt-10 md:pt-[48px]">
          <span className="font-inter text-[13px] text-[#555555] tracking-[1px]">STILL HAVE QUESTIONS?</span>
          <span className="font-inter text-[13px] font-bold text-[#F5A623] tracking-[1px] cursor-pointer hover:underline">TALK TO A HUMAN &gt;</span>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="flex flex-col w-full bg-[#080808] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]">
        <SectionHeader label="[09] // PRICING" title={"CHOOSE YOUR\nLEAGUE SIZE."} />
        <div className="flex flex-col md:flex-row w-full gap-[2px]">
          <PricingCard tier="FREE TIER" name="CASUAL" price="$0" btnLabel="GET STARTED FREE" features={CASUAL_FEATURES} accentColor="#555555" />
          <PricingCard
            tier="MOST POPULAR" tierColor="#0A0A0A" tierBg="#F5A623" tierBorderColor="#F5A623"
            name="CLUB" nameColor="#F5A623" price="$49" priceColor="#F5A623"
            btnLabel="START BUILDING" btnLabelColor="#0A0A0A" bgColor="#111111" borderColor="#F5A623" borderWidth={2}
            btnBg="#F5A623" btnBorderColor="transparent" features={CLUB_FEATURES} accentColor="#F5A623"
          />
          <PricingCard
            tier="FRANCHISE" tierColor="#CD7F32" tierBorderColor="#CD7F32"
            name="FRANCHISE" price="$149" btnLabel="CONTACT SALES" btnLabelColor="#CD7F32" btnBorderColor="#CD7F32"
            features={FRANCHISE_FEATURES} accentColor="#CD7F32"
          />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="flex flex-col items-center w-full bg-[#0A0A0A] py-16 px-6 md:p-[120px] gap-10 md:gap-[48px] border-t-2 border-t-[#F5A623]">
        <div className="flex items-center justify-center gap-[8px] h-[32px] px-[16px] bg-[#1A1A1A] border-2 border-[#F5A623]">
          <span className="font-inter text-[11px] font-bold text-[#F5A623] tracking-[2px]">
            <GlitchText text="[READY TO BID?]" speed={30} />
          </span>
        </div>

        <h2 className="font-cinzel text-[44px] md:text-[80px] font-bold text-[#F5F5F0] tracking-[-2px] leading-none text-center w-full max-w-[1000px] whitespace-pre-line">
          <GlitchText text={"STOP SPREADSHEETS.\nSTART AUCTIONS."} speed={40} delay={200} />
        </h2>

        <p className="font-inter text-[10px] md:text-[14px] text-[#666666] tracking-[0.5px] md:tracking-[2px] text-center text-pretty w-full max-w-[700px] px-2">
          <GlitchText text="JOIN 500+ LEAGUES WHO RUN THEIR SEASON LIVE, ON ONE PLATFORM." speed={20} delay={450} />
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-[16px] w-full sm:w-auto">
          <button className="flex items-center justify-center w-full sm:w-[260px] h-[64px] bg-[#F5A623] hover:bg-[#d6931f] transition-colors">
            <span className="font-cinzel text-[13px] font-bold text-[#0A0A0A] tracking-[2px]">OPEN THE CONSOLE — FREE</span>
          </button>
          <button className="flex items-center justify-center w-full sm:w-[220px] h-[64px] bg-[#0A0A0A] border-2 border-[#3D3D3D] hover:border-[#888888] transition-colors">
            <span className="font-inter text-[12px] text-[#666666] tracking-[2px]">SCHEDULE A DEMO</span>
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="flex flex-col w-full bg-[#050505]">
        <div className="flex flex-col md:flex-row gap-12 md:gap-[80px] px-6 md:px-[120px] py-12 md:py-[64px]">
          <div className="flex flex-col gap-6 md:w-[280px] md:shrink-0">
            <div className="flex items-center gap-[12px]">
              <div className="w-[32px] h-[32px] bg-[#F5A623] shrink-0" />
              <span className="font-cinzel text-[16px] font-bold text-[#F5A623] tracking-[3px]">VALIANT LEAGUE</span>
            </div>
            <p className="font-inter text-[11px] text-[#888888] tracking-[1px] leading-[1.6] max-w-[260px]">
              THE ALL-IN-ONE PLATFORM FOR RUNNING A CRICKET LEAGUE. BUILT FOR OWNERS WHO DON&apos;T COMPROMISE ON MATCH DAY.
            </p>
            <div className="flex gap-[12px]">
              {[{ label: "X" }, { label: "GH" }, { label: "LI" }].map((s) => (
                <button key={s.label} className="flex items-center justify-center w-[36px] h-[36px] bg-[#111111] border border-[#2D2D2D] hover:border-[#888888] transition-colors">
                  <span className="font-cinzel text-[10px] font-bold text-[#AAAAAA]">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 md:flex md:flex-1 gap-8 md:gap-[80px]">
            {[
              { heading: "PRODUCT", links: productLinks },
              { heading: "COMPANY", links: companyLinks },
              { heading: "RESOURCES", links: resourceLinks },
            ].map((col) => (
              <div key={col.heading} className="flex flex-col gap-4 md:gap-[20px]">
                <span className="font-cinzel text-[11px] font-bold text-[#F5F5F0] tracking-[2px]">{col.heading}</span>
                {col.links.map((link) => (
                  <a key={link} href="#" className="font-inter text-[12px] text-[#888888] tracking-[1px] hover:text-[#CCCCCC] transition-colors">{link}</a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full px-6 md:px-[120px] py-4 md:h-[56px] border-t border-t-[#1D1D1D] gap-3 sm:gap-0">
          <span className="font-inter text-[11px] text-[#666666] tracking-[1px]">© 2025 VALIANT LEAGUE. ALL RIGHTS RESERVED.</span>
          <div className="flex items-center gap-6 md:gap-[32px]">
            <a href="#" className="font-inter text-[11px] text-[#666666] tracking-[1px] hover:text-[#AAAAAA] transition-colors">PRIVACY</a>
            <a href="#" className="font-inter text-[11px] text-[#666666] tracking-[1px] hover:text-[#AAAAAA] transition-colors">TERMS</a>
            <span className="font-inter text-[11px] font-bold text-[#F5A623] tracking-[1px]">V2.0.1</span>
          </div>
        </div>
      </footer>
    </main>
  );
}