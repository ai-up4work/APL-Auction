"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import InlineBottomNav from "@/components/InlineBottomNav";
import BudgetRing from "@/components/BudgetRing";
import { supabase } from "@/lib/supabase";

// NOTE: BID_COLOR constant removed — it was a hardcoded "#e45d35" that
// bypassed globals.css entirely. Every place that used it now uses the
// `theme-orange` Tailwind utility classes (text-theme-orange, bg-theme-orange,
// border-theme-orange, border-l-theme-orange) which read from
// `--color-theme-orange` in globals.css, exactly like squad/history pages do.

// ── types ─────────────────────────────────────────────────────────────────────
interface BudgetState {
  remainingPurse: number;   // teams.remaining_purse
  roster:         number;   // teams.roster  (players bought so far)
  totalPoints:    number;   // rules.total_points
  teamSize:       number;   // rules.team_size
  basePrice:      number;   // rules.base_price  (min reserve per slot)
}

interface TeamInfo {
  id:    string;
  name:  string;
  code:  string;
  color: string;
  logo:  string;
}

// ── derived helpers ───────────────────────────────────────────────────────────
function derive(b: BudgetState) {
  const totalSpent     = b.totalPoints - b.remainingPurse;
  const slotsLeft      = b.teamSize - b.roster;
  const avgSpend       = b.roster > 0 ? Math.round(totalSpent / b.roster) : 0;
  const targetAvg      = b.teamSize > 0 ? Math.round(b.totalPoints / b.teamSize) : 0;
  const maxBidCapacity = Math.max(0, b.remainingPurse - slotsLeft * b.basePrice);
  const utilization    = b.totalPoints > 0
    ? Math.round(Math.min(100, (totalSpent / b.totalPoints) * 100) * 10) / 10
    : 0;
  const spentPct       = utilization;

  return { totalSpent, slotsLeft, avgSpend, targetAvg, maxBidCapacity, utilization, spentPct };
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

// ── component ─────────────────────────────────────────────────────────────────
export default function FinancialsPage() {
  const params    = useParams();
  const auctionId = params?.auctionId as string;
  const teamCode  = (params?.teamCode as string)?.toUpperCase();

  const [team,        setTeam]        = useState<TeamInfo | null>(null);
  const [budget,      setBudget]      = useState<BudgetState | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [showAvgSpend,setShowAvgSpend]= useState(true);
  const [bright,      setBright]      = useState(true);

  // blinking dot for "live" indicator (matches squad/history pages)
  useEffect(() => {
    const id = setInterval(() => setBright((p) => !p), 1000);
    return () => clearInterval(id);
  }, []);

  // ── overflow check (unchanged from original) ──────────────────────────────
  useEffect(() => {
    const check = () => {
      setShowAvgSpend(true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const body    = document.getElementById("budget-body");
        const content = document.getElementById("budget-content");
        if (!body || !content) return;
        if (content.scrollHeight > body.clientHeight) setShowAvgSpend(false);
      }));
    };
    const raf = requestAnimationFrame(check);
    window.addEventListener("resize", check);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", check); };
  }, [budget]); // re-run whenever data changes so overflow is always accurate

  // ── initial load ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!auctionId || !teamCode) return;
    try {
      // Resolve team
      const { data: teamRow, error: tErr } = await supabase
        .from("teams")
        .select("id, name, code, color, logo, remaining_purse, roster")
        .eq("auction_id", auctionId)
        .eq("code", teamCode)
        .maybeSingle();

      if (tErr || !teamRow) { setError("Team not found."); setLoading(false); return; }
      setTeam({
        id:    teamRow.id,
        name:  teamRow.name,
        code:  teamRow.code,
        color: teamRow.color,
        logo:  teamRow.logo ?? "",
      });

      // Fetch rules
      const { data: rulesRow } = await supabase
        .from("rules")
        .select("total_points, team_size, base_price")
        .eq("auction_id", auctionId)
        .maybeSingle();

      setBudget({
        remainingPurse: teamRow.remaining_purse ?? 0,
        roster:         teamRow.roster          ?? 0,
        totalPoints:    rulesRow?.total_points  ?? 0,
        teamSize:       rulesRow?.team_size     ?? 0,
        basePrice:      rulesRow?.base_price    ?? 500,
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load financials.");
    } finally {
      setLoading(false);
    }
  }, [auctionId, teamCode]);

  useEffect(() => { load(); }, [load]);

  // ── realtime: purse / roster changes ─────────────────────────────────────
  useEffect(() => {
    if (!auctionId || !team?.id) return;
    const teamId = team.id;

    const sub = supabase
      .channel(`budget-team-${auctionId}-${teamId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "teams",
          filter: `id=eq.${teamId}`,
        },
        (payload) => {
          const r = payload.new as any;
          setBudget((prev) => prev
            ? {
                ...prev,
                remainingPurse: r.remaining_purse ?? prev.remainingPurse,
                roster:         r.roster          ?? prev.roster,
              }
            : prev
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [auctionId, team?.id]);

  // ── loading / error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <MobileOnlyWrapper>
        <div className="bg-background min-h-screen flex items-center justify-center">
          <div className="text-center text-[#c6c6cd]">
            <div className="w-8 h-8 rounded-lg border-2 border-transparent border-t-theme-orange animate-spin mx-auto mb-3" />
            <p className="text-[13px]">Loading financials…</p>
          </div>
        </div>
      </MobileOnlyWrapper>
    );
  }

  if (error || !budget) {
    return (
      <MobileOnlyWrapper>
        <div className="bg-background min-h-screen flex items-center justify-center p-6">
          <p className="text-theme-orange text-center text-sm">
            {error ?? "No data available."}
          </p>
        </div>
      </MobileOnlyWrapper>
    );
  }

  const { totalSpent, slotsLeft, avgSpend, targetAvg, maxBidCapacity, utilization, spentPct } =
    derive(budget);

  return (
    <MobileOnlyWrapper>
      <style>{`
        .glass-panel {
          background: rgba(16,20,21,0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.10);
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
        }
      `}</style>

      <div className="bg-background text-on-background h-[100dvh] flex flex-col overflow-hidden font-inter">

        {/* ── Header — team identity header (matches squad/bid/history pages) ── */}
        <header className="shrink-0 h-16 flex items-center justify-between px-4
                           border-b border-outline-variant
                           bg-[rgba(16,20,21,0.6)] backdrop-blur-xl z-20">
          <div className="flex items-center gap-2.5">
            <div
              className="w-[38px] h-[38px] rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                backgroundColor: team?.logo ? "transparent" : (team?.color ? `${team.color}22` : "#1e2324"),
                boxShadow: `0 0 18px ${team?.color ?? "var(--color-theme-orange)"}33`,
                border: `1px solid ${team?.color ?? "var(--color-theme-orange)"}44`,
              }}
            >
              {team?.logo ? (
                <Image
                  src={team.logo}
                  alt={team.name}
                  width={38}
                  height={38}
                  style={{ objectFit: "contain", width: "100%", height: "100%", padding: 0 }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  className="font-['Archivo_Narrow'] text-[12px] font-extrabold uppercase tracking-tighter"
                  style={{ color: team?.color ?? "var(--color-theme-orange)" }}
                >
                  {(team?.code ?? teamCode)?.slice(0, 3)}
                </span>
              )}
            </div>
            <div>
              <h1 className="font-['Archivo_Narrow'] text-[20px] font-bold uppercase tracking-tighter text-[#dae2fd] leading-none">
                {team?.name ?? teamCode} FINANCIALS
              </h1>
              
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[#dae2fd]">notifications</span>
            <span className="material-symbols-outlined text-[#dae2fd]">settings</span>
          </div>
        </header>

        {/* ── Body ── */}
        <div id="budget-body" className="flex-1 min-h-0 overflow-hidden">
          <div
            id="budget-content"
            className="h-full flex flex-col px-4 pt-3 pb-3"
            style={{ gap: "clamp(6px, 1.2svh, 12px)" }}
          >

            {/* Hero ring */}
            <section className="glass-panel rounded-xl flex-1 min-h-0 flex items-center justify-center relative overflow-hidden">
              <BudgetRing
                startAmount={budget.totalPoints}
                endAmount={budget.remainingPurse}
                utilization={utilization}
                currency="Points"
                duration={1500}
              />
            </section>

            {/* Bento grid */}
            <div
              className="grid grid-cols-2 shrink-0"
              style={{ gap: "clamp(6px, 1.2svh, 12px)" }}
            >

              {/* Total Spent */}
              <div
                className="glass-panel rounded-xl flex flex-col gap-1"
                style={{ padding: "clamp(10px, 1.8svh, 16px)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="material-symbols-outlined text-theme-orange"
                    style={{ fontSize: "clamp(14px, 2svh, 18px)" }}
                  >payments</span>
                  <span
                    className="font-['Geist'] text-[#c6c6cd] uppercase tracking-wider"
                    style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                  >Total Spent</span>
                </div>
                <div
                  className="font-['Archivo_Narrow'] font-semibold text-[#dae2fd]"
                  style={{ fontSize: "clamp(18px, 3svh, 24px)" }}
                >{fmt(totalSpent)}</div>
                <div
                  className="h-2 w-full rounded-full mt-2 overflow-hidden"
                  style={{ background: "#1e2223" }}
                >
                  <div
                    className="h-full rounded-full bg-theme-orange"
                    style={{
                      width: `${spentPct}%`,
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
              </div>

              {/* Slots Left */}
              <div
                className="glass-panel rounded-xl flex flex-col gap-1"
                style={{ padding: "clamp(10px, 1.8svh, 16px)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="material-symbols-outlined text-theme-orange"
                    style={{ fontSize: "clamp(14px, 2svh, 18px)" }}
                  >groups</span>
                  <span
                    className="font-['Geist'] text-[#c6c6cd] uppercase tracking-wider"
                    style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                  >Slots Left</span>
                </div>
                <div
                  className="font-['Archivo_Narrow'] font-semibold text-[#dae2fd]"
                  style={{ fontSize: "clamp(18px, 3svh, 24px)" }}
                >
                  {String(slotsLeft).padStart(2, "0")}{" "}
                  <span
                    className="text-[#c6c6cd] font-normal"
                    style={{ fontSize: "clamp(12px, 2svh, 16px)" }}
                  >/ {budget.teamSize}</span>
                </div>
                <div
                  className="font-['Geist'] text-[#c6c6cd] mt-1"
                  style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                >Required: {slotsLeft} Player{slotsLeft !== 1 ? "s" : ""}</div>
              </div>

              {/* Average Spend — hidden on short screens */}
              {showAvgSpend && (
                <div
                  className="glass-panel rounded-xl col-span-2 flex justify-between items-center"
                  style={{ padding: "clamp(10px, 1.8svh, 16px)" }}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="material-symbols-outlined text-theme-orange"
                        style={{ fontSize: "clamp(14px, 2svh, 18px)" }}
                      >leaderboard</span>
                      <span
                        className="font-['Geist'] text-[#c6c6cd] uppercase tracking-wider"
                        style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                      >Average Spend</span>
                    </div>
                    <div
                      className="font-['Archivo_Narrow'] font-semibold text-[#dae2fd]"
                      style={{ fontSize: "clamp(18px, 3svh, 24px)" }}
                    >
                      {fmt(avgSpend)}{" "}
                      <span
                        className="font-['Geist'] text-[#c6c6cd]"
                        style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                      >Points</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-['Geist'] text-[#c6c6cd] uppercase"
                      style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                    >Target Avg</div>
                    <div
                      className="font-['Inter'] text-theme-orange"
                      style={{ fontSize: "clamp(12px, 2svh, 16px)" }}
                    >{fmt(targetAvg)} Points</div>
                  </div>
                </div>
              )}

              {/* Max Bid Capacity */}
              <div
                className="glass-panel rounded-xl col-span-2 flex flex-col gap-1.5 border-l-4 border-l-theme-orange"
                style={{
                  padding: "clamp(10px, 1.8svh, 20px)",
                  background: "linear-gradient(135deg, #1c2021, #272b2c)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-theme-orange"
                    style={{ fontSize: "clamp(16px, 2.2svh, 20px)" }}
                  >gavel</span>
                  <span
                    className="font-['Geist'] text-[#c6c6cd] uppercase font-bold tracking-wider"
                    style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                  >Maximum Bid Capacity</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-['Archivo_Narrow'] font-bold text-theme-orange"
                    style={{ fontSize: "clamp(26px, 4.5svh, 36px)" }}
                  >{fmt(maxBidCapacity)}</span>
                  <span
                    className="font-['Archivo_Narrow'] text-[#c6c6cd]"
                    style={{ fontSize: "clamp(16px, 2.8svh, 22px)" }}
                  >Points</span>
                </div>
                <p
                  className="font-['Geist'] text-[#c6c6cd] opacity-80 leading-relaxed"
                  style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                >
                  Calculated based on maintaining a minimum {fmt(budget.basePrice)} Points reserve
                  for all remaining {slotsLeft} required slot{slotsLeft !== 1 ? "s" : ""}.
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* ── Nav ── */}
        <InlineBottomNav />
      </div>
    </MobileOnlyWrapper>
  );
}