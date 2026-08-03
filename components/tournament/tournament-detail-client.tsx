"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Twitter,
  MessageSquare,
  Globe,
  Trophy,
  Calendar,
  Users,
  Radio,
  ListOrdered,
  CalendarClock,
  Network,
  MapPin,
  Award,
  Shield,
  Lock,
} from "lucide-react"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { SiteHeader } from "@/components/landing/site-header"
import RelatedTournaments from "@/components/tournament/related-tournaments"
import BracketPreviewPanel from "@/components/tournament/BracketPreviewPanel"
import { pageStyles } from "@/data/site-data"
import {
  hasMatchDetail,
  type Tournament,
  type LiveMatch,
  type PointsRow,
  type Fixture,
  type BracketMatch,
  type BracketTeam,
  type Squad,
  type LeaderboardRow,
  type AwardEntry,
} from "@/data/tournament-data"

/* ------------------------------------------------------------------ */
/*  NOTE ON BRACKETS:                                                   */
/*  `tournament.bracketFormat` ("single" | "double" | undefined) picks  */
/*  which bracket UI shows in the Bracket tab:                          */
/*    - set to "single" or "double" -> BracketPreviewPanel, which        */
/*      generates its own full 32-team demo bracket and previews a      */
/*      slice of it (does NOT read tournament.bracket).                 */
/*    - left unset -> falls back to the legacy flat `bracket` array     */
/*      via BracketPanel below, if present.                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  NOTE ON TABS:                                                       */
/*  Every tab (Live, Points, Schedule, Bracket, Squads, Stats) is now    */
/*  always rendered so visitors can see the full shape of what a        */
/*  fully-run tournament looks like. If the underlying data for a tab   */
/*  isn't there yet, the tab trigger is disabled + shows a lock icon,   */
/*  and its content renders a "coming soon" placeholder instead of      */
/*  being hidden outright.                                              */
/* ------------------------------------------------------------------ */

