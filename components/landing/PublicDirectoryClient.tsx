// components/public/PublicDirectoryClient.tsx
"use client"

import { useEffect, useState } from "react"
import { getPublicMatches, getPublicPlayers, getPublicStandings, getPublicTeams, type PublicMatch, type PublicPlayer, type PublicStanding, type PublicTeam } from "@/lib/public-data"

type Kind = "matches" | "players" | "teams" | "standings"

export default function PublicDirectoryClient({ kind }: { kind: Kind }) {
  const [data, setData] = useState<Array<PublicMatch | PublicPlayer | PublicTeam | PublicStanding>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let promise: Promise<Array<PublicMatch | PublicPlayer | PublicTeam | PublicStanding>>

    switch (kind) {
      case "matches":
        promise = getPublicMatches()
        break
      case "players":
        promise = getPublicPlayers()
        break
      case "teams":
        promise = getPublicTeams()
        break
      case "standings":
        promise = getPublicStandings()
        break
    }

    promise.then((rows) => {
      setData(rows)
      setLoading(false)
    })
  }, [kind])

  const copy = {
    matches: ["All matches", "Every fixture, result, and scheduled game in one place."],
    players: ["Players", "Explore every player across the public competition."],
    teams: ["Teams", "Meet the squads and organizations competing this season."],
    standings: ["Standings", "The live table, form, and points race."],
  }[kind]

  return (
    <main className="min-h-screen bg-[#111217] px-5 py-12 text-white md:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#d8ad4c]">Public archive</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-6xl">{copy[0]}</h1>
          <p className="mt-4 text-base leading-7 text-white/60">{copy[1]}</p>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-white/50">Loading public data…</div>
        ) : data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-white/50">No public records are available yet.</div>
        ) : kind === "standings" ? (
          <Standings rows={data as PublicStanding[]} />
        ) : kind === "matches" ? (
          <Matches rows={data as PublicMatch[]} />
        ) : kind === "teams" ? (
          <Teams rows={data as PublicTeam[]} />
        ) : (
          <Players rows={data as PublicPlayer[]} />
        )}
      </div>
    </main>
  )
}

function Matches({ rows }: { rows: PublicMatch[] }) {
  return (
    <div className="grid gap-3">
      {rows.map((m) => (
        <article className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5" key={m.id}>
          <div>
            <p className="text-xs uppercase tracking-widest text-[#d8ad4c]">{m.round}</p>
            <h2 className="mt-2 text-lg font-semibold">
              {m.teamA} <span className="text-white/30">vs</span> {m.teamB}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold">
              {m.scoreA ?? "—"} <span className="text-white/30">–</span> {m.scoreB ?? "—"}
            </p>
            <p className="text-xs capitalize text-white/50">{m.status}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function Teams({ rows }: { rows: PublicTeam[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((t) => (
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6" key={t.id}>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#d8ad4c]/15 text-lg font-bold text-[#d8ad4c]">
            {t.code || t.name.slice(0, 2).toUpperCase()}
          </div>
          <h2 className="text-xl font-semibold">{t.name}</h2>
          <p className="mt-2 text-sm text-white/50">{t.code || "Team"}</p>
        </article>
      ))}
    </div>
  )
}

function Players({ rows }: { rows: PublicPlayer[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((p) => (
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5" key={p.id}>
          <h2 className="font-semibold">{p.name}</h2>
          <p className="mt-1 text-sm text-[#d8ad4c]">{p.role}</p>
          <p className="mt-4 text-sm text-white/50">{p.team}</p>
        </article>
      ))}
    </div>
  )
}

function Standings({ rows }: { rows: PublicStanding[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="grid grid-cols-[1fr_repeat(4,4rem)] gap-3 border-b border-white/10 px-5 py-4 text-xs uppercase tracking-widest text-white/40">
        <span>Team</span>
        <span>P</span>
        <span>W</span>
        <span>L</span>
        <span>Pts</span>
      </div>
      {rows.map((r, i) => (
        <div className="grid grid-cols-[1fr_repeat(4,4rem)] gap-3 border-b border-white/5 px-5 py-4 text-sm last:border-0" key={`${r.team}-${i}`}>
          <span className="font-medium">
            {r.team}
            <small className="ml-2 text-white/40">NRR {r.nrr}</small>
          </span>
          <span>{r.played}</span>
          <span>{r.won}</span>
          <span>{r.lost}</span>
          <span className="font-semibold text-[#d8ad4c]">{r.points}</span>
        </div>
      ))}
    </div>
  )
}