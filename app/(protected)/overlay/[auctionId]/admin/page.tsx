"use client";

import { use, useEffect, useState } from "react";
import OverlayAdminConsole from "@/components/overlays/admin/new/OverlayAdminConsole";
import { getOrCreateMatch } from "@/lib/matchPersistence";

type RouteParams = { auctionId: string };

export default function OverlayAdminPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { auctionId } = use(params);

  const [matchId, setMatchId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    setMatchId(null);

    getOrCreateMatch(auctionId).then((match) => {
      if (cancelled) return;
      setMatchId(match?.id ?? null);
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

  return <OverlayAdminConsole auctionId={auctionId} matchId={matchId} />;
}