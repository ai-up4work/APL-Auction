// context/OwnerAuthContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface OwnerAuthState {
  teamId:     string;
  verifiedAt: number;
}

interface OwnerAuthContextValue {
  isAuthenticated: boolean;
  isChecking:      boolean;
  teamId:          string | null;
  logout:          () => void;
}

const OwnerAuthContext = createContext<OwnerAuthContextValue | null>(null);

export function useOwnerAuth(): OwnerAuthContextValue {
  const ctx = useContext(OwnerAuthContext);
  if (!ctx) throw new Error("useOwnerAuth must be used inside <OwnerAuthProvider>");
  return ctx;
}

function sessionKey(auctionId: string, teamCode: string) {
  return `owner_auth_${auctionId}_${teamCode.toLowerCase()}`;
}

// How long a verified PIN session stays valid before requiring re-entry.
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export function OwnerAuthProvider({
  auctionId,
  teamCode,
  children,
}: {
  auctionId: string;
  teamCode:  string;
  children:  React.ReactNode;
}) {
  const router = useRouter();
  const [isChecking, setIsChecking]           = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [teamId, setTeamId]                   = useState<string | null>(null);

  useEffect(() => {
    const key = sessionKey(auctionId, teamCode);
    const raw = sessionStorage.getItem(key);

    if (!raw) {
      router.replace(`/owner/${auctionId}/join`);
      return;
    }

    try {
      const parsed: OwnerAuthState = JSON.parse(raw);
      const expired = Date.now() - parsed.verifiedAt > SESSION_TTL_MS;

      if (!parsed.teamId || expired) {
        sessionStorage.removeItem(key);
        router.replace(`/owner/${auctionId}/join`);
        return;
      }

      setTeamId(parsed.teamId);
      setIsAuthenticated(true);
      setIsChecking(false);
    } catch {
      sessionStorage.removeItem(key);
      router.replace(`/owner/${auctionId}/join`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, teamCode]);

  function logout() {
    sessionStorage.removeItem(sessionKey(auctionId, teamCode));
    router.replace(`/owner/${auctionId}/join`);
  }

  // While checking or redirecting, render a spinner — never the protected
  // children, to avoid a flash of authenticated content.
  if (isChecking || !isAuthenticated) {
    return (
      <div className="h-dvh bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-theme-orange/15 border-t-theme-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <OwnerAuthContext.Provider value={{ isAuthenticated, isChecking, teamId, logout }}>
      {children}
    </OwnerAuthContext.Provider>
  );
}