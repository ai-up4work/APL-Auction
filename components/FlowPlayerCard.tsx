// components/FlowPlayerCard.tsx
"use client";

import React from "react";
import Image from "next/image";

export type FlowPlayerCardStatus = "locked" | "pending" | "sold" | "unsold";

export interface FlowPlayerCardProps {
  id: string;
  name: string;
  img: string | null;
  status: FlowPlayerCardStatus;
  /** Display price string, e.g. "500 PTS" or "Unsold" */
  price: string;
  teamShortCode?: string | null;

  /** Re-entry / permanent-unsold flags — optional, only the live watch page uses these */
  isFinal?: boolean;
  reentryCount?: number;

  isHighlighted: boolean;
  isDimmed: boolean;
  onClick?: () => void;

  /** Set false to disable click interaction (locked players on the watch page) */
  clickable?: boolean;
}

// Status -> ring color used on the compact (icon-only) avatar so identity
// is still readable without any text on small screens.
const STATUS_RING: Record<FlowPlayerCardStatus, string> = {
  sold: "ring-green-500/70",
  unsold: "ring-red-900/60",
  pending: "ring-theme-orange/70",
  locked: "ring-white/10",
};

export function FlowPlayerCard({
  id,
  name,
  img,
  status,
  price,
  teamShortCode,
  isFinal = false,
  reentryCount = 0,
  isHighlighted,
  isDimmed,
  onClick,
  clickable = true,
}: FlowPlayerCardProps) {
  const isLocked = status === "locked";
  const isUnsoldP = status === "unsold";
  const isSoldP = status === "sold";
  const isPending = status === "pending";
  const isClickable = clickable && !isLocked;

  // On mobile the card is icon-only until it's the active selection —
  // tapping a highlighted card is what reveals the name/status text.
  // `sm:flex` (and friends) restore the full card on larger viewports
  // regardless of selection state.
  const textVisibilityClass = isHighlighted ? "flex" : "hidden sm:flex";

  const statusLabel = isSoldP
    ? `Sold to ${teamShortCode ?? "unknown team"} for ${price}`
    : isUnsoldP
    ? `Unsold, base ${price}`
    : isPending
    ? "On the block now"
    : `Base ${price}`;

  return (
    <div
      id={`player-${id}`}
      role="button"
      aria-label={`${name}. ${statusLabel}`}
      aria-pressed={isHighlighted}
      onClick={() => {
        if (isClickable) onClick?.();
      }}
      className={[
        "glass-panel p-0.5 sm:p-1 rounded-xl flex items-center gap-3 transition-all duration-300 relative overflow-hidden",
        // Bounds the card's width on mobile so `truncate` on the name has
        // something to truncate against once text is revealed on select.
        // Without this, a highlighted card sizes to its content (since the
        // list uses items-start/items-end for icon-only shrink-to-fit) and
        // spills out of the flow-pool column into the canvas gutter.
        // Reverts to natural width at sm: and up, where the full card
        // layout is always shown anyway.
        "max-w-[78vw] sm:max-w-none",
        isLocked ? "opacity-40 cursor-not-allowed" : isClickable ? "cursor-pointer" : "",
        isHighlighted
          ? "ring-1 ring-theme-orange shadow-[0_0_15px_rgba(201,151,31,0.3)] bg-white/10"
          : "border border-white/5",
        isDimmed ? "opacity-30" : "",
        isUnsoldP && !isHighlighted ? "border-l-2 border-l-red-900/60" : "",
        isSoldP && !isHighlighted ? "border-r-2 border-r-green-500/50" : "",
        isPending && !isHighlighted ? "border border-theme-orange/40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 ring-2 sm:ring-0",
          STATUS_RING[status],
          isUnsoldP ? "grayscale opacity-40" : "bg-surface-container-highest",
        ].join(" ")}
      >
        {img ? (
          <Image src={img} className="w-full h-full object-cover" alt="" width={64} height={64} />
        ) : (
          <div className="w-full h-full bg-surface-container-highest" />
        )}
      </div>

      <div className={["min-w-0 flex-1 flex-col", textVisibilityClass].join(" ")}>
        <div className="flex items-center gap-2">
          <p
            className={[
              "font-semibold text-sm truncate font-archivo",
              isUnsoldP ? "text-white/30 line-through decoration-red-900/60" : "text-white",
            ].join(" ")}
          >
            {name}
          </p>

          {isUnsoldP && (
            <span className="shrink-0 font-mono-geist text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-red-950/60 text-red-500/70 border border-red-900/40">
              {isFinal ? "UNSOLD · FINAL" : `UNSOLD${reentryCount > 0 ? ` · R${reentryCount}` : ""}`}
            </span>
          )}

          {isPending && (
            <span className="shrink-0 font-mono-geist text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-theme-orange/15 text-theme-orange border border-theme-orange/30 animate-pulse">
              LIVE
            </span>
          )}
        </div>

        <p
          className={[
            "text-[10px] font-mono font-medium mt-0.5 uppercase",
            isSoldP
              ? "text-green-400"
              : isUnsoldP
              ? "text-red-900/80"
              : isPending
              ? "text-theme-orange"
              : "text-on-surface-variant",
          ].join(" ")}
        >
          {isSoldP
            ? `SOLD • ${teamShortCode ?? "—"}`
            : isUnsoldP
            ? `BASE: ${price}`
            : isPending
            ? "ON THE BLOCK"
            : `BASE: ${price}`}
        </p>
      </div>

      {isUnsoldP && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl opacity-20">
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{
              background:
                "repeating-linear-gradient(-45deg,transparent,transparent 6px,rgba(180,0,0,0.15) 6px,rgba(180,0,0,0.15) 7px)",
            }}
          />
        </div>
      )}
    </div>
  );
}