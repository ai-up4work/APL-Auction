"use client";

import React, { useEffect, useState } from "react";

type AuctionStatus = "setup" | "live" | "paused" | "completed";

interface AuctionStatusGateProps {
  auctionId:    string;
  initialStatus: AuctionStatus;
  onResume?:    () => Promise<void>;
  children:     React.ReactNode;
}

export function AuctionStatusGate({
  auctionId,
  initialStatus,
  onResume,
  children,
}: AuctionStatusGateProps) {
  const [status, setStatus] = useState<AuctionStatus>(initialStatus);

  // Subscribe to auction status changes in real time
  useEffect(() => {
    const { supabase } = require("@/lib/supabase");

    const channel = supabase
      .channel(`auction-status-gate-${auctionId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "auctions",
          filter: `id=eq.${auctionId}`,
        },
        (payload: any) => {
          setStatus(payload.new.status as AuctionStatus);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [auctionId]);

  // Keep in sync if parent re-fetches and passes a new initialStatus
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  return (
    <>
      {children}

      {/* ── PAUSED ── */}
      {status === "paused" && (
        <div
          className="fixed inset-0 z-[350] flex flex-col items-center justify-center gap-6"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 64, color: "#eab308" }}
          >
            pause_circle
          </span>
          <div className="text-center">
            <p
              style={{
                fontFamily:    "'Archivo Narrow', sans-serif",
                fontSize:      32,
                fontWeight:    700,
                color:         "#e8ecf0",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Auction Paused
            </p>
            <p
              style={{
                fontFamily:    "'Geist Mono', monospace",
                fontSize:      11,
                color:         "#5a6a74",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginTop:     8,
              }}
            >
              {onResume ? "Resume to continue bidding" : "Waiting for the auctioneer to resume…"}
            </p>
          </div>

      
        </div>
      )}

      {/* ── COMPLETED ── */}
      {status === "completed" && (
        <div
          className="fixed inset-0 z-[350] flex flex-col items-center justify-center gap-6"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)" }}
        >
          {/* Gold glow */}
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            style={{ zIndex: 0 }}
          >
            <div
              style={{
                width:      600,
                height:     600,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(245,180,0,0.12) 0%, transparent 70%)",
                filter:     "blur(60px)",
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6 text-center">
            {/* Trophy icon */}
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 72, color: "#F5B400", filter: "drop-shadow(0 0 24px rgba(245,180,0,0.5))" }}
            >
              emoji_events
            </span>

            {/* Stamp-style label */}
            <div
              style={{
                border:        "3px solid #C9920A",
                borderRadius:  6,
                padding:       "10px 36px",
                background:    "rgba(197,134,10,0.07)",
                transform:     "rotate(-2deg)",
              }}
            >
              <span
                style={{
                  fontFamily:    "'Archivo Narrow', sans-serif",
                  fontSize:      52,
                  fontWeight:    700,
                  fontStyle:     "italic",
                  color:         "#F5B400",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  textShadow:    "0 0 40px rgba(245,180,0,0.3)",
                }}
              >
                Auction Complete
              </span>
            </div>

            <p
              style={{
                fontFamily:    "'Geist Mono', monospace",
                fontSize:      11,
                color:         "#5a6a74",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginTop:     4,
              }}
            >
              All lots have been called — thanks for participating
            </p>

            {/* Divider */}
            <div
              style={{
                width:      200,
                height:     1,
                background: "linear-gradient(to right, transparent, rgba(245,180,0,0.4), transparent)",
                marginTop:  8,
              }}
            />

            <p
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize:   10,
                color:      "rgba(198,198,205,0.35)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              This window can be closed
            </p>
          </div>
        </div>
      )}
    </>
  );
}