"use client";

import { useState } from "react";

const DEFAULT_SETTINGS = {
  totalPoints: 50000,
  teamSize: 16,
  basePrice: 500,
  ownerParticipation: true,
  ownerSelfPurchaseCost: 3000,
  maxOverseasPlayers: 0,
  reservePointsEnforced: true,
  maxBidTimeSeconds: 300,
  unsoldReentryRounds: 1,
  tiers: [
    { from: 500,   to: 1000,  increment: 100  },
    { from: 1000,  to: 3000,  increment: 200  },
    { from: 3000,  to: 6000,  increment: 500  },
    { from: 6000,  to: 20000, increment: 1000 },
    { from: 20000, to: null,  increment: 2000 },
  ],
};

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

function FieldLabel({ children }) {
  return (
    <span className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
      {children}
    </span>
  );
}

// FIX: focus/blur handlers are on the <input>, not the wrapper <div>
function NumberInput({ value, onChange, min, prefix, suffix, disabled }) {
  return (
    <div
      className="flex items-center rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.1)", background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)" }}
    >
      {prefix && (
        <span className="px-3 text-xs border-r" style={{ color: "#c6c6cd", borderColor: "rgba(255,255,255,0.08)", fontFamily: "'Geist', monospace" }}>
          {prefix}
        </span>
      )}
      <input
        type="number"
        min={min ?? 0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        style={{ color: disabled ? "#45464d" : "#e0e3e4", fontFamily: "'Geist', monospace", cursor: disabled ? "not-allowed" : "auto" }}
        onFocus={(e) => { if (!disabled) e.currentTarget.parentElement.style.borderColor = "rgba(228,93,53,0.5)"; }}
        onBlur={(e)  => { e.currentTarget.parentElement.style.borderColor = "rgba(255,255,255,0.1)"; }}
      />
      {suffix && (
        <span className="px-3 text-xs border-l" style={{ color: "#c6c6cd", borderColor: "rgba(255,255,255,0.08)", fontFamily: "'Geist', monospace" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
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

function Section({ title, description, children, accent }) {
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

function TierRow({ tier, index, onChange, onDelete, isLast, disabled }) {
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
          <NumberInput value={tier.to ?? ""} onChange={(v) => onChange(index, "to", v)} disabled={disabled} />
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
          onMouseEnter={(e) => { if (index !== 0 && !disabled) e.currentTarget.style.color = "#f87171"; }}
          onMouseLeave={(e) => { if (index !== 0 && !disabled) e.currentTarget.style.color = "#c6c6cd"; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
        </button>
      </div>
    </div>
  );
}

function SaveToast({ show }) {
  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-xl z-50"
      style={{
        background: "rgba(16,20,21,0.95)",
        border: "1px solid rgba(228,93,53,0.4)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        opacity: show ? 1 : 0,
        transform: show ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(16px)",
        transition: "all 0.3s ease",
        pointerEvents: "none",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#34d399" }}>check_circle</span>
      <span style={{ fontFamily: "'Geist', monospace", fontSize: "12px", color: "#e0e3e4" }}>Settings saved successfully</span>
    </div>
  );
}

export default function RulesTab({ locked = false }) {
  const [cfg, setCfg] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  function update(key, value) {
    if (locked) return;
    setCfg((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function updateTier(index, key, value) {
    if (locked) return;
    const tiers = cfg.tiers.map((t, i) => (i === index ? { ...t, [key]: value } : t));
    setCfg((prev) => ({ ...prev, tiers }));
    setDirty(true);
  }

  function addTier() {
    if (locked) return;
    const last = cfg.tiers[cfg.tiers.length - 1];
    const newFrom = last.to ?? last.from + 10000;
    const fixed = cfg.tiers.map((t, i) =>
      i === cfg.tiers.length - 1 ? { ...t, to: newFrom } : t
    );
    setCfg((prev) => ({
      ...prev,
      tiers: [...fixed, { from: newFrom, to: null, increment: last.increment + 500 }],
    }));
    setDirty(true);
  }

  function deleteTier(index) {
    if (index === 0 || locked) return;
    const tiers = cfg.tiers.filter((_, i) => i !== index);
    tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], to: null };
    setCfg((prev) => ({ ...prev, tiers }));
    setDirty(true);
  }

  function handleSave() {
    if (locked) return;
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    if (locked) return;
    setCfg(DEFAULT_SETTINGS);
    setDirty(false);
  }

  const auctionedSlots = cfg.ownerParticipation ? cfg.teamSize - 1 : cfg.teamSize;
  const ownerCommitted = cfg.ownerParticipation ? cfg.ownerSelfPurchaseCost : 0;
  const availableForAuction = cfg.totalPoints - ownerCommitted;
  const minBudgetNeeded = auctionedSlots * cfg.basePrice;
  const budgetWarning = availableForAuction < minBudgetNeeded;

  return (
    <>
      <SaveToast show={saved} />

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2
            style={{
              fontFamily: "'Archivo Narrow', sans-serif",
              fontSize: "32px",
              lineHeight: "40px",
              fontWeight: 700,
              letterSpacing: "0.01em",
              color: "#e0e3e4",
            }}
          >
            Auction Settings
            {dirty && !locked && (
              <span className="ml-3 text-sm font-normal" style={{ color: "rgba(228,93,53,0.7)", fontFamily: "'Geist', monospace" }}>
                • unsaved changes
              </span>
            )}
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
              background: locked ? "rgba(255,255,255,0.06)" : dirty ? "#e45d35" : "rgba(228,93,53,0.3)",
              color: locked ? "#45464d" : "#fff",
              boxShadow: locked || !dirty ? "none" : "0 0 20px rgba(228,93,53,0.25)",
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

          {/* Budget warning */}
          {budgetWarning && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fbbf24", flexShrink: 0 }}>warning</span>
              <p style={{ fontSize: "12px", color: "#fbbf24", fontFamily: "'Inter', sans-serif" }}>
                {cfg.ownerParticipation
                  ? `Owner-participant teams have ${availableForAuction.toLocaleString()} pts available after the ${ownerCommitted.toLocaleString()} pt buy-in, but need at least ${minBudgetNeeded.toLocaleString()} pts to fill their remaining ${auctionedSlots} slots at base price.`
                  : `Total points (${cfg.totalPoints.toLocaleString()}) may not cover ${cfg.teamSize} players at base price ${cfg.basePrice} each (minimum ${minBudgetNeeded.toLocaleString()} pts needed).`
                }
              </p>
            </div>
          )}

          {/* Budget & Squad */}
          <Section title="Budget & Squad Rules" description="Core constraints every team must stay within during the auction." accent>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Total Points per Team</FieldLabel>
                <NumberInput value={cfg.totalPoints} onChange={(v) => update("totalPoints", v)} suffix="pts" disabled={locked} />
                <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>Budget each franchise has to spend across all {cfg.teamSize} players.</p>
              </div>
              <div>
                <FieldLabel>Squad Size</FieldLabel>
                <NumberInput value={cfg.teamSize} min={1} onChange={(v) => update("teamSize", v)} suffix="players" disabled={locked} />
                <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>
                  {cfg.ownerParticipation
                    ? `Each team fills ${cfg.teamSize} slots — ${auctionedSlots} via auction, 1 pre-filled by the owner.`
                    : `Each team must fill exactly this many slots via auction.`}
                </p>
              </div>
              <div>
                <FieldLabel>Base Price (all players)</FieldLabel>
                <NumberInput value={cfg.basePrice} min={1} onChange={(v) => update("basePrice", v)} suffix="pts" disabled={locked} />
                <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>Starting bid for every player, including unsold re-entries.</p>
              </div>
              <div>
                <FieldLabel>Max Overseas Players</FieldLabel>
                <NumberInput value={cfg.maxOverseasPlayers} min={0} onChange={(v) => update("maxOverseasPlayers", v)} suffix="per team" disabled={locked} />
                <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>Set to 0 for no overseas limit.</p>
              </div>
            </div>
          </Section>

          {/* Bidding Tiers */}
          <Section
            title="Bidding Increment Tiers"
            description="Minimum raise amounts at each price level. 'From' is inclusive, 'To' is exclusive. The last tier has no upper limit."
          >
            <div className="flex flex-col gap-3">
              {cfg.tiers.map((tier, i) => (
                <TierRow
                  key={i}
                  tier={tier}
                  index={i}
                  onChange={updateTier}
                  onDelete={deleteTier}
                  isLast={i === cfg.tiers.length - 1}
                  disabled={locked}
                />
              ))}
            </div>
            {!locked && (
              <button
                onClick={addTier}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold transition-all"
                style={{ background: "rgba(228,93,53,0.08)", border: "1px dashed rgba(228,93,53,0.3)", color: "#e45d35", fontFamily: "'Geist', monospace" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(228,93,53,0.14)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(228,93,53,0.08)"; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>add</span>
                Add Tier
              </button>
            )}
          </Section>

          {/* Bidding Safeguards */}
          <Section title="Bidding Safeguards" description="Protections that keep the auction from breaking, regardless of how teams behave.">
            <div className="flex flex-col gap-5">
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "#e0e3e4" }}>Reserve Points Enforcement</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#c6c6cd" }}>
                    Blocks a bid if it would leave a team unable to fill its remaining slots at base price.
                  </p>
                </div>
                <Toggle checked={cfg.reservePointsEnforced} onChange={(v) => update("reservePointsEnforced", v)} disabled={locked} />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <FieldLabel>Max Bid Time per Player</FieldLabel>
                  <NumberInput value={cfg.maxBidTimeSeconds} min={30} onChange={(v) => update("maxBidTimeSeconds", v)} suffix="sec" disabled={locked} />
                  <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>Hard cap on total floor time for one player.</p>
                </div>
                <div>
                  <FieldLabel>Unsold Re-entry Rounds</FieldLabel>
                  <NumberInput value={cfg.unsoldReentryRounds} min={0} onChange={(v) => update("unsoldReentryRounds", v)} suffix="rounds" disabled={locked} />
                  <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>After this many passes, a still-unsold player is marked Unsold — Final.</p>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <Section title="Owner Participation">
            <div className="flex flex-col gap-4">
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "#e0e3e4" }}>Allow owners to play</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#c6c6cd" }}>Owner buys into their own squad, pre-filling 1 slot before the auction starts.</p>
                </div>
                <Toggle checked={cfg.ownerParticipation} onChange={(v) => update("ownerParticipation", v)} disabled={locked} />
              </div>
              {cfg.ownerParticipation && (
                <div>
                  <FieldLabel>Owner Self-Purchase Cost</FieldLabel>
                  <NumberInput value={cfg.ownerSelfPurchaseCost} min={0} onChange={(v) => update("ownerSelfPurchaseCost", v)} suffix="pts" disabled={locked} />
                  <p className="mt-1.5 text-[10px]" style={{ color: "#9a9aa5" }}>
                    Deducted from the team's total budget at auction start. Fills 1 of {cfg.teamSize} squad slots — the remaining {auctionedSlots} are filled through bidding.
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Settings summary */}
          <div
            className="p-4 rounded-xl"
            style={{ background: "rgba(228,93,53,0.04)", border: "1px solid rgba(228,93,53,0.15)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ fontFamily: "'Geist', monospace", color: "#e45d35" }}>
              Current Config
            </p>
            <div className="flex flex-col gap-3">
              {[
                { label: "Budget / team",   value: `${cfg.totalPoints.toLocaleString()} pts` },
                { label: "Squad size",      value: cfg.ownerParticipation ? `${auctionedSlots} auctioned + 1 owner` : `${cfg.teamSize} players` },
                { label: "Base price",      value: `${cfg.basePrice} pts` },
                { label: "Bid tiers",       value: `${cfg.tiers.length} tiers` },
                { label: "Overseas cap",    value: cfg.maxOverseasPlayers === 0 ? "No limit" : `${cfg.maxOverseasPlayers} / team` },
                { label: "Owner buy-in",    value: cfg.ownerParticipation ? `${cfg.ownerSelfPurchaseCost.toLocaleString()} pts` : "Disabled" },
                { label: "Reserve points",  value: cfg.reservePointsEnforced ? "Enforced" : "Off" },
                { label: "Max bid time",    value: `${cfg.maxBidTimeSeconds}s / player` },
                { label: "Unsold re-entry", value: `${cfg.unsoldReentryRounds} round${cfg.unsoldReentryRounds === 1 ? "" : "s"}` },
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
          <div
            className="p-4 rounded-xl"
            style={{ background: "rgba(24,28,29,0.3)", border: "1px solid rgba(248,113,113,0.15)", opacity: locked ? 0.5 : 1 }}
          >
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
              onMouseEnter={(e) => { if (!locked) e.currentTarget.style.background = "rgba(248,113,113,0.14)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
            >
              Reset All to Defaults
            </button>
          </div>
        </div>
      </div>
    </>
  );
}