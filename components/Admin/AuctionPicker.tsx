"use client";

import { useEffect, useState } from "react";
import { useAuction } from "@/context/AuctionContext";
import Image from "next/image";

const STATUS_COLOR: Record<string, string> = {
  setup:     "var(--color-outline)",
  live:      "var(--color-success)",
  paused:    "var(--color-warning)",
  completed: "var(--color-theme-orange)",
};
const STATUS_LABEL: Record<string, string> = {
  setup:     "Setup",
  live:      "Live",
  paused:    "Paused",
  completed: "Completed",
};

// ── Auction Card ──────────────────────────────────────────────────────────────
function AuctionCard({
  auction,
  isLast,
  isLoading,
  onSelect,
}: {
  auction: {
    id: string;
    name: string;
    status: string;
    auctionLogo?: string | null;
    teamCount: number;
    playerCount: number;
    createdAt: string | number | Date;
  };
  isLast: boolean;
  isLoading: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      disabled={isLoading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative overflow-hidden text-left flex flex-col gap-3 p-5 rounded-xl"
      style={{
        background: "var(--color-surface-glass)",
        backdropFilter: "blur(24px)",
        border: isLast
          ? "2px solid var(--color-theme-orange)"
          : `1px solid ${hovered ? "rgba(201,151,31,0.4)" : "var(--color-border-overlay)"}`,
        backgroundColor: isLast ? "rgba(201,151,31,0.04)" : undefined,
        boxShadow: isLast || hovered ? "0 4px 24px rgba(201,151,31,0.12)" : "0 4px 20px rgba(0,0,0,0.3)",
        transform: hovered && !isLoading ? "translateY(-3px)" : "translateY(0)",
        transition: "all 0.2s ease",
        cursor: isLoading ? "wait" : "pointer",
      }}
    >
      <div
        className="absolute top-0 right-0 w-36 h-36 rounded-full pointer-events-none"
        style={{
          background: hovered || isLast ? "rgba(201,151,31,0.1)" : "rgba(201,151,31,0.04)",
          transform: "translate(50%,-50%)",
          filter: "blur(36px)",
        }}
      />

      <div className="flex items-center gap-4 relative z-10">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shadow-lg shrink-0"
          style={{
            background: "var(--color-surface-bright)",
            border: isLast ? "2px solid var(--color-theme-orange)" : "1px solid var(--color-outline-variant)",
          }}
        >
          {auction.auctionLogo ? (
            <Image src={auction.auctionLogo} alt="" className="w-14 h-14 object-cover" width={56} height={56}/>
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--color-theme-orange)" }}>
              gavel
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 7px",
                borderRadius: 99,
                border: `1px solid ${STATUS_COLOR[auction.status] ?? "var(--color-outline)"}33`,
                color: STATUS_COLOR[auction.status] ?? "var(--color-outline)",
                background: `${STATUS_COLOR[auction.status] ?? "var(--color-outline)"}18`,
                fontFamily: "var(--font-label-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {STATUS_LABEL[auction.status] ?? auction.status}
            </span>
            {isLast && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 99,
                  color: "var(--color-success)",
                  background: "rgba(52,211,153,0.12)",
                  border: "1px solid rgba(52,211,153,0.3)",
                  fontFamily: "var(--font-label-mono)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Last Opened
              </span>
            )}
          </div>
          <h3
            className="text-lg tracking-tight truncate"
            style={{ fontFamily: "var(--font-headline-md)", fontWeight: 600, color: "var(--color-on-surface)" }}
          >
            {auction.name}
          </h3>
        </div>
      </div>

      <div
        className="flex items-center justify-between pt-3 border-t relative z-10"
        style={{ borderColor: "var(--color-border-overlay)" }}
      >
        <p
          className="text-[10px]"
          style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}
        >
          {auction.teamCount} teams &middot; {auction.playerCount} players
          <br />
          {new Date(auction.createdAt).toLocaleDateString()}
        </p>
        <span
          className="text-[10px] font-bold uppercase tracking-widest shrink-0 flex items-center gap-1"
          style={{ color: "var(--color-theme-orange)", fontFamily: "var(--font-label-mono)" }}
        >
          {isLoading ? (
            <>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 12 }}>
                progress_activity
              </span>
              Loading
            </>
          ) : (
            <>
              Load
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                arrow_forward
              </span>
            </>
          )}
        </span>
      </div>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AuctionPicker({
  onCreateNew,
  onSelectAuction,
}: {
  onCreateNew: (name?: string) => void;
  onSelectAuction: (id: string) => void;
}) {
  const { auctionList, isLoadingList, refreshAuctionList, switchAuction } = useAuction();
  const [newName, setNewName]     = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [lastAuctionId, setLastAuctionId] = useState<string | null>(null);
  const [inputFocused, setInputFocused]   = useState(false);

  useEffect(() => {
    refreshAuctionList();
    setLastAuctionId(localStorage.getItem("apl_auction_id"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(id: string) {
    setLoadingId(id);
    try {
      await switchAuction(id);
      // Tell the parent page to leave the picker and render the dashboard
      // for this auction now that context has the right data loaded.
      onSelectAuction(id);
    } catch (err) {
      console.error("[AuctionPicker] failed to switch auction:", err);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center px-6 py-16 relative overflow-hidden"
      style={{ background: "var(--color-background)", color: "var(--color-on-background)" }}
    >
      {/* Background gradients — consistent with admin shell */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 50% -20%, rgba(200,205,216,0.15) 0%, transparent 70%),
            radial-gradient(circle at 0% 100%, rgba(201,151,31,0.05) 0%, transparent 50%),
            radial-gradient(circle at 100% 100%, rgba(200,205,216,0.05) 0%, transparent 50%)
          `,
          zIndex: 0,
        }}
      />

      <div className="w-full max-w-4xl relative z-10">
        <div className="text-center mb-10">
          <span
            className="text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}
          >
            War Room Admin
          </span>
          <h1
            className="mt-2 text-3xl sm:text-4xl"
            style={{ fontFamily: "var(--font-headline-lg)", fontWeight: 700, letterSpacing: "0.01em", color: "var(--color-on-surface)" }}
          >
            Choose an Auction
          </h1>
          <p
            className="mt-1.5"
            style={{ fontFamily: "var(--font-body-md)", fontSize: "14px", color: "var(--color-on-surface-variant)" }}
          >
            Pick up where you left off, or start something new.
          </p>
        </div>

        {/* Create new */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 mb-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
          style={{
            border: "1px dashed rgba(201,151,31,0.35)",
            background: "var(--color-surface-glass)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: "rgba(201,151,31,0.06)", transform: "translate(40%,-50%)", filter: "blur(40px)" }}
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateNew(newName.trim() || undefined);
            }}
            placeholder="New auction name (e.g. APL Season 2)"
            className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none relative z-10"
            style={{
              background: "var(--color-surface-container-low)",
              border: `1px solid ${inputFocused ? "var(--color-theme-orange)" : "var(--color-border-overlay)"}`,
              color: "var(--color-on-surface)",
              fontFamily: "var(--font-body-md)",
              transition: "border-color 0.15s ease",
            }}
          />
          <button
            onClick={() => onCreateNew(newName.trim() || undefined)}
            className="relative z-10 px-5 py-2.5 rounded-xl text-sm font-black uppercase shrink-0 transition-all hover:-translate-y-0.5"
            style={{
              background: "var(--color-theme-orange)",
              color: "var(--color-on-primary)",
              fontFamily: "var(--font-label-mono)",
              fontSize: "12px",
              letterSpacing: "0.1em",
              boxShadow: "0 0 18px rgba(201,151,31,0.25)",
            }}
          >
            + Create New Auction
          </button>
        </div>

        {/* Existing auctions */}
        {isLoadingList ? (
          <div
            className="flex flex-col items-center justify-center py-24 rounded-xl"
            style={{ border: "1px dashed var(--color-border-overlay)", color: "var(--color-outline)" }}
          >
            <span
              className="material-symbols-outlined animate-spin mb-3"
              style={{ fontSize: 32, color: "var(--color-theme-orange)" }}
            >
              progress_activity
            </span>
            <p className="text-sm" style={{ fontFamily: "var(--font-label-mono)" }}>
              Loading auctions&hellip;
            </p>
          </div>
        ) : auctionList.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 rounded-xl"
            style={{ border: "1px dashed var(--color-border-overlay)", color: "var(--color-outline)" }}
          >
            <span
              className="material-symbols-outlined text-4xl mb-3"
              style={{ color: "var(--color-surface-variant)" }}
            >
              gavel
            </span>
            <p className="text-sm" style={{ fontFamily: "var(--font-label-mono)" }}>
              No saved auctions yet &mdash; create one above to get started.
            </p>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
          >
            {auctionList.map((a) => (
              <AuctionCard
                key={a.id}
                auction={a}
                isLast={a.id === lastAuctionId}
                isLoading={loadingId === a.id}
                onSelect={() => handleSelect(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}