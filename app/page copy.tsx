"use client";

import { useEffect, useRef, useState } from "react";

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
      <span className="font-ibm-mono text-[10px] md:text-[12px] font-bold text-[#F5A623] tracking-[1.5px] md:tracking-[3px]">
        <GlitchText text={label} speed={30} />
      </span>
      <h2 className={`font-grotesk text-[36px] md:text-[56px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.05] whitespace-pre-line ${titleWidth}`}>
        <GlitchText text={title} speed={40} delay={150} />
      </h2>
      {subtitle && (
        <p className={`font-ibm-mono text-[10px] md:text-[13px] text-[#666666] tracking-[0.5px] md:tracking-[1px] leading-[1.6] text-pretty ${subtitleWidth}`}>
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
      <h3 className="font-grotesk text-[18px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">{title}</h3>
      <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">{description}</p>
      <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border w-fit" style={{ borderColor: tagColor }}>
        <span className="font-ibm-mono text-[11px] tracking-[2px]" style={{ color: tagColor }}>{tag}</span>
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
      <span className="font-grotesk text-[48px] font-bold text-[#F5A623] tracking-[-2px]">{number}</span>
      <h3 className="font-grotesk text-[20px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">{title}</h3>
      <p className="font-ibm-mono text-[11px] text-[#555555] tracking-[1px] leading-[1.5]">{description}</p>
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
      <p className="font-ibm-mono text-[13px] text-[#CCCCCC] tracking-[1px] leading-[1.6]">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-[12px]">
        <div className="w-[36px] h-[36px] rounded-full bg-[#333333] shrink-0" />
        <div className="flex flex-col gap-[2px]">
          <span className="font-grotesk text-[13px] font-bold text-[#F5F5F0] tracking-[1px]">{name}</span>
          <span className="font-ibm-mono text-[11px] text-[#555555] tracking-[1px]">{role}</span>
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
        <span className="font-ibm-mono text-[11px] tracking-[2px]" style={{ color: tierColor }}>{tier}</span>
      </div>
      <span className="font-grotesk text-[28px] font-bold tracking-[1px]" style={{ color: nameColor }}>{name}</span>
      <div className="flex items-end gap-[4px]">
        <span className="font-grotesk text-[48px] font-bold tracking-[-2px] leading-none" style={{ color: priceColor }}>{price}</span>
        <span className="font-ibm-mono text-[13px] text-[#555555] tracking-[1px] mb-[6px]">/MO</span>
      </div>
      <div className="flex flex-col gap-[10px]" style={{ borderTop: `1px solid ${borderColor === "#0F0F0F" ? "#2D2D2D" : borderColor}` }}>
        <div className="pt-6 flex flex-col gap-[10px]">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="font-ibm-mono text-[14px] leading-none shrink-0" style={{ color: f.included ? accentColor : "#333333" }}>
                {f.included ? "+" : "—"}
              </span>
              <span className="font-ibm-mono text-[11px] tracking-[1px]" style={{ color: f.included ? "#A0A09A" : "#3D3D3D" }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="flex items-center justify-center w-full h-[48px] mt-auto" style={{ backgroundColor: btnBg, border: `2px solid ${btnBorderColor}` }}>
        <span className="font-ibm-mono text-[12px] tracking-[2px]" style={{ color: btnLabelColor }}>{btnLabel}</span>
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
  { label: "MODULES", section: "features" },
  { label: "COMPARE", section: "comparison" },
  { label: "SHOWCASE", section: "showcase" },
  { label: "FAQ", section: "faq" },
  { label: "PRICING", section: "pricing" },
];

const layers = [
  { label: "FRAME / AUCTION ROOM", color: "#F5A623", indent: 0, active: true },
  { label: "TIMER BAR", color: "#888", indent: 12 },
  { label: "PLAYER CARD", color: "#4ADE80", indent: 12 },
  { label: "BID CONTROLS", color: "#888", indent: 12 },
  { label: "BTN GROUP", color: "#CD7F32", indent: 12 },
  { label: "BTN / PLACE BID", color: "#CD7F32", indent: 24 },
  { label: "BTN / PASS", color: "#888", indent: 24 },
  { label: "OWNER PURSE LIST", color: "#60A5FA", indent: 12 },
  { label: "OVERLAY BAR", color: "#888", indent: 0 },
];

const inspectProps = [
  { key: "W", val: "1100px" },
  { key: "H", val: "580px" },
  { key: "X", val: "0" },
  { key: "Y", val: "0" },
  { key: "FILL", val: "#0F0F0F", swatch: "#0F0F0F" },
  { key: "BORDER", val: "#F5A623", swatch: "#F5A623" },
  { key: "RADIUS", val: "0px" },
  { key: "OPACITY", val: "100%" },
];

const tokens = [
  { name: "gold", hex: "#F5A623" },
  { name: "bronze", hex: "#CD7F32" },
  { name: "surface", hex: "#111111" },
  { name: "text", hex: "#F5F5F0" },
  { name: "muted", hex: "#555555" },
];

const codeLines = [
  { w: 80, color: "#4ADE80", x: 325 },
  { w: 140, color: "#60A5FA", x: 345 },
  { w: 100, color: "#888", x: 355 },
  { w: 120, color: "#CD7F32", x: 345 },
  { w: 90, color: "#888", x: 355 },
  { w: 160, color: "#4ADE80", x: 355 },
  { w: 80, color: "#888", x: 345 },
  { w: 110, color: "#60A5FA", x: 325 },
];

const handles: [number, number][] = [
  [280, 90], [570, 90], [860, 90],
  [280, 280], [860, 280],
  [280, 470], [570, 470], [860, 470],
];

const tickerItems = ["AUCTION", "BRACKET", "OVERLAY", "TIMER", "BID", "SQUAD", "PURSE", "KNOCKOUT", "SCOREBOARD", "TROPHY"];

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

const CURSOR_DEFS = [
  { name: "OWNER: RAJ", color: "#F5A623", top: "18%", left: "8%", delay: "0s" },
  { name: "OWNER: MILO", color: "#CD7F32", top: "62%", left: "88%", delay: "1.4s" },
  { name: "OWNER: ZARA", color: "#60A5FA", top: "40%", left: "72%", delay: "2.6s" },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ════════════════════════════════════════════════════════════════════
   PAGE — everything below is one-time-use, so it's all inlined
   directly into this single component instead of being split into
   separate Navbar/Hero/Features/... components.
   ════════════════════════════════════════════════════════════════════ */

export default function Home() {
  // Hero
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Navbar
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.section).filter(Boolean);
    const observers: IntersectionObserver[] = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const o = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActiveNav(id); }, { rootMargin: "-35% 0px -60% 0px" });
      o.observe(el);
      observers.push(o);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // Showcase
  const [showcaseActive, setShowcaseActive] = useState(1);
  const showcasePrev = () => setShowcaseActive((p) => Math.max(0, p - 1));
  const showcaseNext = () => setShowcaseActive((p) => Math.min(showcaseSlides.length - 1, p + 1));
  const slide = showcaseSlides[showcaseActive];

  // FAQ
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="flex flex-col w-full bg-[#0A0A0A] pt-[60px]">
      {/* ── NAVBAR ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(10,10,10,0.88)" : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
          borderBottom: scrolled ? "1px solid #1E1E1E" : "1px solid transparent",
        }}
      >
        <div className="flex items-center justify-between h-[60px] px-6 md:px-[48px] max-w-[1400px] mx-auto">
          <a href="#" className="flex items-center gap-[10px] shrink-0 group">
            <span className="w-[10px] h-[10px] bg-[#F5A623] group-hover:scale-110 transition-transform" />
            <span className="font-grotesk text-[13px] font-bold text-[#F5F5F0] tracking-[2.5px]">VALIANT LEAGUE</span>
          </a>

          <nav className="hidden md:flex items-center gap-[36px]">
            {NAV_LINKS.map(({ label, section }) => {
              const isActive = activeNav === section;
              return (
                <button
                  key={label}
                  onClick={() => scrollToId(section)}
                  className="relative font-ibm-mono text-[10px] tracking-[1.5px] transition-colors duration-150 bg-transparent border-none cursor-pointer"
                  style={{ color: isActive ? "#F5A623" : "#555" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#F5F5F0"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = isActive ? "#F5A623" : "#555"; }}
                >
                  {label}
                  <span className="absolute left-0 -bottom-[3px] h-[1.5px] bg-[#F5A623] transition-all duration-300" style={{ width: isActive ? "100%" : "0%" }} />
                </button>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-[14px]">
            <a href="#" className="font-ibm-mono text-[10px] text-[#555] tracking-[1.5px] hover:text-[#F5F5F0] transition-colors">LOG IN</a>
            <a href="#" className="font-grotesk text-[11px] font-bold text-[#0A0A0A] bg-[#F5A623] tracking-[1.5px] px-[18px] py-[9px] hover:bg-[#F5F5F0] transition-colors">OPEN THE CONSOLE</a>
          </div>

          <button className="md:hidden flex flex-col gap-[5px] p-2 -mr-2" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
            <span className="block w-[20px] h-[1.5px] bg-[#F5F5F0] transition-transform duration-200 origin-center" style={{ transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none" }} />
            <span className="block w-[20px] h-[1.5px] bg-[#F5F5F0] transition-opacity duration-200" style={{ opacity: menuOpen ? 0 : 1 }} />
            <span className="block w-[20px] h-[1.5px] bg-[#F5F5F0] transition-transform duration-200 origin-center" style={{ transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none" }} />
          </button>
        </div>

        <div
          className="md:hidden overflow-hidden transition-all duration-300"
          style={{ maxHeight: menuOpen ? "400px" : "0px", background: "rgba(10,10,10,0.97)", backdropFilter: "blur(14px)", borderBottom: menuOpen ? "1px solid #1E1E1E" : "none" }}
        >
          <nav className="flex flex-col px-6 py-5 gap-0">
            {NAV_LINKS.map(({ label, section }) => {
              const isActive = activeNav === section;
              return (
                <button
                  key={label}
                  onClick={() => { scrollToId(section); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full font-ibm-mono text-[12px] tracking-[2px] py-[14px] border-b border-[#141414] transition-colors bg-transparent border-x-0 border-t-0 cursor-pointer"
                  style={{ color: isActive ? "#F5A623" : "#666" }}
                >
                  <span className="w-[4px] h-[4px] rounded-full shrink-0 transition-colors" style={{ background: isActive ? "#F5A623" : "#2D2D2D" }} />
                  {label}
                </button>
              );
            })}
            <div className="flex flex-col gap-[10px] pt-5">
              <a href="#" className="font-ibm-mono text-[12px] text-[#555] tracking-[1.5px]">LOG IN</a>
              <a href="#" className="font-grotesk text-[11px] font-bold text-[#0A0A0A] bg-[#F5A623] tracking-[1.5px] px-[18px] py-[11px] text-center hover:bg-[#F5F5F0] transition-colors">OPEN THE CONSOLE</a>
            </div>
          </nav>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center w-full bg-[#0A0A0A] py-16 px-6 md:py-[100px] md:px-[120px] overflow-hidden">
        <div className="flex items-center justify-center gap-[8px] h-[32px] px-[12px] md:px-[16px] bg-[#1A1A1A] border-2 border-[#F5A623]">
          <div className="w-[8px] h-[8px] bg-[#F5A623] shrink-0" />
          <span className="font-ibm-mono text-[9px] md:text-[11px] font-bold text-[#F5A623] tracking-[1px] md:tracking-[2px] whitespace-nowrap">[LIVE] // SEASON 2 AUCTIONS NOW OPEN</span>
        </div>

        <div className="h-8 md:h-[32px]" />

        <h1 className="font-grotesk text-[clamp(32px,10vw,96px)] font-bold text-[#F5F5F0] tracking-[-1px] leading-none text-center w-full max-w-[1100px]">
          <GlitchText text="DRAFT THE ROSTER." speed={45} delay={100} />
          <br />
          <GlitchText text="RUN THE AUCTION." speed={45} delay={400} />
        </h1>
        <h1 className="font-grotesk text-[clamp(32px,10vw,96px)] font-bold text-[#F5A623] tracking-[-1px] leading-none text-center w-full max-w-[1100px]">
          <GlitchText text="CROWN THE CHAMPION." speed={45} delay={700} />
        </h1>

        <div className="h-8 md:h-[32px]" />

        <p className="font-ibm-mono text-[13px] md:text-[15px] text-[#888888] tracking-[1px] leading-[1.6] text-center w-full max-w-[800px]">
          THE ALL-IN-ONE PLATFORM FOR RUNNING A CRICKET LEAGUE.
          <br />
          FROM THE LIVE AUCTION TO LIFTING THE TROPHY.
        </p>

        <div className="h-10 md:h-[48px]" />

        <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-[16px] w-full sm:w-auto">
          <button className="flex items-center justify-center w-full sm:w-[220px] h-[56px] bg-[#F5A623] hover:bg-[#d6931f] transition-colors">
            <span className="font-grotesk text-[12px] font-bold text-[#0A0A0A] tracking-[2px]">OPEN THE CONSOLE</span>
          </button>
          <button className="flex items-center justify-center w-full sm:w-[200px] h-[56px] bg-[#0A0A0A] border-2 border-[#3D3D3D] hover:border-[#888888] transition-colors">
            <span className="font-ibm-mono text-[12px] text-[#888888] tracking-[2px]">WATCH A DEMO &gt;</span>
          </button>
        </div>

        <div className="h-6 md:h-[24px]" />

        <p className="font-ibm-mono text-[11px] text-[#555555] tracking-[2px] text-center">NO CREDIT CARD // FREE CASUAL TIER // 500+ LEAGUES RUN</p>

        <div className="h-12 md:h-[64px]" />

        <div className="w-full max-w-[1100px] bg-[#0F0F0F] overflow-hidden" style={{ border: "2px solid #2D2D2D" }}>
          <style>{`
            @keyframes hero-blink { 0%,100%{opacity:1} 50%{opacity:0} }
            @keyframes hero-scan { 0%{transform:translateY(-580px)} 100%{transform:translateY(580px)} }
            @keyframes hero-pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
            @keyframes hero-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-700px)} }
            .hero-cursor { animation: hero-blink 1.1s step-end infinite; }
            .hero-scan { animation: hero-scan 4s linear infinite; }
            .hero-pulse { animation: hero-pulse 2s ease-in-out infinite; }
            .hero-ticker-track { animation: hero-ticker 14s linear infinite; }
          `}</style>

          <svg viewBox="0 0 1100 580" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%", height: "auto" }}>
            <rect width="1100" height="580" fill="#0F0F0F" />
            <rect className="hero-scan" x="0" y="0" width="1100" height="6" fill="rgba(245,166,35,0.03)" />

            {Array.from({ length: 22 }, (_, c) =>
              Array.from({ length: 12 }, (_, r) => (
                <circle key={`d${c}-${r}`} cx={c * 50 + 25} cy={r * 50 + 25} r="1" fill="#1A1A1A" />
              ))
            )}

            <rect x="0" y="0" width="200" height="580" fill="#111111" />
            <line x1="200" y1="0" x2="200" y2="580" stroke="#2D2D2D" strokeWidth="1" />

            <rect x="0" y="0" width="200" height="36" fill="#161616" />
            <text x="12" y="23" fontFamily="monospace" fontSize="9" fill="#F5A623" letterSpacing={2} fontWeight="700">LAYERS</text>
            <text x="176" y="23" fontFamily="monospace" fontSize="12" fill="#444">+</text>

            {layers.map((l, i) => {
              const y = 36 + i * 32;
              return (
                <g key={i} style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(6px)", transition: `opacity 0.4s ease ${i * 0.08}s, transform 0.4s ease ${i * 0.08}s` }}>
                  {l.active && <rect x="0" y={y} width="200" height="32" fill="#1E1E1E" />}
                  {l.active && <rect x="0" y={y} width="2" height="32" fill="#F5A623" />}
                  <circle cx={20 + l.indent} cy={y + 16} r="3" fill={l.color} opacity="0.8" />
                  <text x={32 + l.indent} y={y + 20} fontFamily="monospace" fontSize="9" fill={l.active ? "#F5F5F0" : "#555"} letterSpacing={0.5}>{l.label}</text>
                </g>
              );
            })}

            <rect x="899" y="0" width="201" height="580" fill="#111111" />
            <line x1="899" y1="0" x2="899" y2="580" stroke="#2D2D2D" strokeWidth="1" />
            <rect x="899" y="0" width="201" height="36" fill="#161616" />
            <text x="912" y="23" fontFamily="monospace" fontSize="9" fill="#F5A623" letterSpacing={2} fontWeight="700">INSPECT</text>

            {inspectProps.map((p, i) => {
              const y = 56 + i * 26;
              return (
                <g key={i} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.4s ease ${0.1 + i * 0.06}s` }}>
                  <text x="912" y={y} fontFamily="monospace" fontSize="8" fill="#555" letterSpacing={1}>{p.key}</text>
                  {p.swatch && <rect x="970" y={y - 9} width="10" height="10" fill={p.swatch} rx="1" />}
                  <text x={p.swatch ? "986" : "970"} y={y} fontFamily="monospace" fontSize="8" fill="#888" letterSpacing={0.5}>{p.val}</text>
                </g>
              );
            })}

            <line x1="899" y1="278" x2="1100" y2="278" stroke="#222" strokeWidth="1" />
            <text x="912" y="300" fontFamily="monospace" fontSize="9" fill="#F5A623" letterSpacing={2} fontWeight="700">TOKENS</text>

            {tokens.map((t, i) => {
              const y = 316 + i * 28;
              return (
                <g key={i}>
                  <rect x="912" y={y} width="12" height="12" fill={t.hex} rx="1" />
                  <text x="932" y={y + 10} fontFamily="monospace" fontSize="8" fill="#666" letterSpacing={0.5}>{t.name}</text>
                  <text x="990" y={y + 10} fontFamily="monospace" fontSize="8" fill="#444" letterSpacing={0.5}>{t.hex}</text>
                </g>
              );
            })}

            <rect x="200" y="0" width="700" height="36" fill="#141414" />
            <line x1="200" y1="36" x2="900" y2="36" stroke="#2D2D2D" strokeWidth="1" />

            {["V", "F", "T", "P"].map((label, t) => (
              <g key={t}>
                <rect x={218 + t * 28} y="9" width="18" height="18" rx="2" fill={t === 0 ? "#F5A623" : "#1E1E1E"} />
                <text x={223 + t * 28} y="22" fontFamily="monospace" fontSize="9" fill={t === 0 ? "#0A0A0A" : "#444"}>{label}</text>
              </g>
            ))}
            <line x1="340" y1="11" x2="340" y2="25" stroke="#2D2D2D" strokeWidth="1" />
            <text x="356" y="23" fontFamily="monospace" fontSize="9" fill="#555" letterSpacing={1}>100%</text>

            <rect x="200" y="36" width="700" height="16" fill="#131313" />
            {Array.from({ length: 35 }, (_, i) => (
              <g key={`rh${i}`}>
                <rect x={200 + i * 20} y="36" width="1" height={i % 5 === 0 ? 8 : 4} fill="#2A2A2A" />
                {i % 5 === 0 && <text x={202 + i * 20} y="50" fontFamily="monospace" fontSize="6" fill="#333">{i * 20}</text>}
              </g>
            ))}
            <rect x="200" y="52" width="16" height="528" fill="#131313" />
            {Array.from({ length: 26 }, (_, i) => (
              <rect key={`rv${i}`} x="200" y={52 + i * 20} width={i % 5 === 0 ? 8 : 4} height="1" fill="#2A2A2A" />
            ))}

            <rect x="280" y="90" width="540" height="380" fill="#0A0A0A" stroke="#F5A623" strokeWidth="1.5" strokeDasharray="4 2" />
            <text x="280" y="84" fontFamily="monospace" fontSize="8" fill="#F5A623" letterSpacing={1}>FRAME / AUCTION ROOM — 1100 x 580</text>

            {handles.map(([hx, hy], i) => (
              <rect key={`h${i}`} x={hx - 3} y={hy - 3} width="6" height="6" fill="#F5A623" stroke="#0A0A0A" strokeWidth="1" />
            ))}

            <rect x="280" y="90" width="540" height="36" fill="#111111" />
            <line x1="280" y1="126" x2="820" y2="126" stroke="#2D2D2D" strokeWidth="1" />
            <rect x="295" y="102" width="44" height="10" rx="1" fill="#F5A623" opacity="0.9" />
            <rect x="640" y="103" width="28" height="8" rx="1" fill="#222" />
            <rect x="676" y="103" width="28" height="8" rx="1" fill="#222" />
            <rect x="715" y="101" width="38" height="12" fill="#F5A623" />

            <rect x="310" y="148" width="300" height="18" rx="1" fill="#F5F5F0" opacity="0.9" />
            <rect x="310" y="172" width="220" height="18" rx="1" fill="#F5A623" opacity="0.9" />

            <rect x="310" y="204" width="240" height="5" rx="1" fill="#444" />
            <rect x="310" y="215" width="200" height="5" rx="1" fill="#333" />

            <rect x="310" y="236" width="100" height="24" fill="#F5A623" />
            <text x="325" y="252" fontFamily="monospace" fontSize="7" fill="#0A0A0A" fontWeight="700" letterSpacing={0.5}>PLACE BID</text>
            <rect x="418" y="236" width="90" height="24" fill="none" stroke="#3D3D3D" strokeWidth="1.5" />
            <text x="430" y="252" fontFamily="monospace" fontSize="7" fill="#555" letterSpacing={0.5}>PASS</text>

            <rect x="310" y="280" width="490" height="168" fill="#161616" stroke="#222" strokeWidth="1" />
            <rect x="310" y="280" width="490" height="18" fill="#1A1A1A" />
            <circle cx="322" cy="289" r="3" fill="#FF5F57" />
            <circle cx="332" cy="289" r="3" fill="#FEBC2E" />
            <circle cx="342" cy="289" r="3" fill="#28C840" />
            <text x="360" y="293" fontFamily="monospace" fontSize="7" fill="#333" letterSpacing={1}>console.tsx — Valiant League</text>

            {codeLines.map((cl, i) => (
              <rect key={`cl${i}`} x={cl.x} y={308 + i * 16} width={cl.w} height="5" rx="1" fill={cl.color} opacity="0.35" />
            ))}

            <rect className="hero-cursor" x="465" y="340" width="6" height="10" fill="#F5A623" opacity="0.9" />

            <line x1="820" y1="148" x2="860" y2="148" stroke="#CD7F32" strokeWidth="0.75" strokeDasharray="3 2" />
            <line x1="820" y1="190" x2="860" y2="190" stroke="#CD7F32" strokeWidth="0.75" strokeDasharray="3 2" />
            <line x1="850" y1="148" x2="850" y2="190" stroke="#CD7F32" strokeWidth="0.75" />
            <text x="835" y="173" fontFamily="monospace" fontSize="7" fill="#CD7F32" letterSpacing={0.5}>42px</text>

            <line x1="310" y1="226" x2="310" y2="236" stroke="#60A5FA" strokeWidth="0.75" strokeDasharray="2 2" />
            <line x1="410" y1="226" x2="410" y2="236" stroke="#60A5FA" strokeWidth="0.75" strokeDasharray="2 2" />
            <text x="345" y="233" fontFamily="monospace" fontSize="7" fill="#60A5FA" letterSpacing={0.5}>12px</text>

            <line x1="200" y1="514" x2="900" y2="514" stroke="#2D2D2D" strokeWidth="1" />
            <rect x="200" y="515" width="700" height="32" fill="#0F0F0F" />
            <clipPath id="tickerClip">
              <rect x="200" y="515" width="700" height="32" />
            </clipPath>
            <g clipPath="url(#tickerClip)">
              <g className="hero-ticker-track">
                {[...tickerItems, ...tickerItems].map((name, i) => (
                  <g key={`t${i}`}>
                    <circle cx={220 + i * 70} cy="531" r="3" fill="#F5A623" opacity="0.5" />
                    <text x={230 + i * 70} y="535" fontFamily="monospace" fontSize="8" fill="#444" letterSpacing={1.5}>{name}</text>
                  </g>
                ))}
              </g>
            </g>

            <line x1="200" y1="547" x2="900" y2="547" stroke="#222" strokeWidth="1" />
            <rect x="200" y="548" width="700" height="32" fill="#0D0D0D" />
            <circle className="hero-pulse" cx="220" cy="564" r="4" fill="#4ADE80" />
            <text x="232" y="568" fontFamily="monospace" fontSize="8" fill="#555" letterSpacing={1}>LIVE</text>
            <text x="330" y="568" fontFamily="monospace" fontSize="8" fill="#333" letterSpacing={1}>9 MODULES</text>
            <text x="430" y="568" fontFamily="monospace" fontSize="8" fill="#333" letterSpacing={1}>AUCTION SYNCED</text>
            <text x="600" y="568" fontFamily="monospace" fontSize="8" fill="#333" letterSpacing={1}>8 TEAMS LOADED</text>
            <text x="730" y="568" fontFamily="monospace" fontSize="8" fill="#333" letterSpacing={1}>v2.0.1</text>

            <rect x="200" y="548" width="6" height="6" fill="#F5A623" opacity="0.5" />
            <rect x="894" y="548" width="6" height="6" fill="#CD7F32" opacity="0.4" />
          </svg>
        </div>

        {/* Collab cursors */}
        <div className="pointer-events-none absolute inset-0 hidden md:block overflow-hidden">
          <style>{`
            @keyframes cursor-drift {
              0%   { transform: translate(0, 0); opacity: 0; }
              10%  { opacity: 1; }
              50%  { transform: translate(24px, -16px); }
              90%  { opacity: 1; }
              100% { transform: translate(0, 0); opacity: 0; }
            }
            .collab-cursor { animation: cursor-drift 6s ease-in-out infinite; }
          `}</style>
          {CURSOR_DEFS.map((c) => (
            <div key={c.name} className="collab-cursor absolute flex items-center gap-[6px]" style={{ top: c.top, left: c.left, animationDelay: c.delay }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 1L15 7L8 8.5L6.5 15L1 1Z" fill={c.color} stroke="#0A0A0A" strokeWidth="1" />
              </svg>
              <span className="font-ibm-mono text-[9px] font-bold text-[#0A0A0A] tracking-[1px] px-[6px] py-[2px]" style={{ backgroundColor: c.color }}>
                {c.name}
              </span>
            </div>
          ))}
        </div>
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
        <span className="font-ibm-mono text-[11px] text-[#444444] tracking-[3px]">TRUSTED BY CLUBS LIKE</span>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-[64px] w-full">
          {logos.map((logo) => (
            <span key={logo} className="font-grotesk text-[13px] md:text-[14px] font-bold text-[#333333] tracking-[2px]">{logo}</span>
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
        <span className="font-ibm-mono text-[12px] font-bold text-[#0A0A0A] tracking-[3px]">[03] // BY THE NUMBERS</span>
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
              <span className="font-grotesk text-[40px] md:text-[64px] font-bold text-[#0A0A0A] tracking-[-2px] leading-none">{stat.value}</span>
              <span className="font-ibm-mono text-[10px] md:text-[12px] font-bold text-[#1A1A1A] tracking-[2px]">{stat.label}</span>
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
              <span className="font-ibm-mono text-[11px] font-bold text-[#1A1A1A] tracking-[2px]">[01]</span>
              <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#0A0A0A] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"LIVE BID\nSYNC"}</h3>
              <p className="font-ibm-mono text-[12px] text-[#1A1A1A] tracking-[1px] leading-[1.6]">EVERY OWNER'S BID, INSTANTLY REFLECTED EVERYWHERE. THE AUCTION ROOM, THE OVERLAY, THE STANDINGS.</p>
              <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#0A0A0A] w-fit">
                <span className="font-ibm-mono text-[10px] font-bold text-[#F5A623] tracking-[2px]">[LIVE]</span>
              </div>
            </div>
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#111111] border border-[#2D2D2D] w-full md:flex-1">
              <span className="font-ibm-mono text-[11px] font-bold text-[#F5A623] tracking-[2px]">[02]</span>
              <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"RESULT\nHISTORY"}</h3>
              <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">EVERY MATCH LOGGED. ROLL BACK ANY ROUND IN &lt; 1 SECOND. RE-RUN A BRACKET IF YOU NEED TO.</p>
            </div>
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#0A0A0A] border border-[#2D2D2D] w-full md:flex-1">
              <span className="font-ibm-mono text-[11px] font-bold text-[#F5A623] tracking-[2px]">[03]</span>
              <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"OWNER\nCONSOLE"}</h3>
              <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">INVITE OWNERS, ASSIGN PURSES, AND MANAGE THE WHOLE LEAGUE FROM ONE DASHBOARD.</p>
              <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border border-[#CD7F32] w-fit">
                <span className="font-ibm-mono text-[10px] font-bold text-[#CD7F32] tracking-[2px]">[OPEN]</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row w-full gap-[2px]">
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#111111] border border-[#2D2D2D] w-full md:flex-1">
              <span className="font-ibm-mono text-[11px] font-bold text-[#F5A623] tracking-[2px]">[04]</span>
              <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"STREAM\nEXPORT"}</h3>
              <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">SCORE BAR // SCORECARD // BOUNDARIES // WEATHER. ONE CLICK. STRAIGHT INTO OBS.</p>
            </div>
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#0F0F0F] border-2 border-[#CD7F32] w-full md:flex-1">
              <span className="font-ibm-mono text-[11px] font-bold text-[#CD7F32] tracking-[2px]">[05]</span>
              <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"SMART\nSHUFFLE"}</h3>
              <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">A FAIR, RANDOM LOT ORDER AND BRACKET SEEDING, GENERATED IN ONE CLICK BEFORE YOU GO LIVE.</p>
              <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border border-[#CD7F32] w-fit">
                <span className="font-ibm-mono text-[10px] font-bold text-[#CD7F32] tracking-[2px]">[FAIR]</span>
              </div>
            </div>
            <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#0A0A0A] border border-[#2D2D2D] w-full md:flex-1">
              <span className="font-ibm-mono text-[11px] font-bold text-[#F5A623] tracking-[2px]">[06]</span>
              <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">{"LEAGUE\nANALYTICS"}</h3>
              <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">PURSE SPEND. BID VELOCITY. VIEWER COUNTS. ALL IN ONE DASHBOARD.</p>
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
              <span className="font-grotesk text-[11px] font-bold text-[#888888] tracking-[2px]">FEATURE</span>
            </div>
            <div className="flex items-center flex-1 px-[32px] bg-[#1A1A1A] border-r border-r-[#2D2D2D]">
              <span className="font-grotesk text-[11px] font-bold text-[#F5A623] tracking-[2px]">VALIANT LEAGUE</span>
            </div>
            {["SPREADSHEET", "DISCORD BOT", "ZOOM CALL"].map((tool, i) => (
              <div key={tool} className={`flex items-center flex-1 px-[32px] ${i < 2 ? "border-r border-r-[#2D2D2D]" : ""}`}>
                <span className="font-grotesk text-[11px] font-bold text-[#555555] tracking-[2px]">{tool}</span>
              </div>
            ))}
          </div>

          {comparisonRows.map((row, i) => (
            <div key={row.feature} className={`flex w-full h-[56px] ${i < comparisonRows.length - 1 ? "border-b border-b-[#1D1D1D]" : ""}`}>
              <div className="flex items-center w-[400px] shrink-0 px-[32px] border-r border-r-[#2D2D2D]">
                <span className="font-ibm-mono text-[12px] text-[#CCCCCC] tracking-[1px]">{row.feature}</span>
              </div>
              <div className="flex items-center flex-1 px-[32px] bg-[#0D0D0D] border-r border-r-[#2D2D2D]">
                <span className="font-ibm-mono tracking-[1px] text-[#F5A623] font-bold text-[14px]">{row.pc}</span>
              </div>
              {[row.figma, row.sketch, row.framer].map((val, j) => (
                <div key={j} className={`flex items-center flex-1 px-[32px] ${j < 2 ? "border-r border-r-[#2D2D2D]" : ""}`}>
                  <span className={`font-ibm-mono tracking-[1px] ${cellStyle(val)} ${cellColor(val)}`}>{val}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col md:hidden w-full gap-[2px]">
          <div className="grid grid-cols-5 bg-[#111111] border border-[#F5A623] border-b-2">
            <div className="col-span-2 px-3 py-3"><span className="font-grotesk text-[9px] font-bold text-[#888888] tracking-[1px]">FEATURE</span></div>
            <div className="px-2 py-3 bg-[#1A1A1A]"><span className="font-grotesk text-[9px] font-bold text-[#F5A623] tracking-[1px]">VL</span></div>
            <div className="px-2 py-3"><span className="font-grotesk text-[9px] font-bold text-[#555555] tracking-[1px]">SHT</span></div>
            <div className="px-2 py-3"><span className="font-grotesk text-[9px] font-bold text-[#555555] tracking-[1px]">BOT</span></div>
          </div>
          {comparisonRows.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-5 border border-[#1D1D1D] ${i % 2 === 0 ? "bg-[#0A0A0A]" : "bg-[#0D0D0D]"}`}>
              <div className="col-span-2 flex items-center px-3 py-4"><span className="font-ibm-mono text-[9px] text-[#CCCCCC] tracking-[1px] leading-[1.4]">{row.feature}</span></div>
              <div className="flex items-center px-2 py-4 bg-[#0D0D0D]"><span className="font-ibm-mono text-[12px] text-[#F5A623] font-bold">{row.pc}</span></div>
              <div className="flex items-center px-2 py-4"><span className={`font-ibm-mono text-[11px] ${cellColor(row.figma)}`}>{row.figma}</span></div>
              <div className="flex items-center px-2 py-4"><span className={`font-ibm-mono text-[11px] ${cellColor(row.sketch)}`}>{row.sketch}</span></div>
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
              <span className="font-grotesk text-[18px] font-bold text-[#888888]">&lt;</span>
            </button>
            <button onClick={showcaseNext} className="flex items-center justify-center w-[48px] h-[48px] bg-[#F5A623] hover:bg-[#d6931f] transition-colors">
              <span className="font-grotesk text-[18px] font-bold text-[#0A0A0A]">&gt;</span>
            </button>
          </div>
        </div>

        <div className="md:hidden px-6">
          <div className="flex flex-col gap-5 p-6 border-2 w-full" style={{ backgroundColor: slide.bg, borderColor: slide.border }}>
            <div className="flex items-center justify-center h-[160px] bg-[#1A1A1A] border border-[#2D2D2D]">
              <span className="font-ibm-mono text-[11px] text-[#333333] tracking-[2px]">[SCREENSHOT]</span>
            </div>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center justify-center h-[24px] px-[10px] border" style={{ backgroundColor: slide.tagBg, borderColor: slide.tagBorder || "transparent" }}>
                <span className="font-ibm-mono text-[9px] font-bold tracking-[1px]" style={{ color: slide.tagColor }}>{slide.tag}</span>
              </div>
              <span className="font-ibm-mono text-[11px] tracking-[2px]" style={{ color: slide.idxColor }}>{slide.idx}</span>
            </div>
            <h3 className="font-grotesk text-[20px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">{slide.title}</h3>
            <p className="font-ibm-mono text-[11px] text-[#555555] tracking-[1px]">{slide.by}</p>
          </div>
        </div>

        <div className="hidden md:overflow-hidden h-[416px] md:block px-[120px]">
          <div className="flex gap-[2px] transition-transform duration-500 ease-in-out" style={{ transform: `translateX(calc(-${showcaseActive} * (560px + 2px)))` }}>
            {showcaseSlides.map((s, i) => (
              <div key={i} className="flex flex-col gap-[24px] p-[40px] h-[412px] w-[560px] shrink-0 border-2" style={{ backgroundColor: s.bg, borderColor: s.border }}>
                <div className="flex items-center justify-center h-[200px] bg-[#1A1A1A] border border-[#2D2D2D]">
                  <span className="font-ibm-mono text-[11px] text-[#333333] tracking-[2px]">[SCREENSHOT]</span>
                </div>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center justify-center h-[24px] px-[10px] border" style={{ backgroundColor: s.tagBg, borderColor: s.tagBorder || "transparent" }}>
                    <span className="font-ibm-mono text-[9px] font-bold tracking-[1px]" style={{ color: s.tagColor }}>{s.tag}</span>
                  </div>
                  <span className="font-ibm-mono text-[11px] tracking-[2px]" style={{ color: s.idxColor }}>{s.idx}</span>
                </div>
                <h3 className="font-grotesk text-[20px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">{s.title}</h3>
                <p className="font-ibm-mono text-[11px] text-[#555555] tracking-[1px]">{s.by}</p>
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
          <span className="font-ibm-mono text-[11px] text-[#444444] tracking-[2px]">SHOWING 0{showcaseActive + 1} OF 04 LEAGUES</span>
          <span className="font-ibm-mono text-[11px] text-[#F5A623] tracking-[2px] cursor-pointer hover:underline">VIEW ALL &gt;</span>
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
                  <span className="font-grotesk text-[14px] md:text-[16px] font-bold text-[#F5F5F0] tracking-[1px]">{faq.question}</span>
                  <div className="flex items-center justify-center w-[32px] h-[32px] shrink-0" style={{ backgroundColor: isOpen ? "#F5A623" : "#1A1A1A", border: isOpen ? "none" : "1px solid #3D3D3D" }}>
                    <span className="font-ibm-mono text-[14px] font-bold" style={{ color: isOpen ? "#0A0A0A" : "#888888" }}>{isOpen ? "—" : "+"}</span>
                  </div>
                </button>
                {isOpen && faq.answer && (
                  <div className="pb-8">
                    <p className="font-ibm-mono text-[12px] md:text-[13px] text-[#888888] tracking-[1px] leading-[1.6]">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
          <div className="border-t border-t-[#1D1D1D]" />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-[16px] pt-10 md:pt-[48px]">
          <span className="font-ibm-mono text-[13px] text-[#555555] tracking-[1px]">STILL HAVE QUESTIONS?</span>
          <span className="font-ibm-mono text-[13px] font-bold text-[#F5A623] tracking-[1px] cursor-pointer hover:underline">TALK TO A HUMAN &gt;</span>
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
          <span className="font-ibm-mono text-[11px] font-bold text-[#F5A623] tracking-[2px]">
            <GlitchText text="[READY TO BID?]" speed={30} />
          </span>
        </div>

        <h2 className="font-grotesk text-[44px] md:text-[80px] font-bold text-[#F5F5F0] tracking-[-2px] leading-none text-center w-full max-w-[1000px] whitespace-pre-line">
          <GlitchText text={"STOP SPREADSHEETS.\nSTART AUCTIONS."} speed={40} delay={200} />
        </h2>

        <p className="font-ibm-mono text-[10px] md:text-[14px] text-[#666666] tracking-[0.5px] md:tracking-[2px] text-center text-pretty w-full max-w-[700px] px-2">
          <GlitchText text="JOIN 500+ LEAGUES WHO RUN THEIR SEASON LIVE, ON ONE PLATFORM." speed={20} delay={450} />
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-[16px] w-full sm:w-auto">
          <button className="flex items-center justify-center w-full sm:w-[260px] h-[64px] bg-[#F5A623] hover:bg-[#d6931f] transition-colors">
            <span className="font-grotesk text-[13px] font-bold text-[#0A0A0A] tracking-[2px]">OPEN THE CONSOLE — FREE</span>
          </button>
          <button className="flex items-center justify-center w-full sm:w-[220px] h-[64px] bg-[#0A0A0A] border-2 border-[#3D3D3D] hover:border-[#888888] transition-colors">
            <span className="font-ibm-mono text-[12px] text-[#666666] tracking-[2px]">SCHEDULE A DEMO</span>
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="flex flex-col w-full bg-[#050505]">
        <div className="flex flex-col md:flex-row gap-12 md:gap-[80px] px-6 md:px-[120px] py-12 md:py-[64px]">
          <div className="flex flex-col gap-6 md:w-[280px] md:shrink-0">
            <div className="flex items-center gap-[12px]">
              <div className="w-[32px] h-[32px] bg-[#F5A623] shrink-0" />
              <span className="font-grotesk text-[16px] font-bold text-[#F5A623] tracking-[3px]">VALIANT LEAGUE</span>
            </div>
            <p className="font-ibm-mono text-[11px] text-[#888888] tracking-[1px] leading-[1.6] max-w-[260px]">
              THE ALL-IN-ONE PLATFORM FOR RUNNING A CRICKET LEAGUE. BUILT FOR OWNERS WHO DON&apos;T COMPROMISE ON MATCH DAY.
            </p>
            <div className="flex gap-[12px]">
              {[{ label: "X" }, { label: "GH" }, { label: "LI" }].map((s) => (
                <button key={s.label} className="flex items-center justify-center w-[36px] h-[36px] bg-[#111111] border border-[#2D2D2D] hover:border-[#888888] transition-colors">
                  <span className="font-grotesk text-[10px] font-bold text-[#AAAAAA]">{s.label}</span>
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
                <span className="font-grotesk text-[11px] font-bold text-[#F5F5F0] tracking-[2px]">{col.heading}</span>
                {col.links.map((link) => (
                  <a key={link} href="#" className="font-ibm-mono text-[12px] text-[#888888] tracking-[1px] hover:text-[#CCCCCC] transition-colors">{link}</a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full px-6 md:px-[120px] py-4 md:h-[56px] border-t border-t-[#1D1D1D] gap-3 sm:gap-0">
          <span className="font-ibm-mono text-[11px] text-[#666666] tracking-[1px]">© 2025 VALIANT LEAGUE. ALL RIGHTS RESERVED.</span>
          <div className="flex items-center gap-6 md:gap-[32px]">
            <a href="#" className="font-ibm-mono text-[11px] text-[#666666] tracking-[1px] hover:text-[#AAAAAA] transition-colors">PRIVACY</a>
            <a href="#" className="font-ibm-mono text-[11px] text-[#666666] tracking-[1px] hover:text-[#AAAAAA] transition-colors">TERMS</a>
            <span className="font-ibm-mono text-[11px] font-bold text-[#F5A623] tracking-[1px]">V2.0.1</span>
          </div>
        </div>
      </footer>
    </main>
  );
}