/* ─────────────────────────────────────────────────────────────────────────
   HARDCODED STYLE SHEET — mirrors globals.css + the font setup from
   layout.tsx, inlined so the page is self-contained. Same weights as your
   reference project (Cinzel 400–900, Inter 400–700). Real brand gold: #f5a623.
──────────────────────────────────────────────────────────────────────── */
export const pageStyles = `
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
   NAV LINKS — kept short deliberately; a few sections below (Trusted By,
   Stats, Testimonials) are reachable by scroll but not given nav entries,
   the same way a long single-page site avoids overloading its header.
──────────────────────────────────────────────────────────────────────── */
export const navLinks = [
  { name: "HOME", id: "home" },
  { name: "MODULES", id: "modules" },
  { name: "COMPARE", id: "compare" },
  { name: "SHOWCASE", id: "showcase" },
  { name: "FAQ", id: "faq" },
  { name: "PRICING", id: "tiers" },
  { name: "CONTACT", id: "contact" },
]

export const SECTIONS = navLinks.map((l) => l.id)

/* ─────────────────────────────────────────────────────────────────────────
   MODULES / CREATORS / TRUSTED-BY / STATS / TESTIMONIALS / COMPARISON /
   SHOWCASE / FAQ — plain data, consumed by <HomeContent />
──────────────────────────────────────────────────────────────────────── */
export const moduleData = [
  {
    title: "Live Auction\nRoom",
    description:
      "A real shot clock, enforced purses, and a bid room every owner runs from their own phone.",
    badge: "CORE",
    accent: "#F5A623",
    iconKey: "gavel" as const,
    link: "sandbox/auction",
  },
  {
    title: "Automatic\nBrackets",
    description:
      "Single or double-elimination knockouts, drawn from your teams and updated as results come in.",
    badge: "LIVE",
    accent: "#CD7F32",
    iconKey: "trophy" as const,
    link: "sandbox/brackets",
  },
  {
    title: "Broadcast\nOverlays",
    description:
      "A transparent, stream-ready layer — score bar, scorecard, boundaries, weather — toggled from the console.",
    badge: "STREAM",
    accent: "#C0C0C0",
    iconKey: "monitor" as const,
    link: "sandbox/overlay",
  },
]

export const knights = [
  { id: 1, name: "KGlimited", role: "Founder", image: "/images/knights/knight-1.png", twitter: "#", description: "Founder of The Wardens community." },
  { id: 2, name: "tri__", role: "Knight", image: "/images/knights/knight-2.png", twitter: "#", description: "Dedicated knight of The Wardens." },
  { id: 3, name: "vpowerv", role: "Knight", image: "/images/knights/knight-3.png", twitter: "#", description: "Loyal knight serving The Wardens community." },
  { id: 4, name: "s7uid", role: "Royal Guard", image: "/images/knights/knight-4.png", twitter: "#", description: "Elite member of the Royal Guard." },
  { id: 5, name: "blitz7622", role: "Royal Guard", image: "/images/knights/knight-5.png", twitter: "#", description: "Protector of The Wardens realm." },
  { id: 6, name: "zappzaddy", role: "Royal Guard", image: "/images/knights/knight-6.png", twitter: "#", description: "Trusted member of the Royal Guard." },
  { id: 7, name: "sashin", role: "Royal Guard", image: "/images/knights/knight-7.png", twitter: "#", description: "Dedicated guardian of The Wardens." },
  { id: 9, name: "haypon", role: "Royal Guard", image: "/images/knights/knight-9.png", twitter: "#", description: "Plans and executes gaming tournaments, AMAs, and community events." },
]

export const trustedClubs = [
  { name: "Iron Knights CC", logo: "/trusted-clubs/iron-knights.png" },
  { name: "Royal Strikers", logo: "/trusted-clubs/royal-strikers.png" },
  { name: "Silver Hawks", logo: "/trusted-clubs/silver-hawks.png" },
  { name: "Golden Lions", logo: "/trusted-clubs/golden-lions.png" },
  { name: "Crimson Wardens", logo: "/trusted-clubs/crimson-wardens.png" }
]

export const stats = [
  { value: "500+", label: "Leagues Run" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "15s", label: "Auction Shot Clock" },
  { value: "200+", label: "Tournaments Drawn" },
]

export const testimonials = [
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

export type CellValue = true | false | "partial"

export const comparisonRows: { feature: string; vl: CellValue; sheet: CellValue; discord: CellValue; zoom: CellValue }[] = [
  { feature: "Live bid timer", vl: true, sheet: false, discord: false, zoom: "partial" },
  { feature: "Mobile bidding", vl: true, sheet: false, discord: "partial", zoom: false },
  { feature: "Automatic brackets", vl: true, sheet: false, discord: false, zoom: false },
  { feature: "Broadcast overlays", vl: true, sheet: false, discord: false, zoom: false },
  { feature: "Purse enforcement", vl: true, sheet: "partial", discord: false, zoom: false },
  { feature: "Free tier to start", vl: true, sheet: true, discord: true, zoom: false },
]

export const comparisonColumns = [
  { key: "sheet" as const, label: "Spreadsheet" },
  { key: "discord" as const, label: "Discord Bot" },
  { key: "zoom" as const, label: "Zoom Call" },
]





export const showcaseSlides: ShowcaseSlide[] = [
  {
    tag: "Auction",
    slug: "iron-knights-season-opener",
    title: "Iron Knights Season Opener",
    by: "Run by The Wardens CC — 8 teams, 96 players",
    image: "https://images.pexels.com/photos/9071736/pexels-photo-9071736.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    tag: "Bracket",
    slug: "silver-cup-knockout",
    title: "Silver Cup Knockout",
    by: "Run by Royal Strikers — double-elimination, 16 teams",
    image: "https://images.pexels.com/photos/9072212/pexels-photo-9072212.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    tag: "Overlay",
    slug: "golden-lions-broadcast",
    title: "Golden Lions Broadcast",
    by: "Streamed live — 12,000 viewers peak",
    image: "https://images.pexels.com/photos/7862505/pexels-photo-7862505.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    tag: "League",
    slug: "crimson-cup-full-season",
    title: "Crimson Cup Full Season",
    by: "Run by Valiant Originals — three months, one trophy",
    image: "https://images.pexels.com/photos/6532362/pexels-photo-6532362.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    tag: "League",
    slug: "bronze-trophy-series",
    title: "Bronze Trophy Series",
    by: "Run by Bronze Trophy Alliance — 5 teams, round robin",
    image: "https://images.pexels.com/photos/34412339/pexels-photo-34412339.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    tag: "Auction",
    slug: "wardens-winter-sale",
    title: "Wardens Winter Sale",
    by: "Run by The Wardens CC — 64 players moved in one night",
    image: "https://images.pexels.com/photos/9072205/pexels-photo-9072205.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
]

export const faqs = [
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



/* ── slug helper — used instead of a hand-authored slug field ── */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export type ShowcaseSlide = {
  tag: string
  slug: string
  title: string
  by: string
  image: string
  // Optional extras for the tournament detail page — safe to omit
  description?: string
  format?: string
  prizePool?: string
  startDate?: string
  status?: "Upcoming" | "Live" | "Completed"
  rules?: string[]
  prizes?: { place: string; reward: string }[]
  website?: string
  twitter?: string
  discord?: string
}

// Renamed from getTournamentBySlug — this version only returns the raw
// ShowcaseSlide (no liveMatch/pointsTable/bracket/etc). The richer merged
// Tournament lookup lives in tournament-data.ts as getTournamentBySlug;
// importing the two under the same name was the original bug, since
// Tournament extends ShowcaseSlide with no type error to catch the mix-up.
export function getShowcaseSlideBySlug(slug: string): ShowcaseSlide | undefined {
  return showcaseSlides.find((t) => slugify(t.slug) === slug)
}