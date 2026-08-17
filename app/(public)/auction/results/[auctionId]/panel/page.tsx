// app/(public)/auction/results/[auctionId]/panel/page.tsx
//
// Auction Results Panel
// ───────────────────────────────────────────────────────────────────────────
// Same visual language and layout as the Mock Auction Simulator (summary
// strip, team roster cards, full sale-log tab, CSV export) but shows the
// REAL, final outcome of an actual auction — no simulation, no randomness,
// no writes to Supabase. Every number here is read directly from:
//
//   • loadAuction(auctionId)     → teams (color/logo/code), rules
//                                   (totalPoints/teamSize), and players
//                                   (captains are identified by
//                                   ownerTeamCode and were never auctioned,
//                                   same convention as the live driver and
//                                   the simulator use).
//   • loadLiveState(auctionId)   → completedLots, the ground-truth record
//                                   of every lot that was actually opened
//                                   and closed by the real auctioneer
//                                   console / live driver (status: "sold"
//                                   | "unsold", winningTeamCode,
//                                   currentBid = actual hammer price).
//
// Team rosters, spend, and the sale log are all derived from these two
// calls — nothing here is computed independently, so this page can never
// disagree with what the live console/owner pages already show for a
// completed (or in-progress) auction.
//
// This route lives under (public) — it's meant to be shareable without an
// auctioneer role, so it intentionally has NO RoleGate. If you want to
// restrict it later, wrap the default export the same way the live driver
// page does.
// ───────────────────────────────────────────────────────────────────────────

"use client";

import React, { use, useCallback, useMemo, useState } from "react";
import { loadAuction } from "@/lib/auctionDb";
import { loadLiveState, type AuctionLot } from "@/lib/auctionLiveDb";
import Image from "next/image";

// ─────────────────────────────────────────────────────────────────────────
// Types (local, loose — mirrors the shapes used elsewhere in the app)
// ─────────────────────────────────────────────────────────────────────────

interface ResultPlayer {
  key: string;
  name: string;
  role: string;
  country: string;
  price: number;      // captain: self-purchase/base cost. sold: actual hammer price.
  isCaptain: boolean;
  lotNumber?: number;  // undefined for captains — they were never auctioned
}

interface ResultTeam {
  key: string;
  code: string;
  name: string;
  color: string;
  logo?: string;
  slots: number;
  totalPoints: number;
  spent: number;
  remaining: number;
  roster: ResultPlayer[];
}

function fmtPts(n: number | undefined | null) {
  return (n ?? 0).toLocaleString();
}

