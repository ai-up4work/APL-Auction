"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuction } from "@/context/AuctionContext";
import type { AuctionSummary } from "@/lib/auctionDb";

const STATUS_COLOR: Record<string, string> = {
  setup:     "#8a9ba8",
  live:      "#4ade80",
  paused:    "#facc15",
  completed: "#e45d35",
};

const STATUS_LABEL: Record<string, string> = {
  setup:     "Setup",
  live:      "Live",
  paused:    "Paused",
  completed: "Completed",
};

export default function AuctionSwitcher() {
  const {
    auction, auctionList, isLoadingList, links,
    createNew, switchAuction, cloneFromPrevious, refreshAuctionList,
  } = useAuction();

  const [open, setOpen]           = useState(false);
  const [tab, setTab]             = useState<"auctions" | "links">("auctions");
  const [newName, setNewName]     = useState("");
  const [cloning, setCloning]     = useState<string | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [copied, setCopied]       = useState<string | null>(null);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function onClone(sourceId: string) {
    if (!cloneName.trim()) return;
    await cloneFromPrevious(sourceId, cloneName.trim());
    setCloning(null);
    setCloneName("");
    setOpen(false);
  }

  function pill(label: string, color: string) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 8px",
        borderRadius: 99, border: `1px solid ${color}33`,
        color, background: `${color}18`,
        fontFamily: "'Geist', monospace", letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    );
  }

  const drawerContent = mounted ? createPortal(
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9998,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(420px, 100vw)",
        zIndex: 9999,
        background: "#141a1c",
        borderLeft: "1px solid rgba(190,198,224,0.1)",
        display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
        overflowX: "hidden",
      }}>

        {/* Drawer header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid rgba(190,198,224,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e0e3e4" }}>
              Auctions
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5a6a74" }}>
              Switch, create, or clone auctions
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "none", border: "none", color: "#5a6a74",
              cursor: "pointer", padding: 6, borderRadius: 6,
              display: "flex", alignItems: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", padding: "12px 24px 0", gap: 4, flexShrink: 0,
          borderBottom: "1px solid rgba(190,198,224,0.06)",
        }}>
          {(["auctions", "links"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "7px 16px", borderRadius: "6px 6px 0 0",
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: tab === t ? "#141a1c" : "transparent",
                color: tab === t ? "#e45d35" : "#5a6a74",
                borderBottom: tab === t ? "2px solid #e45d35" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {t === "auctions" ? "All Auctions" : "Links & Access"}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div
          className="auction-drawer-scroll"
          style={{
            flex: 1, overflowY: "auto", overflowX: "hidden",
            padding: "16px 24px 32px",
          }}
        >

          {/* ── ALL AUCTIONS TAB ── */}
          {tab === "auctions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* New auction form */}
              <div style={{
                padding: 16, borderRadius: 10,
                border: "1px dashed rgba(228,93,53,0.35)",
                background: "rgba(228,93,53,0.04)",
              }}>
                <p style={{
                  margin: "0 0 10px", fontSize: 12, fontWeight: 700,
                  color: "#e45d35", textTransform: "uppercase",
                  letterSpacing: "0.08em", fontFamily: "'Geist', monospace",
                }}>
                  + New Auction
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        createNew(newName.trim() || undefined);
                        setNewName(""); setOpen(false);
                      }
                    }}
                    placeholder="e.g. APL Season 2"
                    style={{
                      flex: "1 1 140px", minWidth: 0,
                      padding: "8px 12px", borderRadius: 7,
                      background: "rgba(190,198,224,0.06)",
                      border: "1px solid rgba(190,198,224,0.15)",
                      color: "#e0e3e4", fontSize: 13, outline: "none",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  />
                  <button
                    onClick={() => { createNew(newName.trim() || undefined); setNewName(""); setOpen(false); }}
                    style={{
                      flexShrink: 0, padding: "8px 18px", borderRadius: 7, border: "none",
                      background: "#e45d35", color: "#fff",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                      fontFamily: "'Geist', monospace",
                    }}
                  >
                    Create
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(190,198,224,0.07)" }} />
                <span style={{ fontSize: 10, color: "#3a4a54", fontFamily: "'Geist', monospace", letterSpacing: "0.08em" }}>
                  PREVIOUS
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(190,198,224,0.07)" }} />
              </div>

              {/* Auction list */}
              {isLoadingList ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: 28, color: "#3a4a54", display: "block", marginBottom: 8,
                    animation: "spin 1s linear infinite",
                  }}>progress_activity</span>
                  <p style={{ margin: 0, color: "#3a4a54", fontSize: 12 }}>Loading auctions…</p>
                </div>
              ) : auctionList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#2a3a44", display: "block", marginBottom: 8 }}>inbox</span>
                  <p style={{ margin: 0, color: "#3a4a54", fontSize: 13 }}>No saved auctions yet.</p>
                  <p style={{ margin: "4px 0 0", color: "#2a3a44", fontSize: 12 }}>Create one above to get started.</p>
                </div>
              ) : (
                auctionList.map((a) => (
                  <AuctionCard
                    key={a.id}
                    auction={a}
                    isActive={a.id === auction.auctionId}
                    cloning={cloning}
                    cloneName={cloneName}
                    copied={copied}
                    onSwitch={() => { switchAuction(a.id); setOpen(false); }}
                    onCopyId={() => copy(a.id, `id-${a.id}`)}
                    onStartClone={() => { setCloning(a.id); setCloneName(`${a.name} (Clone)`); }}
                    onCancelClone={() => setCloning(null)}
                    onCloneNameChange={setCloneName}
                    onConfirmClone={() => onClone(a.id)}
                    pill={pill}
                  />
                ))
              )}
            </div>
          )}

          {/* ── LINKS & ACCESS TAB ── */}
          {tab === "links" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {!auction.auctionId ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: "#2a3a44", display: "block", marginBottom: 10 }}>link_off</span>
                  <p style={{ margin: 0, color: "#5a6a74", fontSize: 13 }}>Launch an auction first to generate links.</p>
                </div>
              ) : !links ? (
                <p style={{ color: "#5a6a74", fontSize: 13 }}>Generating links…</p>
              ) : (
                <>
                  <div>
                    <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: "#5a6a74", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Geist', monospace" }}>
                      Global Links
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { label: "Admin",     key: "admin",     url: links.admin,     icon: "admin_panel_settings", note: "Share only with admins" },
                        { label: "Spectator", key: "spectator", url: links.spectator, icon: "visibility",           note: "Public read-only view"  },
                        { label: "Live Bid",  key: "live",      url: links.live,      icon: "gavel",                note: "Real-time bid screen"   },
                      ].map(({ label, key, url, icon, note }) => (
                        <LinkRow key={key} label={label} url={url} icon={icon} note={note}
                          copied={copied === key} onCopy={() => copy(url, key)} />
                      ))}
                    </div>
                  </div>

                  <div style={{ height: 1, background: "rgba(190,198,224,0.07)" }} />

                  <div>
                    <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: "#5a6a74", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Geist', monospace" }}>
                      Team Owner Links
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {links.ownerLinks.map(({ teamCode, teamName, url, pin }) => (
                        <div key={teamCode} style={{
                          padding: "10px 12px", borderRadius: 8,
                          border: "1px solid rgba(190,198,224,0.08)",
                          background: "rgba(190,198,224,0.02)",
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e0e3e4" }}>
                              {teamCode}{" "}<span style={{ color: "#5a6a74", fontWeight: 400 }}>{teamName}</span>
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#4a5a64", fontFamily: "'Geist', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {url}
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#5a6a74" }}>
                              PIN: <span style={{ fontFamily: "'Geist', monospace", color: "#e45d35" }}>{pin}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => copy(`${url}\nPIN: ${pin}`, `owner-${teamCode}`)}
                            style={{
                              flexShrink: 0, padding: "5px 10px", borderRadius: 5,
                              border: "1px solid rgba(190,198,224,0.15)", background: "transparent",
                              color: copied === `owner-${teamCode}` ? "#4ade80" : "#8a9ba8",
                              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Geist', monospace",
                            }}
                          >
                            {copied === `owner-${teamCode}` ? "✓ Copied" : "Copy"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* Styled scrollbar — Webkit (Chrome, Edge, Safari) */
        .auction-drawer-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .auction-drawer-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .auction-drawer-scroll::-webkit-scrollbar-thumb {
          background: rgba(190, 198, 224, 0.12);
          border-radius: 999px;
        }
        .auction-drawer-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(228, 93, 53, 0.35);
        }

        /* Firefox */
        .auction-drawer-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(190, 198, 224, 0.12) transparent;
        }
      `}</style>
    </>,
    document.body
  ) : null;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(true); refreshAuctionList(); }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 8,
          background: "rgba(190,198,224,0.06)",
          border: "1px solid rgba(190,198,224,0.12)",
          color: "#bec6e0", fontSize: 12, fontWeight: 600,
          cursor: "pointer", fontFamily: "'Inter', sans-serif",
          maxWidth: 200, overflow: "hidden",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 15, flexShrink: 0 }}>swap_horiz</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {auction.session.auctionName || "Auction"}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 13, opacity: 0.5, flexShrink: 0 }}>expand_more</span>
      </button>

      {drawerContent}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AuctionCard({
  auction, isActive, cloning, cloneName, copied,
  onSwitch, onCopyId, onStartClone, onCancelClone, onCloneNameChange, onConfirmClone, pill,
}: {
  auction: AuctionSummary; isActive: boolean; cloning: string | null;
  cloneName: string; copied: string | null;
  onSwitch: () => void; onCopyId: () => void; onStartClone: () => void;
  onCancelClone: () => void; onCloneNameChange: (v: string) => void;
  onConfirmClone: () => void; pill: (label: string, color: string) => React.ReactNode;
}) {
  return (
    <div style={{
      padding: 14, borderRadius: 10,
      border: `1px solid ${isActive ? "rgba(228,93,53,0.35)" : "rgba(190,198,224,0.08)"}`,
      background: isActive ? "rgba(228,93,53,0.05)" : "rgba(190,198,224,0.02)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e0e3e4" }}>{auction.name}</span>
            {pill(STATUS_LABEL[auction.status] ?? auction.status, STATUS_COLOR[auction.status] ?? "#8a9ba8")}
            {isActive && pill("Active", "#4ade80")}
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#5a6a74", fontFamily: "'Geist', monospace" }}>
            {auction.teamCount} teams · {auction.playerCount} players · {new Date(auction.createdAt).toLocaleDateString()}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 10, color: "#2a3a44", fontFamily: "'Geist', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {auction.id}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {!isActive && <ActionBtn onClick={onSwitch} label="Load" />}
        <ActionBtn onClick={onCopyId} label={copied === `id-${auction.id}` ? "✓ Copied" : "Copy ID"} active={copied === `id-${auction.id}`} />
        <ActionBtn onClick={onStartClone} label="Re-conduct" accent />
      </div>
      {cloning === auction.id && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input
            autoFocus value={cloneName}
            onChange={(e) => onCloneNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onConfirmClone(); if (e.key === "Escape") onCancelClone(); }}
            placeholder="New auction name"
            style={{
              flex: "1 1 140px", minWidth: 0, padding: "7px 10px", borderRadius: 6,
              background: "rgba(190,198,224,0.06)", border: "1px solid rgba(190,198,224,0.15)",
              color: "#e0e3e4", fontSize: 12, outline: "none", fontFamily: "'Inter', sans-serif",
            }}
          />
          <button onClick={onConfirmClone} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 6, border: "none", background: "#e45d35", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Clone</button>
          <button onClick={onCancelClone} style={{ flexShrink: 0, padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(190,198,224,0.1)", background: "transparent", color: "#5a6a74", fontSize: 12, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, onClick, active = false, accent = false }: { label: string; onClick: () => void; active?: boolean; accent?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
      cursor: "pointer", fontFamily: "'Geist', monospace",
      border: accent ? "1px solid rgba(228,93,53,0.25)" : "1px solid rgba(190,198,224,0.12)",
      background: "transparent",
      color: active ? "#4ade80" : accent ? "#e45d35" : "#8a9ba8",
    }}>
      {label}
    </button>
  );
}

function LinkRow({ label, url, icon, note, copied, onCopy }: { label: string; url: string; icon: string; note: string; copied: boolean; onCopy: () => void }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(190,198,224,0.08)", background: "rgba(190,198,224,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#e45d35" }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e0e3e4" }}>{label}</span>
        </div>
        <button onClick={onCopy} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid rgba(190,198,224,0.12)", background: "transparent", color: copied ? "#4ade80" : "#8a9ba8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Geist', monospace" }}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <p style={{ margin: "0 0 2px", fontSize: 10, color: "#4a5a64", fontFamily: "'Geist', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</p>
      <p style={{ margin: 0, fontSize: 11, color: "#3a4a54" }}>{note}</p>
    </div>
  );
}