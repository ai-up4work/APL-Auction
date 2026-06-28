"use client";

import React, { useEffect, useState } from "react";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import InlineBottomNav from "@/components/InlineBottomNav";
import BudgetRing from "@/components/BudgetRing";

const BID_COLOR = "#e45d35";

export default function FinancialsPage() {
  const [showAvgSpend, setShowAvgSpend] = useState(true);

  // Overflow check: hide avg spend if content overflows the body
  useEffect(() => {
    const check = () => {
      setShowAvgSpend(true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const body = document.getElementById("budget-body");
        const content = document.getElementById("budget-content");
        if (!body || !content) return;
        if (content.scrollHeight > body.clientHeight) {
          setShowAvgSpend(false);
        }
      }));
    };
    const raf = requestAnimationFrame(check);
    window.addEventListener("resize", check);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", check); };
  }, []);

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

      <div className="bg-[#101415] text-[#e0e3e4] h-[100dvh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <header className="shrink-0 h-16 flex items-center justify-between px-4
                           border-b border-white/10
                           bg-[rgba(16,20,21,0.6)] backdrop-blur-xl z-20">
          <h1 className="font-['Archivo_Narrow'] text-[28px] font-bold uppercase tracking-tighter text-[#dae2fd] leading-none">
            FINANCIALS
          </h1>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[#dae2fd]">notifications</span>
            <span className="material-symbols-outlined text-[#dae2fd]">settings</span>
          </div>
        </header>

        {/* ── Body: exact space between header and nav ── */}
        <div id="budget-body" className="flex-1 min-h-0 overflow-hidden">
          <div
            id="budget-content"
            className="h-full flex flex-col px-4 pt-3 pb-3"
            style={{ gap: "clamp(6px, 1.2svh, 12px)" }}
          >

            {/* Hero: flex-1 absorbs all leftover height after cards claim theirs */}
            <section className="glass-panel rounded-xl flex-1 min-h-0 flex items-center justify-center relative overflow-hidden">
              <BudgetRing
                startAmount={30_000}
                endAmount={32_400}
                utilization={64.8}
                currency="CR"
                duration={1500}
              />
            </section>

            {/* Bento grid: shrink-0 so hero absorbs spare space, not cards */}
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
                    className="material-symbols-outlined text-[#ffb5a0]"
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
                >17,600</div>
                <div
                  className="h-2 w-full rounded-full mt-2 overflow-hidden"
                  style={{ background: "#1e2223" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: "35.2%",
                      background: "linear-gradient(90deg, #e45d35 0%, #ffb5a0 100%)",
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
                    className="material-symbols-outlined text-[#ffb5a0]"
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
                  06{" "}
                  <span
                    className="text-[#c6c6cd] font-normal"
                    style={{ fontSize: "clamp(12px, 2svh, 16px)" }}
                  >/ 15</span>
                </div>
                <div
                  className="font-['Geist'] text-[#c6c6cd] mt-1"
                  style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                >Required: 9 Players</div>
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
                        className="material-symbols-outlined text-[#ffb5a0]"
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
                      1,955{" "}
                      <span
                        className="font-['Geist'] text-[#c6c6cd]"
                        style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                      >CR</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-['Geist'] text-[#c6c6cd] uppercase"
                      style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                    >Target Avg</div>
                    <div
                      className="font-['Inter'] text-[#ffb5a0]"
                      style={{ fontSize: "clamp(12px, 2svh, 16px)" }}
                    >3,333 CR</div>
                  </div>
                </div>
              )}

              {/* Max Bid Capacity — always fully visible */}
              <div
                className="glass-panel rounded-xl col-span-2 flex flex-col gap-1.5 border-l-4"
                style={{
                  padding: "clamp(10px, 1.8svh, 20px)",
                  background: "linear-gradient(135deg, #1c2021, #272b2c)",
                  borderLeftColor: BID_COLOR,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined"
                    style={{ color: BID_COLOR, fontSize: "clamp(16px, 2.2svh, 20px)" }}
                  >gavel</span>
                  <span
                    className="font-['Geist'] text-[#c6c6cd] uppercase font-bold tracking-wider"
                    style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                  >Maximum Bid Capacity</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-['Archivo_Narrow'] font-bold"
                    style={{ fontSize: "clamp(26px, 4.5svh, 36px)", color: BID_COLOR }}
                  >23,400</span>
                  <span
                    className="font-['Archivo_Narrow'] text-[#c6c6cd]"
                    style={{ fontSize: "clamp(16px, 2.8svh, 22px)" }}
                  >CR</span>
                </div>
                <p
                  className="font-['Geist'] text-[#c6c6cd] opacity-80 leading-relaxed"
                  style={{ fontSize: "clamp(8px, 1.1svh, 10px)" }}
                >
                  Calculated based on maintaining a minimum 500 CR reserve for all remaining 9 required slots.
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* ── Nav: in-flow so body height is mathematically exact ── */}
        <InlineBottomNav />
      </div>
    </MobileOnlyWrapper>
  );
}