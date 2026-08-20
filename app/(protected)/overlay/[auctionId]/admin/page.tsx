// app/(protected)/overlay/[auctionId]/admin/page.tsx
"use client";

/* ─────────────────────────────────────────────────────────────
   FIX — this file previously contained the ENTIRE OverlayAdminConsole
   implementation inline, declared as:

     export default function OverlayAdminConsole({
       auctionId = null,
       matchId = null,
     }: { auctionId?: string | null; matchId?: string | null } = {}) { ... }

   That signature is wrong for a page component. Next.js invokes a page
   at app/(protected)/overlay/[auctionId]/admin/page.tsx with
   `{ params }` (where `params.auctionId` is the URL segment) — it has
   no way to pass arbitrary `auctionId`/`matchId` props. Since this
   component never read `params`, the `= null` defaults were ALWAYS
   what got used, on every single visit, regardless of the URL. That's
   why the Match Setup panel always showed the "No auction linked yet"
   warning and always hydrated the hardcoded defaultMatchSetup()
   (Jaffna Sharks vs Mount Warriors) instead of the real match.

   This file is now a thin resolver:
     1. Read the real `auctionId` from the route params.
     2. Resolve it to the actual `matches.id` via getOrCreateMatch()
        (lib/matchPersistence.ts) — this is also what creates a fresh
        `matches` row the first time this auction's overlay is opened.
     3. Render the real OverlayAdminConsole (moved to
        components/overlays/admin/OverlayAdminConsole.tsx) with both
        real ids.

   NOTE on Next.js versions: in Next.js 15+, `params` on a client page
   component is a Promise and must be unwrapped with React's `use()`.
   On Next.js 13/14, `params` is a plain object and can be read
   directly. This file handles both — if you know you're on <15,
   the `isThenable` branch is dead code and can be deleted.
   ───────────────────────────────────────────────────────────── */

import { use, useEffect, useState } from "react";
import OverlayAdminConsole from "@/components/overlays/admin/new/OverlayAdminConsole";
import { getOrCreateMatch } from "@/lib/matchPersistence";

type RouteParams = { auctionId: string };

function isThenable(value: unknown): value is Promise<RouteParams> {
  return !!value && typeof value === "object" && typeof (value as any).then === "function";
}

export default function OverlayAdminPage({ params }: { params: RouteParams | Promise<RouteParams> }) {
  // Next.js 15+ passes params as a Promise for client components;
  // 13/14 pass a plain object. `use()` only works on the Promise case
  // — calling it on a plain object would throw, hence the branch.
  const resolvedParams = isThenable(params) ? use(params) : params;
  const auctionId = resolvedParams.auctionId;

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

  // Avoid a flash of the "no match yet" / default-team state while the
  // real match row is still being resolved/created.
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