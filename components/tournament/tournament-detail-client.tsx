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
} from "lucide-react"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import SectionDivider from "@/components/section-divider"
import RelatedTournaments from "@/components/tournament/related-tournaments"
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
      ? "bg-red-600 hover:bg-red-700"
      : status === "Completed"
        ? "bg-gray-600 hover:bg-gray-700"
        : "bg-green-600 hover:bg-green-700"

  const hasLive = !!tournament.liveMatch
  const hasPoints = !!tournament.pointsTable?.length
  const hasFixtures = !!tournament.fixtures?.length
  const hasBracket = !!tournament.bracket?.length
  const hasSquads = !!tournament.squads?.length
  const hasLeaderboard = !!(tournament.runsLeaderboard?.length || tournament.wicketsLeaderboard?.length)
  const hasAwards = !!tournament.awards?.length

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
                {hasLive && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold font-cinzel px-3 py-1.5 rounded-full animate-pulse">
                    <Radio className="h-3 w-3" />
                    LIVE
                  </div>
                )}
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-black/50 border border-gold/20 p-1 rounded-lg w-full justify-start mb-6 flex-wrap h-auto gap-1">
                  {hasLive && (
                    <TabsTrigger
                      value="live"
                      className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                    >
                      Live
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                  >
                    Overview
                  </TabsTrigger>
                  {hasPoints && (
                    <TabsTrigger
                      value="points"
                      className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                    >
                      Points Table
                    </TabsTrigger>
                  )}
                  {hasFixtures && (
                    <TabsTrigger
                      value="schedule"
                      className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                    >
                      Schedule
                    </TabsTrigger>
                  )}
                  {hasBracket && (
                    <TabsTrigger
                      value="bracket"
                      className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                    >
                      Bracket
                    </TabsTrigger>
                  )}
                  {hasSquads && (
                    <TabsTrigger
                      value="squads"
                      className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                    >
                      Squads
                    </TabsTrigger>
                  )}
                  {hasLeaderboard && (
                    <TabsTrigger
                      value="stats"
                      className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                    >
                      Stats
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="prizes"
                    className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-4 py-2 rounded-md transition-all duration-300"
                  >
                    Prizes
                  </TabsTrigger>
                </TabsList>

                {/* LIVE */}
                {hasLive && (
                  <TabsContent value="live" className="mt-0">
                    <LiveScorePanel match={tournament.liveMatch!} />
                  </TabsContent>
                )}

                {/* OVERVIEW */}
                <TabsContent value="overview" className="mt-0">
                  <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4 font-cinzel">ABOUT THE TOURNAMENT</h2>
                    <p className="text-gray-300 mb-6">
                      {tournament.description ||
                        `${tournament.title} is run on Valiant League — ${tournament.by.toLowerCase()}. Live scoring, automatic points tables, and stream-ready broadcast overlays, all from one console.`}
                    </p>
                    <ul className="text-gray-300 space-y-2">
                      <li>• Ball-by-ball live scoring synced straight to this page</li>
                      <li>• Points table and NRR calculated automatically after every match</li>
                      <li>• Broadcast overlay layer ready for OBS or any streaming setup</li>
                    </ul>
                  </div>
                  {hasAwards && <AwardsPanel awards={tournament.awards!} />}
                </TabsContent>

                {/* POINTS TABLE */}
                {hasPoints && (
                  <TabsContent value="points" className="mt-0">
                    <PointsTablePanel rows={tournament.pointsTable!} />
                  </TabsContent>
                )}

                {/* SCHEDULE */}
                {hasFixtures && (
                  <TabsContent value="schedule" className="mt-0">
                    <SchedulePanel fixtures={tournament.fixtures!} />
                  </TabsContent>
                )}

                {/* BRACKET */}
                {hasBracket && (
                  <TabsContent value="bracket" className="mt-0">
                    <BracketPanel matches={tournament.bracket!} slug={slug} />
                  </TabsContent>
                )}

                {/* SQUADS */}
                {hasSquads && (
                  <TabsContent value="squads" className="mt-0">
                    <SquadsPanel squads={tournament.squads!} />
                  </TabsContent>
                )}

                {/* STATS / LEADERBOARD */}
                {hasLeaderboard && (
                  <TabsContent value="stats" className="mt-0">
                    <LeaderboardPanel
                      runs={tournament.runsLeaderboard || []}
                      wickets={tournament.wicketsLeaderboard || []}
                    />
                  </TabsContent>
                )}
                
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

// ─────────────────────────────────────────────────────────────
// LIVE SCORE PANEL
// ─────────────────────────────────────────────────────────────
function LiveScorePanel({ match }: { match: LiveMatch }) {
  const chasing = !!match.target
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white font-cinzel flex items-center gap-2">
          <Radio className="h-5 w-5 text-red-500" />
          LIVE SCORE
        </h2>
        {match.matchStatus === "live" && (
          <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold font-cinzel">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
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
function SchedulePanel({ fixtures }: { fixtures: Fixture[] }) {
  const statusBadge = (s: Fixture["status"]) => {
    if (s === "live") return <Badge className="bg-red-600 hover:bg-red-700">Live</Badge>
    if (s === "completed") return <Badge className="bg-gray-600 hover:bg-gray-700">Completed</Badge>
    return <Badge className="bg-green-600 hover:bg-green-700">Upcoming</Badge>
  }

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-white mb-4 font-cinzel flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-gold" />
        MATCH SCHEDULE
      </h2>
      <div className="space-y-3">
        {fixtures.map((f) => (
          <div
            key={f.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-gold/10 rounded-md p-4 bg-white/[0.02]"
          >
            <div>
              <p className="text-white font-semibold">
                {f.team1} <span className="text-gray-500 font-normal">vs</span> {f.team2}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {f.date} · {f.time} · {f.venue}
              </p>
              {f.result && <p className="text-gold text-xs mt-1">{f.result}</p>}
            </div>
            <div>{statusBadge(f.status)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// BRACKET PANEL (playoff stage)
// ─────────────────────────────────────────────────────────────
function BracketPanel({ matches, slug }: { matches: BracketMatch[]; slug: string }) {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8 overflow-x-auto">
      <h2 className="text-2xl font-bold text-white mb-6 font-cinzel flex items-center gap-2">
        <Network className="h-5 w-5 text-gold" />
        PLAYOFF BRACKET
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-[520px] sm:min-w-0">
        {matches.map((m) => {
          const playable = hasMatchDetail(m.id)
          const card = (
            <div
              className={`border border-gold/10 rounded-md p-4 bg-white/[0.02] transition-all ${
                playable ? "hover:border-gold/60 hover:bg-white/[0.04] cursor-pointer" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gold text-xs font-bold font-cinzel uppercase tracking-wide">{m.label}</span>
                {m.date && <span className="text-gray-500 text-xs">{m.date}</span>}
              </div>
              <BracketTeamRow team={m.team1} isWinner={m.winner === m.team1.short} />
              <BracketTeamRow team={m.team2} isWinner={m.winner === m.team2.short} />
              {playable && (
                <p className="text-gold text-[10px] uppercase tracking-widest font-cinzel mt-3 text-right">
                  View match →
                </p>
              )}
            </div>
          )

          return playable ? (
            <Link key={m.id} href={`/tournament/${slug}/match/${m.id}`}>
              {card}
            </Link>
          ) : (
            <div key={m.id}>{card}</div>
          )
        })}
      </div>
    </div>
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
      {squads.map((s) => (
        <div key={s.team} className="bg-black/50 border border-gold/20 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gold" />
              <h3 className="text-white font-bold font-cinzel">{s.team}</h3>
            </div>
            <p className="text-gray-400 text-xs flex items-center gap-1.5">
              <Users className="h-3 w-3" /> {s.players.length} players · Capt. {s.captain}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.players.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-gold/10 rounded-full pl-1 pr-3 py-1">
                <span className="h-6 w-6 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center font-cinzel">
                  {initials(p.name)}
                </span>
                <span className="text-gray-300 text-xs">
                  {p.name}
                  {p.isCaptain && <span className="text-gold ml-1">(C)</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
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