function stdDev(nums: number[]) {
  if (nums.length === 0) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

// ─────────────────────────────────────────────────────────────────────────
// Build the results view straight from real DB state — no randomness, no
// bidding logic, just assembling what actually happened.
// ─────────────────────────────────────────────────────────────────────────
function buildResults(auction: any, completedLots: AuctionLot[]) {
  const totalPoints = auction?.rules?.totalPoints ?? 0;
  const teamSize = auction?.rules?.teamSize ?? 0;

  const teams: ResultTeam[] = (auction?.teams ?? []).map((t: any) => ({
    key: t.supabaseId ?? String(t.id),
    code: t.code,
    name: t.name,
    color: t.color || "#c9971f",
    logo: t.logo,
    slots: teamSize,
    totalPoints,
    spent: 0,
    remaining: totalPoints,
    roster: [] as ResultPlayer[],
  }));
  const teamByCode = new Map(teams.map((t) => [t.code, t]));

  // Captains — seeded onto their own team, never auctioned, cost is
  // whatever was stored on the player row (ownerSelfPurchaseCost at the
  // time captains were assigned).
  for (const p of auction?.players ?? []) {
    if (!p.ownerTeamCode) continue;
    const team = teamByCode.get(p.ownerTeamCode);
    if (!team) continue;
    const price = p.price ?? 0;
    team.roster.push({
      key: p.supabaseId ?? String(p.id),
      name: p.name,
      role: p.role ?? "—",
      country: p.country ?? "",
      price,
      isCaptain: true,
    });
    team.spent += price;
  }

  const soldLots = completedLots.filter((l) => l.status === "sold");
  const soldPlayerIds = new Set(soldLots.map((l) => l.playerId));

  // Unsold = total players who actually went through the live auction pool,
  // minus however many of them ended up sold. "Went through the pool" means
  // no ownerTeamCode — captains and manual roster-adds never had a lot at
  // all, so they're excluded from both sides of the subtraction (same
  // convention the captain-seeding loop above already uses). This doesn't
  // depend on the players.is_unsold_final flag being kept perfectly in
  // sync — it's just total minus sold, computed directly from the same
  // ground-truth data (auction.players + completedLots) everything else on
  // this page already uses.
  const auctionablePlayers = ((auction?.players ?? []) as any[]).filter((p) => !p.ownerTeamCode);
  const unsoldEntries = auctionablePlayers
    .filter((p) => !soldPlayerIds.has(p.supabaseId))
    .map((p) => {
      const lot = completedLots.find((l) => l.playerId === p.supabaseId && l.status === "unsold");
      return {
        key: p.supabaseId ?? String(p.id),
        playerName: p.name as string,
        playerRole: (p.role ?? "—") as string,
        playerCountry: (p.country ?? "") as string,
        lotNumber: lot?.lotNumber as number | undefined,
      };
    });

  for (const lot of soldLots) {
    const team = lot.winningTeamCode ? teamByCode.get(lot.winningTeamCode) : undefined;
    if (!team) continue; // shouldn't happen for a real sold lot, but don't blow up the page if data is inconsistent
    team.roster.push({
      key: `lot-${lot.id}`,
      name: lot.playerName,
      role: lot.playerRole,
      country: lot.playerCountry ?? "",
      price: lot.currentBid,
      isCaptain: false,
      lotNumber: lot.lotNumber,
    });
    team.spent += lot.currentBid;
  }

  for (const team of teams) {
    team.remaining = team.totalPoints - team.spent;
    // Marquee buys first, then captains/cheaper picks — reads nicer on a
    // results page than insertion order.
    team.roster.sort((a, b) => b.price - a.price);
  }

  return { teams, soldLots, unsoldEntries };
}

// ─────────────────────────────────────────────────────────────────────────
// Page content
// ─────────────────────────────────────────────────────────────────────────

function ResultsPanelContent({ auctionId }: { auctionId: string }) {
  const [auction, setAuction] = useState<any>(null);
  const [completedLots, setCompletedLots] = useState<AuctionLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"teams" | "log">("teams");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [state, live] = await Promise.all([
        loadAuction(auctionId),
        loadLiveState(auctionId),
      ]);
      if (!state) throw new Error("Auction not found");
      setAuction(state);
      setCompletedLots(live.completedLots);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load auction results");
    }
  }, [auctionId]);

  React.useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const { teams, soldLots, unsoldEntries } = useMemo(
    () => (auction ? buildResults(auction, completedLots) : { teams: [], soldLots: [], unsoldEntries: [] }),
    [auction, completedLots]
  );

  const rosterCounts = useMemo(() => teams.map((t) => t.roster.length), [teams]);
  const balance = useMemo(() => stdDev(rosterCounts), [rosterCounts]);
  const totalSpent = useMemo(() => teams.reduce((sum, t) => sum + t.spent, 0), [teams]);

  const highestSale = useMemo(() => {
    if (soldLots.length === 0) return null;
    return soldLots.reduce((max, l) => (l.currentBid > max.currentBid ? l : max), soldLots[0]);
  }, [soldLots]);

  function downloadCsv() {
    const rows = [
      ["Lot #", "Player", "Role", "Country", "Status", "Price", "Team"],
      ...teams.flatMap((team) =>
        team.roster.map((p) => [
          p.lotNumber != null ? String(p.lotNumber) : "—",
          p.name,
          p.role,
          p.country,
          p.isCaptain ? "Captain" : "Sold",
          String(p.price),
          team.name,
        ])
      ),
      ...unsoldEntries.map((l) => [
        l.lotNumber != null ? String(l.lotNumber) : "—",
        l.playerName,
        l.playerRole,
        l.playerCountry,
        "Unsold",
        "",
        "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auction-results-${auctionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="text-center">
          <span
            className="material-symbols-outlined text-theme-orange animate-spin block mb-4"
            style={{ fontSize: 48 }}
          >
            progress_activity
          </span>
          <p className="font-mono-geist text-[12px] uppercase tracking-[0.12em] text-on-surface-variant">
            Loading auction results…
          </p>
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <span className="material-symbols-outlined text-red-400 block mb-4" style={{ fontSize: 40 }}>
            error
          </span>
          <p className="font-mono-geist text-xs text-red-400 uppercase tracking-widest mb-4">
            {error ?? "Could not load this auction"}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
            className="px-5 py-2 rounded font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] bg-white/5 border border-white/10 hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isComplete = auction.status === "completed";

  return (
    <div className="bg-background text-on-background min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-style: normal; line-height: 1; display: inline-block;
        }
        .glass-panel {
          background: var(--color-surface-glass, rgba(255,255,255,0.03));
          backdrop-filter: blur(20px);
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.08));
        }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-30 flex flex-wrap gap-4 justify-between items-center px-6 py-4 glass-panel border-b border-white/10">
        <div>
          <p
            className={`font-mono-geist text-[10px] uppercase tracking-[0.2em] mb-1 flex items-center gap-2 ${
              isComplete ? "text-theme-orange" : "text-indigo-300"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{isComplete ? "verified" : "hourglass_top"}</span>
            {isComplete ? "Final Auction Results" : `Results So Far — Auction ${auction.status}`}
          </p>
          <h1 className="font-archivo text-2xl font-bold italic uppercase tracking-tight">
            {auction?.session?.auctionName ?? "Auction"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-5 py-2 rounded font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] bg-primary text-background hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${refreshing ? "animate-spin" : ""}`}>refresh</span>
            {refreshing ? "Refreshing…" : "Refresh Results"}
          </button>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 px-5 py-2 rounded font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] bg-background border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
        </div>
      </header>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4">
        {[
          { label: "Players Sold", value: soldLots.length, icon: "gavel" },
          { label: "Unsold", value: unsoldEntries.length, icon: "block" },
          { label: "Total Spent", value: `${fmtPts(totalSpent)} pts`, icon: "payments" },
          {
            label: "Highest Sale",
            value: highestSale ? `${fmtPts(highestSale.currentBid)} pts` : "—",
            icon: "local_fire_department",
            hint: highestSale ? `${highestSale.playerName} · ${highestSale.winningTeamCode}` : undefined,
          },
        ].map((s) => (
          <div key={s.label} className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-theme-orange text-base">{s.icon}</span>
              <span className="font-mono-geist text-[9px] uppercase tracking-[0.15em] text-on-surface-variant">
                {s.label}
              </span>
            </div>
            <p className="font-archivo text-2xl font-bold">{s.value}</p>
            {s.hint && <p className="font-mono-geist text-[8px] text-on-surface-variant mt-1">{s.hint}</p>}
          </div>
        ))}
      </div>

      <div className="px-6 pb-2">
        <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.14em]">
          Roster balance across {teams.length} franchises (σ): <span className="text-on-surface font-bold">{balance.toFixed(2)}</span> — lower means more even squad sizes
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 flex gap-2 mb-2">
        {(["teams", "log"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-t font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] transition-all ${
              tab === t
                ? "bg-white/10 text-theme-orange border-b-2 border-theme-orange"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t === "teams" ? "Team Rosters" : "Full Sale Log"}
          </button>
        ))}
      </div>

      {/* Teams tab */}
      {tab === "teams" && (
        <div className="px-6 pb-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams
            .slice()
            .sort((a, b) => b.roster.length - a.roster.length)
            .map((team) => {
              const pctFilled = Math.round((team.roster.length / Math.max(team.slots, 1)) * 100);
              const pctPurseUsed = Math.round((team.spent / Math.max(team.totalPoints, 1)) * 100);
              return (
                <div key={team.key} className="glass-panel rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-archivo font-bold text-sm overflow-hidden"
                        style={{ background: team.color, color: "#fff" }}
                      >
                        {team.logo ? (
                          <Image src={team.logo} alt={team.code} width={40} height={40} className="object-cover w-full h-full" />
                        ) : (
                          team.code.slice(0, 2)
                        )}
                      </div>
                      <div>
                        <p className="font-archivo font-bold text-sm uppercase leading-tight">{team.name}</p>
                        <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.1em]">
                          Squad {team.roster.length}/{team.slots}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono-geist text-[9px] px-2 py-1 rounded bg-white/5 uppercase tracking-[0.1em]">
                      {fmtPts(team.remaining)} pts left
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pctFilled}%`, background: team.color }} />
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-theme-orange/60" style={{ width: `${pctPurseUsed}%` }} />
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {team.roster.length === 0 && (
                      <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-widest py-4 text-center">
                        No players yet
                      </p>
                    )}
                    {team.roster.map((p) => (
                      <div
                        key={p.key}
                        className="flex items-center justify-between px-3 py-2 rounded bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-archivo text-xs font-bold uppercase truncate flex items-center gap-1.5">
                            {p.name}
                            {p.isCaptain && (
                              <span className="px-1.5 py-0.5 rounded text-[7px] font-bold normal-case bg-theme-orange/15 text-theme-orange">
                                C
                              </span>
                            )}
                          </p>
                          <p className="font-mono-geist text-[8px] text-on-surface-variant">
                            {p.role} {p.country ? `· ${p.country}` : ""}
                          </p>
                        </div>
                        <span className="font-mono-geist text-[10px] font-bold text-theme-orange shrink-0 ml-2">
                          {fmtPts(p.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Log tab */}
      {tab === "log" && (
        <div className="px-6 pb-10 space-y-6">
          <div className="glass-panel rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/5 font-mono-geist text-[9px] uppercase tracking-[0.12em] text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Lot #</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Sold For</th>
                  <th className="px-4 py-3">Team</th>
                </tr>
              </thead>
              <tbody className="font-mono-geist text-[11px]">
                {soldLots
                  .slice()
                  .sort((a, b) => a.lotNumber - b.lotNumber)
                  .map((l) => {
                    const team = teams.find((t) => t.code === l.winningTeamCode);
                    return (
                      <tr key={l.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                        <td className="px-4 py-2.5 opacity-60">#{l.lotNumber}</td>
                        <td className="px-4 py-2.5 font-archivo font-bold uppercase">{l.playerName}</td>
                        <td className="px-4 py-2.5 opacity-70">{l.playerRole}</td>
                        <td className="px-4 py-2.5 text-theme-orange font-bold">{fmtPts(l.currentBid)}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: team?.color ?? "#888" }} />
                            {team?.name ?? l.winningTeamCode}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {unsoldEntries
                  .slice()
                  .sort((a, b) => (a.lotNumber ?? 0) - (b.lotNumber ?? 0))
                  .map((l) => (
                    <tr key={l.key} className="border-t border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 opacity-60">{l.lotNumber != null ? `#${l.lotNumber}` : "—"}</td>
                      <td className="px-4 py-2.5 font-archivo font-bold uppercase">{l.playerName}</td>
                      <td className="px-4 py-2.5 opacity-70">{l.playerRole}</td>
                      <td className="px-4 py-2.5 opacity-50">—</td>
                      <td className="px-4 py-2.5">
                        <span className="text-red-400 uppercase">Unsold</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────

export default function AuctionResultsPanelPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = use(params);
  return <ResultsPanelContent auctionId={auctionId} />;
}