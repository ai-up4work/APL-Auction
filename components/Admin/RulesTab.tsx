// components/Admin/RulesTab.tsx
"use client";

import { useState } from "react";
import type { AuctionRules } from "@/types/auction";

interface RulesTabProps {
  locked: boolean;
  rules: AuctionRules;
  onRulesChange: (rules: AuctionRules) => void;
}

function LockBanner() {
  return (
    <div
      className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
      style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fbbf24", flexShrink: 0 }}>lock</span>
      <p style={{ fontSize: "12px", color: "#fbbf24", fontFamily: "'Inter', sans-serif" }}>
        Auction rules are <strong>locked</strong> while the auction is live. Stop or re-auction to make changes.
      </p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
      {children}
    </span>
  );
}

function NumberInput({
  value, onChange, min, suffix, disabled,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; suffix?: string; disabled?: boolean;
}) {
  return (
    <div
      className="flex items-center rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.1)", background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)" }}
    >
      <input
        type="number"
        min={min ?? 0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        style={{ color: disabled ? "#45464d" : "#e0e3e4", fontFamily: "'Geist', monospace", cursor: disabled ? "not-allowed" : "auto" }}
        onFocus={(e) => { if (!disabled) e.currentTarget.parentElement!.style.borderColor = "rgba(228,93,53,0.5)"; }}
        onBlur={(e)  => { e.currentTarget.parentElement!.style.borderColor = "rgba(255,255,255,0.1)"; }}
      />
      {suffix && (
        <span className="px-3 text-xs border-l" style={{ color: "#c6c6cd", borderColor: "rgba(255,255,255,0.08)", fontFamily: "'Geist', monospace" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{
        background: checked ? (disabled ? "rgba(228,93,53,0.3)" : "#e45d35") : "rgba(255,255,255,0.1)",
        border: checked ? "1px solid rgba(228,93,53,0.5)" : "1px solid rgba(255,255,255,0.15)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full shadow-md"
        style={{ background: "#fff", left: checked ? "calc(100% - 22px)" : "2px", transition: "left 0.2s ease" }}
      />
    </button>
  );
}

function Section({
  title, description, children, accent,
}: {
  title: string; description?: string; children: React.ReactNode; accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "rgba(16,20,21,0.4)",
        backdropFilter: "blur(24px)",
        border: accent ? "1px solid rgba(228,93,53,0.2)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div className="mb-5 pb-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <h3 style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: "18px", fontWeight: 700, color: "#e0e3e4" }}>
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs" style={{ color: "#c6c6cd", fontFamily: "'Inter', sans-serif" }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function TierRow({
  tier, index, onChange, onDelete, isLast, disabled,
}: {
  tier: AuctionRules["tiers"][number];
  index: number;
  onChange: (i: number, key: string, value: number) => void;
  onDelete: (i: number) => void;
  isLast: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 items-center" style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}>
      <div>
        {index === 0 && <FieldLabel>From (pts, inclusive)</FieldLabel>}
        <NumberInput value={tier.from} onChange={(v) => onChange(index, "from", v)} disabled={disabled} />
      </div>
      <div>
        {index === 0 && <FieldLabel>To (pts, exclusive)</FieldLabel>}
        {isLast ? (
          <div
            className="flex items-center rounded-lg px-3 py-2 text-sm"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "#45464d", fontFamily: "'Geist', monospace" }}
          >
            No limit
          </div>
        ) : (
          <NumberInput value={tier.to ?? 0} onChange={(v) => onChange(index, "to", v)} disabled={disabled} />
        )}
      </div>
      <div>
        {index === 0 && <FieldLabel>Increment (pts)</FieldLabel>}
        <NumberInput value={tier.increment} onChange={(v) => onChange(index, "increment", v)} suffix="pts" disabled={disabled} />
      </div>
      <div style={{ paddingTop: index === 0 ? "20px" : "0" }}>
        <button
          onClick={() => !disabled && onDelete(index)}
          disabled={index === 0 || disabled}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: index === 0 || disabled ? "#313536" : "#c6c6cd",
            cursor: index === 0 || disabled ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => { if (index !== 0 && !disabled) (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
          onMouseLeave={(e) => { if (index !== 0 && !disabled) (e.currentTarget as HTMLElement).style.color = "#c6c6cd"; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
        </button>
      </div>
    </div>
  );
}

const DEFAULT_RULES: AuctionRules = {
  totalPoints:           50000,
  teamSize:              16,
  basePrice:             500,
  targetPlayerCount:     140, // ← ADDED
  ownerParticipation:    true,
  ownerSelfPurchaseCost: 3000,
  maxOverseasPlayers:    0,
  reservePointsEnforced: true,
  maxBidTimeSeconds:     300,
  unsoldReentryRounds:   1,
  tiers: [
    { from: 500,   to: 1000,  increment: 100  },
    { from: 1000,  to: 3000,  increment: 200  },
    { from: 3000,  to: 6000,  increment: 500  },
    { from: 6000,  to: 20000, increment: 1000 },
    { from: 20000, to: null,  increment: 2000 },
  ],
};

export default function RulesTab({ locked, rules, onRulesChange }: RulesTabProps) {
  const [saved, setSaved] = useState(false);

  function update<K extends keyof AuctionRules>(key: K, value: AuctionRules[K]) {
    if (locked) return;
    onRulesChange({ ...rules, [key]: value });
  }

  function updateTier(index: number, key: string, value: number) {
    if (locked) return;
    const tiers = rules.tiers.map((t, i) => (i === index ? { ...t, [key]: value } : t));
    onRulesChange({ ...rules, tiers });
  }

  function addTier() {
    if (locked) return;
    const last = rules.tiers[rules.tiers.length - 1];
    const newFrom = last.to ?? last.from + 10000;
    const fixed = rules.tiers.map((t, i) =>
      i === rules.tiers.length - 1 ? { ...t, to: newFrom } : t
    );
    onRulesChange({
      ...rules,
      tiers: [...fixed, { from: newFrom, to: null, increment: last.increment + 500 }],
    });
  }

  function deleteTier(index: number) {
    if (index === 0 || locked) return;
    const tiers = rules.tiers.filter((_, i) => i !== index);
    tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], to: null };
    onRulesChange({ ...rules, tiers });
  }

  function handleSave() {
    if (locked) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    if (locked) return;
    onRulesChange(DEFAULT_RULES);
  }

  const auctionedSlots      = rules.ownerParticipation ? rules.teamSize - 1 : rules.teamSize;
  const ownerCommitted      = rules.ownerParticipation ? rules.ownerSelfPurchaseCost : 0;
  const availableForAuction = rules.totalPoints - ownerCommitted;
  const minBudgetNeeded     = auctionedSlots * rules.basePrice;
  const budgetWarning       = availableForAuction < minBudgetNeeded;

  return (
    <>
      {/* Save toast */}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-xl z-50"
        style={{
          background: "rgba(16,20,21,0.95)",
          border: "1px solid rgba(228,93,53,0.4)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          opacity: saved ? 1 : 0,
          transform: saved ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(16px)",
          transition: "all 0.3s ease",
          pointerEvents: "none",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#34d399" }}>check_circle</span>
        <span style={{ fontFamily: "'Geist', monospace", fontSize: "12px", color: "#e0e3e4" }}>Settings saved successfully</span>
      </div>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: "32px", lineHeight: "40px", fontWeight: 700, letterSpacing: "0.01em", color: "#e0e3e4" }}>
            Auction Settings
          </h2>
          <p className="mt-1.5 max-w-xl" style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", lineHeight: "22px", color: "#c6c6cd" }}>
            Configure the rules that govern the auction. These settings apply globally to all teams and players.
          </p>
        </div>
        <div className="flex items-center gap-3 ml-6">
          <button
            onClick={handleReset}
            disabled={locked}
            className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: locked ? "#45464d" : "#c6c6cd",
              fontFamily: "'Geist', monospace",
              cursor: locked ? "not-allowed" : "pointer",
            }}
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={locked}
            className="px-5 py-2.5 font-bold flex items-center gap-1.5 rounded-xl transition-all whitespace-nowrap"
            style={{
              background: locked ? "rgba(255,255,255,0.06)" : "#e45d35",
              color: locked ? "#45464d" : "#fff",
              boxShadow: locked ? "none" : "0 0 20px rgba(228,93,53,0.25)",
              fontFamily: "'Geist', monospace",
              fontSize: "12px",
              cursor: locked ? "not-allowed" : "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>save</span>
            Save Settings
          </button>
        </div>
      </div>

      {locked && <LockBanner />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">

          {budgetWarning && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fbbf24", flexShrink: 0 }}>warning</span>
              <p style={{ fontSize: "12px", color: "#fbbf24", fontFamily: "'Inter', sans-serif" }}>
                {rules.ownerParticipation
                  ? `Owner teams have ${availableForAuction.toLocaleString()} pts after the ${ownerCommitted.toLocaleString()} pt buy-in, but need at least ${minBudgetNeeded.toLocaleString()} pts to fill ${auctionedSlots} slots at base price.`
                  : `Total points (${rules.totalPoints.toLocaleString()}) may not cover ${rules.teamSize} players at ${rules.basePrice} pts each (min ${minBudgetNeeded.toLocaleString()} pts needed).`
                }
              </p>
            </div>
          )}

          {/* Budget & Squad */}
          <Section title="Budget & Squad Rules" description="Core constraints every team must stay within during the auction." accent>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Total Points per Team</FieldLabel>
                <NumberInput value={rules.totalPoints} onChange={(v) => update("totalPoints", v)} suffix="pts" disabled={locked} />
                <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>Budget each franchise has to spend.</p>
              </div>
              <div>
                <FieldLabel>Squad Size</FieldLabel>
                <NumberInput value={rules.teamSize} min={1} onChange={(v) => update("teamSize", v)} suffix="players" disabled={locked} />
                <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>
                  {rules.ownerParticipation
                    ? `${auctionedSlots} via auction + 1 owner pre-fill.`
                    : "All slots filled via auction."}
                </p>
              </div>
              <div>
                <FieldLabel>Base Price (all players)</FieldLabel>
                <NumberInput value={rules.basePrice} min={1} onChange={(v) => update("basePrice", v)} suffix="pts" disabled={locked} />
                <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>Starting bid including unsold re-entries.</p>
              </div>
              <div>
                <FieldLabel>Max Overseas Players</FieldLabel>
                <NumberInput value={rules.maxOverseasPlayers} min={0} onChange={(v) => update("maxOverseasPlayers", v)} suffix="per team" disabled={locked} />
                <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>Set to 0 for no overseas limit.</p>
              </div>

              {/* ── TARGET PLAYER COUNT — NEW FIELD ── */}
              <div className="col-span-2">
                <FieldLabel>Target Player Pool Size</FieldLabel>
                <NumberInput
                  value={rules.targetPlayerCount}
                  min={1}
                  onChange={(v) => update("targetPlayerCount", v)}
                  suffix="players"
                  disabled={locked}
                />
                <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>
                  Minimum players required in the pool before the auction can launch. Set to match how many players you plan to add.
                </p>
              </div>
            </div>
          </Section>

          {/* Bidding Tiers */}
          <Section
            title="Bidding Increment Tiers"
            description="Minimum raise amounts at each price level. 'From' is inclusive, 'To' is exclusive. The last tier has no upper limit."
          >
            <div className="flex flex-col gap-3">
              {rules.tiers.map((tier, i) => (
                <TierRow
                  key={i} tier={tier} index={i}
                  onChange={updateTier} onDelete={deleteTier}
                  isLast={i === rules.tiers.length - 1} disabled={locked}
                />
              ))}
            </div>
            {!locked && (
              <button
                onClick={addTier}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold transition-all"
                style={{ background: "rgba(228,93,53,0.08)", border: "1px dashed rgba(228,93,53,0.3)", color: "#e45d35", fontFamily: "'Geist', monospace" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(228,93,53,0.14)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(228,93,53,0.08)"; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>add</span>
                Add Tier
              </button>
            )}
          </Section>

          {/* Bidding Safeguards */}
          <Section title="Bidding Safeguards" description="Protections that keep the auction from breaking, regardless of how teams behave.">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#e0e3e4" }}>Reserve Points Enforcement</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#c6c6cd" }}>
                    Blocks a bid if it would leave a team unable to fill remaining slots at base price.
                  </p>
                </div>
                <Toggle checked={rules.reservePointsEnforced} onChange={(v) => update("reservePointsEnforced", v)} disabled={locked} />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <FieldLabel>Max Bid Time per Player</FieldLabel>
                  <NumberInput value={rules.maxBidTimeSeconds} min={30} onChange={(v) => update("maxBidTimeSeconds", v)} suffix="sec" disabled={locked} />
                  <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>Hard cap on total floor time per player.</p>
                </div>
                <div>
                  <FieldLabel>Unsold Re-entry Rounds</FieldLabel>
                  <NumberInput value={rules.unsoldReentryRounds} min={0} onChange={(v) => update("unsoldReentryRounds", v)} suffix="rounds" disabled={locked} />
                  <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>After this many passes, player is Unsold — Final.</p>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <Section title="Owner Participation">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#e0e3e4" }}>Allow owners to play</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#c6c6cd" }}>Owner buys into their own squad, pre-filling 1 slot.</p>
                </div>
                <Toggle checked={rules.ownerParticipation} onChange={(v) => update("ownerParticipation", v)} disabled={locked} />
              </div>
              {rules.ownerParticipation && (
                <div>
                  <FieldLabel>Owner Self-Purchase Cost</FieldLabel>
                  <NumberInput value={rules.ownerSelfPurchaseCost} min={0} onChange={(v) => update("ownerSelfPurchaseCost", v)} suffix="pts" disabled={locked} />
                  <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>
                    Deducted from team budget at auction start. Fills 1 of {rules.teamSize} squad slots.
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Current config summary */}
          <div className="p-4 rounded-xl" style={{ background: "rgba(228,93,53,0.04)", border: "1px solid rgba(228,93,53,0.15)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ fontFamily: "'Geist', monospace", color: "#e45d35" }}>
              Current Config
            </p>
            <div className="flex flex-col gap-3">
              {[
                { label: "Budget / team",    value: `${rules.totalPoints.toLocaleString()} pts` },
                { label: "Squad size",       value: rules.ownerParticipation ? `${auctionedSlots} auctioned + 1 owner` : `${rules.teamSize} players` },
                { label: "Base price",       value: `${rules.basePrice} pts` },
                { label: "Player pool target", value: `${rules.targetPlayerCount} players` }, // ← ADDED
                { label: "Bid tiers",        value: `${rules.tiers.length} tiers` },
                { label: "Overseas cap",     value: rules.maxOverseasPlayers === 0 ? "No limit" : `${rules.maxOverseasPlayers} / team` },
                { label: "Owner buy-in",     value: rules.ownerParticipation ? `${rules.ownerSelfPurchaseCost.toLocaleString()} pts` : "Disabled" },
                { label: "Reserve points",   value: rules.reservePointsEnforced ? "Enforced" : "Off" },
                { label: "Max bid time",     value: `${rules.maxBidTimeSeconds}s / player` },
                { label: "Unsold re-entry",  value: `${rules.unsoldReentryRounds} round${rules.unsoldReentryRounds === 1 ? "" : "s"}` },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between text-[11px] pb-2.5 border-b last:border-b-0 last:pb-0"
                  style={{ borderColor: "rgba(255,255,255,0.05)" }}
                >
                  <span style={{ color: "#9a9aa5", fontFamily: "'Geist', monospace" }}>{row.label}</span>
                  <span style={{ color: "#e0e3e4", fontFamily: "'Geist', monospace", fontWeight: 700 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Danger zone */}
          <div className="p-4 rounded-xl" style={{ background: "rgba(24,28,29,0.3)", border: "1px solid rgba(248,113,113,0.15)", opacity: locked ? 0.5 : 1 }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ fontFamily: "'Geist', monospace", color: "#f87171" }}>
              Danger Zone
            </p>
            <p className="text-[11px] mb-3" style={{ color: "#9a9aa5" }}>
              Changing settings after the auction has started may cause inconsistencies.
            </p>
            <button
              onClick={handleReset}
              disabled={locked}
              className="w-full py-2 rounded-lg text-[11px] font-bold transition-all"
              style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: locked ? "#45464d" : "#f87171",
                fontFamily: "'Geist', monospace",
                cursor: locked ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => { if (!locked) (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.14)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.08)"; }}
            >
              Reset All to Defaults
            </button>
          </div>
        </div>
      </div>
    </>
  );
}