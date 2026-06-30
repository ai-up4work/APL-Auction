// hooks/useOwnerAuth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Drop this at the top of BidRoom. Checks sessionStorage for a valid auth
// token written by the join page. Redirects to the join page if missing.
//
// Usage:
//   const { authed, teamId } = useOwnerAuth(auctionId, teamCode);
//   if (!authed) return null; // redirect is already in flight
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthPayload {
  teamId:     string;
  verifiedAt: number;
}

/** Session is valid for 12 hours */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function sessionKey(auctionId: string, teamCode: string) {
  return `owner_auth_${auctionId}_${teamCode.toLowerCase()}`;
}

export function useOwnerAuth(
  auctionId: string,
  teamCode:  string
): { authed: boolean; teamId: string | null } {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    const key  = sessionKey(auctionId, teamCode);
    const raw  = sessionStorage.getItem(key);

    if (!raw) {
      router.replace(`/owner/${auctionId}/join`);
      return;
    }

    try {
      const payload = JSON.parse(raw) as AuthPayload;
      const age     = Date.now() - payload.verifiedAt;

      if (age > SESSION_TTL_MS) {
        sessionStorage.removeItem(key);
        router.replace(`/owner/${auctionId}/join`);
        return;
      }

      setTeamId(payload.teamId);
      setAuthed(true);
    } catch {
      sessionStorage.removeItem(key);
      router.replace(`/owner/${auctionId}/join`);
    }
  }, [auctionId, teamCode, router]);

  return { authed, teamId };
}