"use client";

import { use, useEffect, useState } from "react";
import OverlayAdminConsole from "@/components/overlays/admin/new/OverlayAdminConsole";
import { getOrCreateMatch, type GetOrCreateMatchResult } from "@/lib/matchPersistence";

type RouteParams = { auctionId: string };

export default function OverlayAdminPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { auctionId } = use(params);

  const [matchId, setMatchId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<GetOrCreateMatchResult["error"]>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    setMatchId(null);
    setLoadError(null);

    getOrCreateMatch(auctionId).then(({ match, error }) => {
      if (cancelled) return;
      setMatchId(match?.id ?? null);
      setLoadError(error);
      setResolving(false);
    });

    return () => {
      cancelled = true;
    };
  }, [auctionId]);

  if (resolving) {
    return (
      <div className="bg-background text-on-background min-h-screen flex items-center justify-center">
        <p className="font-mono-geist text-xs uppercase tracking-[0.2em] text-on-surface-variant">
          Loading match…
        </p>
      </div>
    );
  }

  // FIX — previously a failed getOrCreateMatch silently fell through
  // to <OverlayAdminConsole matchId={null} />, which runs entirely on
  // hardcoded placeholder state (default team names/logos) with no
  // indication anything went wrong. Surface the real error instead —
  // most commonly this is an RLS policy rejecting the SELECT or
  // INSERT on `matches` for the current auth context.
  if (loadError) {
    return (
      <div className="bg-background text-on-background min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-400/25 bg-red-500/5 p-6 flex flex-col gap-3 text-center">
          <p className="font-archivo text-lg font-bold uppercase text-red-400">Couldn&apos;t load match</p>
          <p className="font-mono-geist text-[11px] text-on-surface-variant leading-relaxed">
            {loadError.message}
          </p>
          {loadError.code && (
            <p className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-wide">
              code: {loadError.code}
              {loadError.hint ? ` · hint: ${loadError.hint}` : ""}
            </p>
          )}
          <p className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-wide">
            step: {loadError.context}
          </p>
        </div>
      </div>
    );
  }

  if (!matchId) {
    return (
      <div className="bg-background text-on-background min-h-screen flex items-center justify-center">
        <p className="font-mono-geist text-xs uppercase tracking-[0.2em] text-on-surface-variant">
          No match found for this auction.
        </p>
      </div>
    );
  }

  return <OverlayAdminConsole auctionId={auctionId} matchId={matchId} />;
}