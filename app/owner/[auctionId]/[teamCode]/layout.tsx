// app/owner/%5BauctionId%5D/%5BteamCode%5D/layout.tsx
"use client";

import React, { use } from "react";
import { OwnerAuthProvider } from "@/context/OwnerAuthContext";
import { OwnerProvider } from "@/context/OwnerContext";

export default function OwnerTeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params:   Promise<{ auctionId: string; teamCode: string }>;
}) {
  const { auctionId, teamCode } = use(params);

  return (
    <OwnerAuthProvider auctionId={auctionId} teamCode={teamCode}>
      <OwnerProvider auctionId={auctionId} teamCode={teamCode}>
        {children}
      </OwnerProvider>
    </OwnerAuthProvider>
  );
}