interface TournamentDetailClientProps {
  tournament: Tournament
  slug: string
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export default function TournamentDetailClient({ tournament, slug }: TournamentDetailClientProps) {
  useScrollTop()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(tournament.liveMatch ? "live" : "overview")
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
    status === "Live"
      ? "bg-green-600 hover:bg-green-700"
      : status === "Completed"
        ? "bg-gray-600 hover:bg-gray-700"
        : "bg-blue-600 hover:bg-blue-700"

  const hasLive = !!tournament.liveMatch
  const hasPoints = !!tournament.pointsTable?.length
  const hasFixtures = !!tournament.fixtures?.length

  // Bracket tab shows if either bracketFormat is set (new chart-style
  // preview — generates its own demo data, ignores tournament.bracket)
  // or the legacy flat bracket array has entries.
  const hasBracket = !!tournament.bracketFormat || !!tournament.bracket?.length

  const hasSquads = !!tournament.squads?.length
  const hasLeaderboard = !!(tournament.runsLeaderboard?.length || tournament.wicketsLeaderboard?.length)
  const hasAwards = !!tournament.awards?.length

  return (
    <main className="overflow-hidden">
       <style
        dangerouslySetInnerHTML={{
          __html: `${pageStyles}
          html, body {
            overflow-x: hidden;
            max-width: 100%;
          }`,
        }}
      />


      {/* <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      /> */}

      <section className="pt-16 sm:pt-20 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">          {/* Row 1: Banner + Tournament Information.
              A grid row stretches every cell in it to match the
              tallest one, so the banner and the info card always
              line up in height — whichever needs more room wins,
              and the shorter one is stretched to match instead of
              scrolling or leaving empty space. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:items-stretch mb-8">
            {/* Banner */}
            <div className="lg:col-span-2 fade-in">
              <div className="relative h-64 md:h-80 lg:h-full min-h-[16rem] rounded-lg overflow-hidden glow-effect border border-gold/20">
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
                {hasLive && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-green-600 text-white text-xs font-bold font-cinzel px-3 py-1.5 rounded-full animate-pulse">
                    <Radio className="h-3 w-3" />
                    LIVE
                  </div>
                )}
              </div>
            </div>

            {/* Tournament Information — no fixed height and no
                overflow-y-auto; the grid stretch above makes this
                match the banner's height (or the banner matches
                this, whichever is taller), and it never scrolls
                internally. */}
            <div className="lg:col-span-1 fade-in-up">
              <div className="lg:h-full bg-black/50 border border-gold/20 rounded-lg p-6 flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4 font-cinzel">Tournament Information</h3>
                <div className="space-y-4 flex-1 flex flex-col justify-between">
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
                  {tournament.liveMatch?.venue && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-gold" />
                      <div>
                        <p className="text-gray-400 text-sm">Current Venue</p>
                        <p className="text-white font-semibold">{tournament.liveMatch.venue}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Status</p>
                    <Badge className={statusColor}>{status}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Tabs (main) + rest of sidebar */}
          <div className="flex flex-col lg:flex-row gap-8 lg:items-stretch">
            {/* Main Content */}
            <div className="w-full lg:w-2/3 fade-in">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-black/50 border border-gold/20 p-1 rounded-lg w-full justify-start mb-6 flex-wrap h-auto gap-1">
                  <LockableTabTrigger value="live" label="Live" locked={!hasLive} />
                  <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                  >
                    Overview
                  </TabsTrigger>
                  <LockableTabTrigger value="points" label="Points Table" locked={!hasPoints} />
                  <LockableTabTrigger value="schedule" label="Schedule" locked={!hasFixtures} />
                  <LockableTabTrigger value="bracket" label="Bracket" locked={!hasBracket} />
                  <LockableTabTrigger value="squads" label="Squads" locked={!hasSquads} />
                  <LockableTabTrigger value="stats" label="Stats" locked={!hasLeaderboard} />
                  <TabsTrigger
                    value="prizes"
                    className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                  >
                    Prizes
                  </TabsTrigger>
                </TabsList>

                {/* LIVE */}
                <TabsContent value="live" className="mt-0">
                  {hasLive ? (
                    <LiveScorePanel match={tournament.liveMatch!} />
                  ) : (
                    <LockedTabPlaceholder
                      icon={Radio}
                      title="No Live Match Right Now"
                      description="Once a match kicks off, ball-by-ball scoring, run rates, and the current batting/bowling breakdown will show up here."
                    />
                  )}
                </TabsContent>

                {/* OVERVIEW */}
                <TabsContent value="overview" className="mt-0">
                  <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4 font-cinzel">ABOUT THE TOURNAMENT</h2>
                    {tournament.description ? (
                      <p className="text-gray-300">{tournament.description}</p>
                    ) : (
                      <p className="text-gray-500 italic text-sm">
                        No description has been added for this tournament yet.
                      </p>
                    )}
                  </div>
                  {hasAwards && <AwardsPanel awards={tournament.awards!} />}
                </TabsContent>

                {/* POINTS TABLE */}
                <TabsContent value="points" className="mt-0">
                  {hasPoints ? (
                    <PointsTablePanel rows={tournament.pointsTable!} />
                  ) : (
                    <LockedTabPlaceholder
                      icon={ListOrdered}
                      title="Points Table Coming Soon"
                      description="Once matches are played, standings, net run rate, and each team's recent form will be tracked here automatically."
                    />
                  )}
                </TabsContent>

                {/* SCHEDULE */}
                <TabsContent value="schedule" className="mt-0">
                  {hasFixtures ? (
                    <SchedulePanel fixtures={tournament.fixtures!} squads={tournament.squads} slug={slug} />
                  ) : (
                    <LockedTabPlaceholder
                      icon={CalendarClock}
                      title="Schedule Not Announced Yet"
                      description="Match dates, times, and venues will appear here once the fixture list is published."
                    />
                  )}
                </TabsContent>

                {/* BRACKET */}
                <TabsContent value="bracket" className="mt-0">
                  {hasBracket ? (
                    tournament.bracketFormat === "double" ? (
                      <BracketPreviewPanel format="double" slug={slug} doubleElimData={tournament.doubleElimData} />
                    ) : tournament.bracketFormat === "single" ? (
                      <BracketPreviewPanel format="single" slug={slug} bracketRounds={tournament.bracketRounds} />
                    ) : (
                      // Legacy fallback for tournaments with only the old flat `bracket`
                      // array and no bracketFormat set (e.g. round-robin tournaments).
                      <BracketPanel matches={tournament.bracket!} slug={slug} />
                    )
                  ) : (
                    <LockedTabPlaceholder
                      icon={Network}
                      title="Playoff Bracket Not Set Up"
                      description="Once the playoff stage is configured, the full knockout bracket will be previewed here."
                    />
                  )}
                </TabsContent>

                {/* SQUADS */}
                <TabsContent value="squads" className="mt-0">
                  {hasSquads ? (
                    <SquadsPanel squads={tournament.squads!} />
                  ) : (
                    <LockedTabPlaceholder
                      icon={Shield}
                      title="Squads Not Added Yet"
                      description="Team rosters and captains will show up here once squads are registered for this tournament."
                    />
                  )}
                </TabsContent>

                {/* STATS / LEADERBOARD */}
                <TabsContent value="stats" className="mt-0">
                  {hasLeaderboard ? (
                    <LeaderboardPanel
                      runs={tournament.runsLeaderboard || []}
                      wickets={tournament.wicketsLeaderboard || []}
                    />
                  ) : (
                    <LockedTabPlaceholder
                      icon={Award}
                      title="Leaderboard Not Available Yet"
                      description="Top run-scorers and wicket-takers will populate here once matches start being recorded."
                    />
                  )}
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

            {/* Sidebar (rest) */}
            <div className="w-full lg:w-1/3 fade-in-up">
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
                  Want your league running on Valiant League too? Start free with one live match and points table.
                </p>
                <Button className="w-full bg-gold hover:bg-gold/90 text-black font-bold">
                  <Link href="/#tiers" className="flex items-center justify-center gap-2 w-full">
                    Get Started
                  </Link>
                </Button>
              </div>

              {/* <RelatedTournaments currentSlug={slug} currentTag={tournament.tag} /> */}
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center gap-4">
            <Link href="/tournaments">
              <Button className="bg-gold hover:bg-gold/90 py-2 text-black font-bold">Back to Tournaments</Button>
            </Link>
            <Link href={`/tournaments/${slug}/edit`}>
              <Button
                variant="outline"
                className="border-gold/40 text-gold hover:bg-gold/10 hover:text-gold py-2 font-bold bg-transparent"
              >
                Edit Tournament
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB TRIGGER — disabled + lock icon when its data isn't there yet
// ─────────────────────────────────────────────────────────────
function LockableTabTrigger({ value, label, locked }: { value: string; label: string; locked: boolean }) {
  return (
    <TabsTrigger
      value={value}
      disabled={locked}
      className={`data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300 flex items-center gap-1.5 ${
        locked ? "opacity-40 cursor-not-allowed data-[state=active]:bg-transparent data-[state=active]:text-inherit" : ""
      }`}
    >
      {locked && <Lock className="h-3 w-3" />}
      {label}
    </TabsTrigger>
  )
}

// ─────────────────────────────────────────────────────────────
// LOCKED TAB PLACEHOLDER — shown in place of a tab's content when
// that part of the tournament hasn't been set up yet, so visitors
// can see what a fully-run tournament will eventually show here.
// ─────────────────────────────────────────────────────────────
function LockedTabPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-10 mb-8 flex flex-col items-center text-center gap-3">
      <div className="h-12 w-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center relative">
        <Icon className="h-5 w-5 text-gold/50" />
        <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-black border border-gold/30 flex items-center justify-center">
          <Lock className="h-2.5 w-2.5 text-gold" />
        </span>
      </div>
      <h3 className="text-white font-bold font-cinzel">{title}</h3>
      <p className="text-gray-400 text-sm max-w-sm">{description}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LIVE SCORE PANEL
// ─────────────────────────────────────────────────────────────
function LiveScorePanel({ match }: { match: LiveMatch }) {
  const chasing = !!match.target
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white font-cinzel flex items-center gap-2">
          <Radio className="h-5 w-5 text-green-500" />
          LIVE SCORE
        </h2>
        {match.matchStatus === "live" && (
          <span className="flex items-center gap-1.5 text-green-500 text-xs font-bold font-cinzel">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            IN PROGRESS
          </span>
        )}
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <TeamScoreBlock
          name={match.team1.name}
          short={match.team1.short}
          score={match.score1}
          overs={match.overs1}
          batting={match.inningsTeam === match.team1.short}
        />
        <TeamScoreBlock
          name={match.team2.name}
          short={match.team2.short}
          score={match.score2}
          overs={match.overs2}
          batting={match.inningsTeam === match.team2.short}
        />
      </div>

      {/* CRR / RRR strip */}
      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        <div className="bg-gold/10 border border-gold/20 rounded-md px-4 py-2">
          <span className="text-gray-400">CRR </span>
          <span className="text-gold font-bold font-cinzel">{match.crr}</span>
        </div>
        {chasing && match.rrr && (
          <div className="bg-gold/10 border border-gold/20 rounded-md px-4 py-2">
            <span className="text-gray-400">RRR </span>
            <span className="text-gold font-bold font-cinzel">{match.rrr}</span>
          </div>
        )}
        {chasing && (
          <div className="bg-gold/10 border border-gold/20 rounded-md px-4 py-2">
            <span className="text-gray-400">Target </span>
            <span className="text-gold font-bold font-cinzel">{match.target}</span>
          </div>
        )}
      </div>

      {match.matchNote && (
        <p className="text-white font-semibold mb-6 border-l-2 border-gold pl-3">{match.matchNote}</p>
      )}

      {/* Batsmen & Bowler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2 font-cinzel">Batting</p>
          <div className="space-y-1">
            {match.batsmen.map((b) => (
              <div key={b.name} className="flex items-center justify-between text-sm">
                <span className={b.onStrike ? "text-gold font-semibold" : "text-gray-300"}>
                  {b.onStrike && "★ "}
                  {b.name}
                </span>
                <span className="text-white">
                  {b.runs} <span className="text-gray-500">({b.balls})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2 font-cinzel">Bowling</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">{match.bowler.name}</span>
            <span className="text-white">
              {match.bowler.wickets}/{match.bowler.runs} <span className="text-gray-500">({match.bowler.overs})</span>
            </span>
          </div>
        </div>
      </div>

      {/* This over */}
      <div className="mb-6">
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2 font-cinzel">This Over</p>
        <div className="flex gap-2 flex-wrap">
          {match.recentBalls.map((ball, i) => (
            <div
              key={i}
              className={`h-9 w-9 flex items-center justify-center rounded-full text-xs font-bold font-cinzel ${
                ball.label === "W"
                  ? "bg-red-600 text-white"
                  : ball.runs === 6
                    ? "bg-gold text-black"
                    : ball.runs === 4
                      ? "bg-gold/40 text-white"
                      : "bg-white/10 text-gray-300"
              }`}
            >
              {ball.label}
            </div>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-400 space-y-1 border-t border-gold/10 pt-4">
        <p>
          <span className="text-gray-500">Venue: </span>
          {match.venue}
        </p>
        <p>
          <span className="text-gray-500">Toss: </span>
          {match.toss}
        </p>
      </div>
    </div>
  )
}

function TeamScoreBlock({
  name,
  short,
  score,
  overs,
  batting,
}: {
  name: string
  short: string
  score?: string
  overs?: string
  batting: boolean
}) {
  return (
    <div className={`rounded-lg p-4 border ${batting ? "border-gold bg-gold/5" : "border-gold/10 bg-white/[0.02]"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-white font-bold font-cinzel">{short}</span>
        {batting && <span className="text-[10px] text-gold font-bold tracking-wide">BATTING</span>}
      </div>
      <p className="text-gray-400 text-xs mb-2">{name}</p>
      {score ? (
        <p className="text-2xl font-bold text-white font-cinzel">
          {score}
          {overs && <span className="text-sm text-gray-400 font-normal ml-2">({overs} ov)</span>}
        </p>
      ) : (
        <p className="text-gray-500 text-sm">Yet to bat</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// POINTS TABLE PANEL
// ─────────────────────────────────────────────────────────────
function PointsTablePanel({ rows }: { rows: PointsRow[] }) {
  const sorted = [...rows].sort((a, b) => b.points - a.points)
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8 overflow-x-auto">
      <h2 className="text-2xl font-bold text-white mb-4 font-cinzel flex items-center gap-2">
        <ListOrdered className="h-5 w-5 text-gold" />
        POINTS TABLE
      </h2>
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-gray-400 text-left border-b border-gold/10">
            <th className="py-2 pr-2 font-normal">#</th>
            <th className="py-2 pr-2 font-normal">Team</th>
            <th className="py-2 pr-2 font-normal text-center">P</th>
            <th className="py-2 pr-2 font-normal text-center">W</th>
            <th className="py-2 pr-2 font-normal text-center">L</th>
            <th className="py-2 pr-2 font-normal text-center">NRR</th>
            <th className="py-2 pr-2 font-normal text-center">Pts</th>
            <th className="py-2 pr-2 font-normal text-right">Form</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.short} className={`border-b border-gold/5 ${i < 4 ? "bg-gold/[0.04]" : ""}`}>
              <td className="py-3 pr-2 text-gray-400">{i + 1}</td>
              <td className="py-3 pr-2 text-white font-semibold whitespace-nowrap">{row.team}</td>
              <td className="py-3 pr-2 text-center text-gray-300">{row.played}</td>
              <td className="py-3 pr-2 text-center text-gray-300">{row.won}</td>
              <td className="py-3 pr-2 text-center text-gray-300">{row.lost}</td>
              <td className="py-3 pr-2 text-center text-gray-300">{row.nrr}</td>
              <td className="py-3 pr-2 text-center text-gold font-bold">{row.points}</td>
              <td className="py-3 pr-2">
                <div className="flex gap-1 justify-end">
                  {row.form?.map((f, j) => (
                    <span
                      key={j}
                      className={`h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                        f === "W" ? "bg-green-600 text-white" : f === "L" ? "bg-red-600/80 text-white" : "bg-gray-600 text-white"
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-gray-500 text-xs mt-3">Top 4 (highlighted) advance to the playoffs.</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SCHEDULE PANEL
// ─────────────────────────────────────────────────────────────
function SchedulePanel({ fixtures, squads, slug }: { fixtures: Fixture[]; squads?: Squad[]; slug: string }) {
  const [filter, setFilter] = useState<"all" | "live" | "upcoming" | "completed">("all")
  const logoByTeam = new Map(squads?.map((s) => [s.team, s.logo]) ?? [])
  const colorByTeam = new Map(squads?.map((s) => [s.team, (s as any).color as string | undefined]) ?? [])

  const counts = {
    all: fixtures.length,
    live: fixtures.filter((f) => f.status === "live").length,
    upcoming: fixtures.filter((f) => f.status === "upcoming").length,
    completed: fixtures.filter((f) => f.status === "completed").length,
  }

  const filtered = filter === "all" ? fixtures : fixtures.filter((f) => f.status === filter)

  // Stage/round grouping (falls back to a single "Matches" bucket
  // if fixtures don't carry a stage field yet).
  const stageOf = (f: Fixture) => (f as any).stage ?? "Matches"
  const stageOrder = ["Group Stage", "Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final", "Matches"]

  const stageGroups = new Map<string, Fixture[]>()
  for (const f of filtered) {
    const s = stageOf(f)
    if (!stageGroups.has(s)) stageGroups.set(s, [])
    stageGroups.get(s)!.push(f)
  }
  const stages = [...stageGroups.keys()].sort((a, b) => {
    const ai = stageOrder.indexOf(a), bi = stageOrder.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const statusBadge = (s: Fixture["status"]) => {
    if (s === "live") return <Badge className="bg-green-600 hover:bg-green-700">Live</Badge>
    if (s === "completed") return <Badge className="bg-gray-600 hover:bg-gray-700">Completed</Badge>
    return <Badge className="bg-yellow-600 hover:bg-yellow-700">Upcoming</Badge>
  }

  function getTeamColor(name: string, explicit?: string) {
    if (explicit) return explicit
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 62%, 42%)`
  }

  const filterOptions: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Completed" },
  ]

  const statusBadgeClass = (s: Fixture["status"], liveAccent: "red" | "green" = "red") => {
    if (s === "live") return liveAccent === "green" ? "bg-green-600 hover:bg-green-700" : "bg-green-600 hover:bg-green-700"
    if (s === "completed") return "bg-gray-600 hover:bg-gray-700"
    return "bg-blue-600 hover:bg-blue-700" // upcoming — moved off green, see note above
  }

  // A match is "unconfirmed" if either side is still a TBD slot —
  // these should sink to the bottom of their stage so the schedule
  // reads "what's actually set to happen" first.
  const isTBD = (f: Fixture) => f.team1 === "TBD" || f.team2 === "TBD"

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <h2 className="text-2xl font-bold text-white font-cinzel flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-gold" />
          MATCH SCHEDULE
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map(
            ({ key, label }) =>
              counts[key] > 0 && (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs font-cinzel uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors ${
                    filter === key ? "bg-gold text-black border-gold" : "border-gold/20 text-gray-300 hover:border-gold/50"
                  }`}
                >
                  {label} <span className="opacity-60">({counts[key]})</span>
                </button>
              )
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm italic text-center py-10">
          No {filter !== "all" ? filter : ""} matches to show.
        </p>
      ) : (
        <div className="space-y-10">
          {stages.map((stage) => {
            // Live matches float to the top of their stage; among the
            // rest, matches with both teams already confirmed come
            // before TBD placeholder slots.
            const stageFixtures = [...stageGroups.get(stage)!].sort((a, b) => {
              const liveRank = (f: Fixture) => (f.status === "live" ? 0 : 1)
              const liveDiff = liveRank(a) - liveRank(b)
              if (liveDiff !== 0) return liveDiff

              const tbdRank = (f: Fixture) => (isTBD(f) ? 1 : 0)
              return tbdRank(a) - tbdRank(b)
            })

            // date sub-grouping within the stage, same logic as before
            const dateGroups: { date: string; items: Fixture[] }[] = []
            for (const f of stageFixtures) {
              const current = dateGroups[dateGroups.length - 1]
              if (current && current.date === f.date) current.items.push(f)
              else dateGroups.push({ date: f.date, items: [f] })
            }
            return (
              <div key={stage}>
                {stage !== "Matches" && (
                  <h3 className="text-white font-bold font-cinzel text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                    {stage}
                  </h3>
                )}
                <div className="space-y-6">
                  {dateGroups.map((group) => (
                    <div key={group.date}>
                      {group.date && group.date !== "TBD" && (
                        <p className="text-gold/70 text-[11px] font-cinzel uppercase tracking-widest mb-2.5 flex items-center gap-3">
                          <span className="h-px flex-1 bg-gold/10" />
                          {group.date}
                          <span className="h-px flex-1 bg-gold/10" />
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {group.items.map((f, i) => (
                          <FixtureCard
                            key={f.id}
                            fixture={f}
                            team1Logo={logoByTeam.get(f.team1)}
                            team2Logo={logoByTeam.get(f.team2)}
                            team1Color={getTeamColor(f.team1, colorByTeam.get(f.team1))}
                            team2Color={getTeamColor(f.team2, colorByTeam.get(f.team2))}
                            statusBadgeClass={statusBadgeClass}
                            slug={slug}
                            matchNumber={stageFixtures.indexOf(f) + 1}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TeamBadge({ name, logo }: { name: string; logo?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-16 shrink-0 transition-transform duration-300 group-hover:scale-[1.03]">
      {logo ? (
        <div className="relative h-10 w-10 rounded-full overflow-hidden border border-gold/25 ring-1 ring-black/40 bg-black/40 shrink-0">
          <Image src={logo} alt={`${name} logo`} fill className="object-cover" />
        </div>
      ) : (
        <div className="h-10 w-10 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center shrink-0">
          <span className="text-gold text-[10px] font-bold font-cinzel">{initials(name)}</span>
        </div>
      )}
      <span className="text-white text-[11px] font-semibold font-cinzel text-center leading-tight truncate w-full">
        {name}
      </span>
    </div>
  )
}

function FixtureCard({
  fixture: f,
  team1Logo,
  team2Logo,
  team1Color,
  team2Color,
  statusBadgeClass,
  slug,
  matchNumber,
}: {
  fixture: Fixture
  team1Logo?: string
  team2Logo?: string
  team1Color: string
  team2Color: string
  statusBadgeClass: (s: Fixture["status"], liveAccent?: "red" | "green") => string
  slug: string
  matchNumber?: number
}) {
  const isLive = f.status === "live"
  const isCompleted = f.status === "completed"
  const clickable = !!f.matchId

  const liveAccent: "red" | "green" = (f as any).liveAccent === "green" ? "green" : "red"
  const roundLabel = (f as any).stage || (f as any).round || (matchNumber ? `Match ${matchNumber}` : null)
  const timeLabel = f.time || "Time TBD"
  const venueLabel = f.venue || null
  const dateLabel = f.date && f.date !== "TBD" ? f.date : null

  const statusLabel = isLive ? "Live" : isCompleted ? "Completed" : "Upcoming"

  const card = (
    <div
      className={`group relative rounded-xl border overflow-hidden h-full flex flex-col transition-all duration-300 ${
        isLive
          ? liveAccent === "green"
            ? "border-green-500/50 shadow-[0_0_25px_-8px_rgba(34,197,94,0.35)]"
            : "border-red-500/50 shadow-[0_0_25px_-8px_rgba(220,38,38,0.35)]"
          : isCompleted
            ? "border-gold/10 opacity-70"
            : "border-gold/10"
      } ${
        clickable
          ? "cursor-pointer hover:border-gold/50 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]"
          : ""
      }`}
    >
      {/* Duel banner — diagonal split, team-colored halves */}
      <div className="relative h-36 bg-black/60">
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(0 0, 58% 0, 42% 100%, 0 100%)",
            background: `linear-gradient(135deg, ${team1Color}80, rgba(0,0,0,0.92))`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)",
            background: `linear-gradient(225deg, ${team2Color}80, rgba(0,0,0,0.92))`,
          }}
        />
        {/* seam highlight */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ clipPath: "polygon(57% 0, 60% 0, 44% 100%, 41% 100%)", background: "rgba(255,255,255,0.08)" }}
        />

        {roundLabel && (
          <span className="absolute top-2 left-2 z-20 text-white/90 text-[10px] font-cinzel uppercase tracking-widest bg-black/50 border border-white/10 rounded-full px-2.5 py-0.5">
            {roundLabel}
          </span>
        )}
        <span
          className={`absolute top-2 right-2 z-20 text-white text-[10px] font-bold font-cinzel px-2.5 py-1 rounded-full flex items-center gap-1 ${statusBadgeClass(
            f.status,
            liveAccent
          )}`}
        >
          {isLive && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
          {statusLabel}
        </span>

        {/* Team 1 */}
        <div className="absolute left-[16%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5">
          {team1Logo ? (
            <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 ring-1 ring-black/40 bg-black/40" style={{ borderColor: team1Color }}>
              <Image src={team1Logo} alt={`${f.team1} logo`} fill className="object-cover" />
            </div>
          ) : (
            <div className="h-20 w-20 rounded-full bg-black/40 border-2 flex items-center justify-center" style={{ borderColor: team1Color }}>
              <span className="text-white text-[11px] font-bold font-cinzel">{initials(f.team1)}</span>
            </div>
          )}
          <span className="text-white text-[11px] font-semibold font-cinzel text-center leading-tight max-w-[80px] truncate">
            {f.team1}
          </span>
        </div>

        {/* VS seam badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <span className="h-8 w-8 rounded-full border border-gold/40 bg-black/70 flex items-center justify-center text-gold font-cinzel text-[10px] font-bold">
            VS
          </span>
        </div>

        {/* Team 2 */}
        <div className="absolute left-[84%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5">
          {team2Logo ? (
            <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 ring-1 ring-black/40 bg-black/40" style={{ borderColor: team2Color }}>
              <Image src={team2Logo} alt={`${f.team2} logo`} fill className="object-cover" />
            </div>
          ) : (
            <div className="h-20 w-20 rounded-full bg-black/40 border-2 flex items-center justify-center" style={{ borderColor: team2Color }}>
              <span className="text-white text-[11px] font-bold font-cinzel">{initials(f.team2)}</span>
            </div>
          )}
          <span className="text-white text-[11px] font-semibold font-cinzel text-center leading-tight max-w-[80px] truncate">
            {f.team2}
          </span>
        </div>
      </div>

      {/* Info footer */}
      <div className="bg-black/50 p-4 flex-1">
        <p className="text-gray-300 text-xs font-medium text-center">{timeLabel}</p>
        {(dateLabel || venueLabel) && (
          <p className="text-gray-500 text-[11px] text-center mt-0.5 truncate">
            {[dateLabel, venueLabel].filter(Boolean).join(" · ")}
          </p>
        )}
        {f.result && (
          <p className="text-gold text-xs font-medium text-center mt-2 pt-2 border-t border-gold/10">{f.result}</p>
        )}
        {clickable && (
          <p className="text-gold/70 text-[10px] uppercase tracking-widest font-cinzel mt-2 text-center flex items-center justify-center gap-1 transition-transform duration-300 group-hover:gap-1.5">
            View match <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </p>
        )}
      </div>
    </div>
  )

  return clickable ? (
    <Link href={`/match/${f.matchId}`} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  )
}

// ─────────────────────────────────────────────────────────────
// BRACKET PANEL (legacy flat-array fallback) — groups matches
// into round columns instead of a flat grid, so it scales
// cleanly from a 4-team final up to a 32-team draw.
// ─────────────────────────────────────────────────────────────
function BracketPanel({ matches, slug }: { matches: BracketMatch[]; slug: string }) {
  // Group by round. Falls back to inferring round from `label`
  // (e.g. "Round of 32 - Match 3" -> "Round of 32") if `round`
  // isn't set on the data yet.
  const roundOf = (m: BracketMatch) =>
    (m as any).round ?? m.label.replace(/\s*-?\s*Match\s*\d+$/i, "").trim()

  const roundOrder = ["Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final"]
  const grouped = new Map<string, BracketMatch[]>()
  for (const m of matches) {
    const r = roundOf(m)
    if (!grouped.has(r)) grouped.set(r, [])
    grouped.get(r)!.push(m)
  }

  // Order rounds: known rounds first in bracket order, then any
  // unrecognized round names appended alphabetically as a fallback.
  const rounds = [...grouped.keys()].sort((a, b) => {
    const ai = roundOrder.indexOf(a)
    const bi = roundOrder.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const COL_WIDTH = 260
  const CARD_HEIGHT = 108
  const CARD_GAP = 24

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8 overflow-x-auto">
      <h2 className="text-2xl font-bold text-white mb-6 font-cinzel flex items-center gap-2">
        <Network className="h-5 w-5 text-gold" />
        PLAYOFF BRACKET
      </h2>

      <div
        className="flex gap-10 min-w-max pb-2"
        style={{ minWidth: rounds.length * (COL_WIDTH + 40) }}
      >
        {rounds.map((round, colIdx) => {
          const roundMatches = grouped.get(round)!
          // Vertical spacing doubles each round so brackets converge
          // visually toward the final, like a real knockout tree.
          const spacingMultiplier = Math.pow(2, colIdx)
          const topOffset = colIdx === 0 ? 0 : (CARD_HEIGHT + CARD_GAP) * (spacingMultiplier / 2 - 0.5)
          const gapBetween = (CARD_HEIGHT + CARD_GAP) * spacingMultiplier - CARD_HEIGHT

          return (
            <div key={round} style={{ width: COL_WIDTH }} className="shrink-0">
              <p className="text-gold/80 text-xs font-cinzel uppercase tracking-widest text-center mb-4 pb-2 border-b border-gold/10">
                {round}
              </p>
              <div
                className="flex flex-col"
                style={{ marginTop: topOffset, gap: gapBetween }}
              >
                {roundMatches.map((m) => (
                  <BracketCard key={m.id} match={m} height={CARD_HEIGHT} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BracketCard({ match: m, height }: { match: BracketMatch; height: number }) {
  const playable = hasMatchDetail(m.id)
  const card = (
    <div
      style={{ height }}
      className={`border border-gold/10 rounded-md p-3 bg-white/[0.02] flex flex-col justify-center transition-all ${
        playable ? "hover:border-gold/60 hover:bg-white/[0.04] cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-gold text-[10px] font-bold font-cinzel uppercase tracking-wide truncate">
          {m.label}
        </span>
        {m.date && <span className="text-gray-500 text-[10px] shrink-0 ml-2">{m.date}</span>}
      </div>
      <BracketTeamRow team={m.team1} isWinner={m.winner === m.team1.short} />
      <BracketTeamRow team={m.team2} isWinner={m.winner === m.team2.short} />
      {playable && (
        <p className="text-gold text-[9px] uppercase tracking-widest font-cinzel mt-1.5 text-right">
          View match →
        </p>
      )}
    </div>
  )

  return playable ? (
    <Link href={`/match/${m.id}`} className="block">
      {card}
    </Link>
  ) : (
    <div>{card}</div>
  )
}

function BracketTeamRow({ team, isWinner }: { team: BracketTeam; isWinner: boolean }) {
  const tbd = team.short === "TBD"
  return (
    <div
      className={`flex items-center justify-between py-2 px-2 rounded ${
        isWinner ? "bg-gold/10 border border-gold/30" : ""
      }`}
    >
      <span className={`text-sm ${tbd ? "text-gray-500 italic" : isWinner ? "text-white font-semibold" : "text-gray-300"}`}>
        {team.name}
      </span>
      {team.score && <span className="text-gray-400 text-xs">{team.score}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SQUADS PANEL
// ─────────────────────────────────────────────────────────────
function SquadsPanel({ squads }: { squads: Squad[] }) {
  return (
    <div className="space-y-4 mb-8">
      {squads.map((s) => {
        const hasRoster = s.players.length > 0
        return (
          <div key={s.team} className="bg-black/50 border border-gold/20 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                {s.logo ? (
                  <div className="relative h-9 w-9 rounded-full overflow-hidden border border-gold/20 shrink-0">
                    <Image src={s.logo} alt={`${s.team} logo`} fill className="object-cover" />
                  </div>
                ) : (
                  <span className="h-9 w-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-gold" />
                  </span>
                )}
                <div>
                  <h3 className="text-white font-bold font-cinzel leading-tight">{s.team}</h3>
                  {s.owner && <p className="text-gray-400 text-xs">Owner: {s.owner}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs flex items-center gap-1.5 justify-end">
                  <Users className="h-3 w-3" />
                  {hasRoster ? `${s.players.length} players · Capt. ${s.captain}` : "Squad to be announced"}
                </p>
                {s.purseSpent != null && s.purseRemaining != null && (
                  <p className="text-gold text-xs mt-1">
                    {s.purseSpent.toLocaleString()} spent
                    <span className="text-gray-500"> · {s.purseRemaining.toLocaleString()} left</span>
                  </p>
                )}
              </div>
            </div>
            {hasRoster ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {s.players.map((p, i) => (
                  <PlayerCard key={i} player={p} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">Roster not finalized yet.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Photo-forward player card: square headshot (or an initials avatar
 * with a deterministic gold-tinted gradient when no image is set),
 * a small captain armband badge overlaid on the corner when
 * applicable, and the name/role beneath — mirrors the same
 * "portrait card" language used for team logos elsewhere on the page
 * rather than the flatter pill-chip treatment.
 */
function PlayerCard({ player: p }: { player: { name: string; isCaptain?: boolean; image?: string; role?: string } }) {
  return (
    <div className="group flex flex-col items-center gap-2 text-center">
      <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-gold/15 bg-white/[0.03] transition-all duration-300 group-hover:border-gold/50 group-hover:-translate-y-0.5">
        {p.image ? (
          <Image
            src={p.image}
            alt={p.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gold/20 via-black/40 to-black/60">
            <span className="text-gold text-lg font-bold font-cinzel">{initials(p.name)}</span>
          </div>
        )}
        {/* subtle bottom scrim so any future overlaid text (role, jersey #) stays legible */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        {p.isCaptain && (
          <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-gold text-black text-[10px] font-bold font-cinzel flex items-center justify-center shadow-md">
            C
          </span>
        )}
      </div>
      <div className="w-full">
        <p className="text-gray-200 text-xs font-semibold truncate leading-tight">{p.name}</p>
        {p.role && <p className="text-gray-500 text-[10px] truncate">{p.role}</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LEADERBOARD PANEL
// ─────────────────────────────────────────────────────────────
function LeaderboardPanel({ runs, wickets }: { runs: LeaderboardRow[]; wickets: LeaderboardRow[] }) {
  const [tab, setTab] = useState<"runs" | "wickets">(runs.length ? "runs" : "wickets")
  const active = tab === "runs" ? runs : wickets

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-white mb-4 font-cinzel">TOURNAMENT LEADERBOARD</h2>
      <div className="flex gap-2 mb-6">
        {runs.length > 0 && (
          <button
            onClick={() => setTab("runs")}
            className={`font-cinzel text-xs uppercase tracking-wide px-4 py-2 rounded-md border transition-all ${
              tab === "runs" ? "bg-gold text-black border-gold" : "border-gold/20 text-gray-300 hover:border-gold/50"
            }`}
          >
            Most Runs
          </button>
        )}
        {wickets.length > 0 && (
          <button
            onClick={() => setTab("wickets")}
            className={`font-cinzel text-xs uppercase tracking-wide px-4 py-2 rounded-md border transition-all ${
              tab === "wickets" ? "bg-gold text-black border-gold" : "border-gold/20 text-gray-300 hover:border-gold/50"
            }`}
          >
            Most Wickets
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {active.map((row) => (
          <div key={row.player} className="flex items-center justify-between border border-gold/10 rounded-md p-3 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span className="text-gold font-bold font-cinzel w-5 text-center">{row.rank}</span>
              <span className="h-8 w-8 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center font-cinzel">
                {initials(row.player)}
              </span>
              <div>
                <p className="text-white text-sm font-semibold">{row.player}</p>
                <p className="text-gray-400 text-xs">{row.team}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gold font-bold font-cinzel text-lg leading-none">{row.value}</p>
              <p className="text-gray-400 text-xs mt-1">{row.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AWARDS PANEL
// ─────────────────────────────────────────────────────────────
function AwardsPanel({ awards }: { awards: AwardEntry[] }) {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-white mb-4 font-cinzel flex items-center gap-2">
        <Award className="h-5 w-5 text-gold" />
        AWARDS & MILESTONES
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {awards.map((a) => (
          <div key={a.label} className="border border-gold/10 rounded-md p-4 bg-white/[0.02] text-center">
            <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-2">{a.label}</p>
            <p className="text-white font-bold font-cinzel">{a.name}</p>
            <p className="text-gray-400 text-xs mt-1">{a.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}