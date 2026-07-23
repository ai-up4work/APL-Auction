"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuction } from "@/context/AuctionContext";
import type { AuctionSummary } from "@/lib/auctionDb";

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
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{
          border: `1px solid ${color}33`,
          color,
          background: `${color}18`,
          fontFamily: "var(--font-label-mono)",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
    );
  }

  const drawerContent = mounted ? createPortal(
    <>
      {/* Backdrop — same treatment as the app's other modal overlays
          (FranchiseModal / DeleteConfirm): rgba(0,0,0,0.7) + blur(6px). */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[9998]"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
        />
      )}

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[9999] flex flex-col overflow-x-hidden"
        style={{
          width: "min(420px, 100vw)",
          background: "var(--color-surface-container-low)",
          borderLeft: "1px solid var(--color-border-overlay)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-24px 0 64px rgba(0,0,0,0.6)",
        }}
      >

        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
          style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
        >
          <div>
            <p style={{ fontFamily: "var(--font-headline-md)", fontSize: "18px", fontWeight: 700, color: "var(--color-on-surface)" }}>
              Auctions
            </p>
            <p className="mt-0.5" style={{ fontFamily: "var(--font-body-md)", fontSize: "12px", color: "var(--color-outline)" }}>
              Switch, create, or clone auctions
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg flex items-center"
            style={{ background: "none", border: "none", color: "var(--color-outline)", cursor: "pointer" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 px-6 pt-3 shrink-0"
          style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
        >
          {(["auctions", "links"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-t-md text-[13px] font-semibold transition-all"
              style={{
                border: "none",
                cursor: "pointer",
                background: tab === t ? "var(--color-surface-container-low)" : "transparent",
                color: tab === t ? "var(--color-theme-orange)" : "var(--color-outline)",
                borderBottom: tab === t ? "2px solid var(--color-theme-orange)" : "2px solid transparent",
                fontFamily: "var(--font-body-md)",
              }}
            >
              {t === "auctions" ? "All Auctions" : "Links & Access"}
            </button>
          ))}
        </div>

        {/* Scrollable content — reuses the app's existing log-scroll
            scrollbar utility instead of a bespoke duplicate. */}
        <div className="log-scroll flex-1 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-8">

          {/* ── ALL AUCTIONS TAB ── */}
          {tab === "auctions" && (
            <div className="flex flex-col gap-3">

              {/* New auction form */}
              <div
                className="p-4 rounded-xl"
                style={{ border: "1px dashed rgba(201,151,31,0.35)", background: "rgba(201,151,31,0.04)" }}
              >
                <p
                  className="mb-2.5 text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--color-theme-orange)", fontFamily: "var(--font-label-mono)" }}
                >
                  + New Auction
                </p>
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        createNew(newName.trim() || "");
                        setNewName(""); setOpen(false);
                      }
                    }}
                    placeholder="e.g. APL Season 2"
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={{
                      background: "var(--color-surface-container)",
                      border: "1px solid var(--color-border-overlay)",
                      color: "var(--color-on-surface)",
                      fontFamily: "var(--font-body-md)",
                    }}
                  />
                  <button
                    onClick={() => { createNew(newName.trim() || ""); setNewName(""); setOpen(false); }}
                    className="shrink-0 px-4.5 py-2 rounded-lg text-[13px] font-bold"
                    style={{
                      border: "none",
                      background: "var(--color-theme-orange)",
                      color: "var(--color-on-primary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-label-mono)",
                    }}
                  >
                    Create
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2.5 my-1">
                <div className="flex-1 h-px" style={{ background: "var(--color-outline-variant)" }} />
                <span
                  className="text-[10px] tracking-wide"
                  style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-label-mono)" }}
                >
                  PREVIOUS
                </span>
                <div className="flex-1 h-px" style={{ background: "var(--color-outline-variant)" }} />
              </div>

              {/* Auction list */}
              {isLoadingList ? (
                <div className="text-center py-8">
                  <span
                    className="material-symbols-outlined animate-spin block mb-2"
                    style={{ fontSize: "28px", color: "var(--color-surface-variant)" }}
                  >
                    progress_activity
                  </span>
                  <p className="text-xs" style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-body-md)" }}>
                    Loading auctions…
                  </p>
                </div>
              ) : auctionList.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: "var(--color-surface-variant)" }}>
                    inbox
                  </span>
                  <p className="text-[13px]" style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-body-md)" }}>
                    No saved auctions yet.
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-body-md)" }}>
                    Create one above to get started.
                  </p>
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
            <div className="flex flex-col gap-4">
              {!auction.auctionId ? (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-4xl block mb-2.5" style={{ color: "var(--color-surface-variant)" }}>
                    link_off
                  </span>
                  <p className="text-[13px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
                    Launch an auction first to generate links.
                  </p>
                </div>
              ) : !links ? (
                <p className="text-[13px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
                  Generating links…
                </p>
              ) : (
                <>
                  <div>
                    <p
                      className="mb-2.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}
                    >
                      Global Links
                    </p>
                    <div className="flex flex-col gap-2">
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

                  <div className="h-px" style={{ background: "var(--color-outline-variant)" }} />

                  <div>
                    <p
                      className="mb-2.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}
                    >
                      Team Owner Links
                    </p>
                    <div className="flex flex-col gap-2">
                      {links.ownerLinks.map(({ teamCode, teamName, url, pin }) => (
                        <div
                          key={teamCode}
                          className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg"
                          style={{ border: "1px solid var(--color-outline-variant)", background: "var(--color-surface-container)" }}
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold" style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-body-md)" }}>
                              {teamCode}{" "}
                              <span className="font-normal" style={{ color: "var(--color-outline)" }}>{teamName}</span>
                            </p>
                            <p
                              className="mt-0.5 text-[10px] overflow-hidden text-ellipsis whitespace-nowrap"
                              style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-label-mono)" }}
                            >
                              {url}
                            </p>
                            <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
                              PIN: <span style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}>{pin}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => copy(`${url}\nPIN: ${pin}`, `owner-${teamCode}`)}
                            className="shrink-0 px-2.5 py-1 rounded text-[11px] font-semibold"
                            style={{
                              border: "1px solid var(--color-border-overlay)",
                              background: "transparent",
                              color: copied === `owner-${teamCode}` ? "var(--color-success)" : "var(--color-on-surface-variant)",
                              cursor: "pointer",
                              fontFamily: "var(--font-label-mono)",
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
    </>,
    document.body
  ) : null;

  return (
    <>
      {/* Trigger button — surface-container-high + on-surface text gives
          enough contrast against the header background; the previous
          surface-container + secondary combo was nearly invisible. */}
      <button
        onClick={() => { setOpen(true); refreshAuctionList(); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold max-w-[200px] overflow-hidden transition-colors"
        style={{
          background: "var(--color-surface-container-high)",
          border: "1px solid rgba(201,151,31,0.25)",
          color: "var(--color-on-surface)",
          cursor: "pointer",
          fontFamily: "var(--font-body-md)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(201,151,31,0.5)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(201,151,31,0.25)"; }}
      >
        <span className="material-symbols-outlined shrink-0" style={{ fontSize: "15px", color: "var(--color-theme-orange)" }}>swap_horiz</span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
          {auction.session.auctionName || "Auction"}
        </span>
        <span className="material-symbols-outlined shrink-0" style={{ fontSize: "13px", color: "var(--color-outline)" }}>expand_more</span>
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
    <div
      className="p-3.5 rounded-xl"
      style={{
        border: `1px solid ${isActive ? "rgba(201,151,31,0.35)" : "var(--color-outline-variant)"}`,
        background: isActive ? "rgba(201,151,31,0.05)" : "var(--color-surface-container)",
      }}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-sm font-bold" style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-body-md)" }}>
              {auction.name}
            </span>
            {pill(STATUS_LABEL[auction.status] ?? auction.status, STATUS_COLOR[auction.status] ?? "var(--color-outline)")}
            {isActive && pill("Active", "var(--color-success)")}
          </div>
          <p className="text-[11px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}>
            {auction.teamCount} teams · {auction.playerCount} players · {new Date(auction.createdAt).toLocaleDateString()}
          </p>
          <p
            className="mt-0.5 text-[10px] overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-label-mono)" }}
          >
            {auction.id}
          </p>
        </div>
      </div>
      <div className="flex gap-1.5 mt-2.5 flex-wrap">
        {!isActive && <ActionBtn onClick={onSwitch} label="Load" />}
        <ActionBtn onClick={onCopyId} label={copied === `id-${auction.id}` ? "✓ Copied" : "Copy ID"} active={copied === `id-${auction.id}`} />
        <ActionBtn onClick={onStartClone} label="Re-conduct" accent />
      </div>
      {cloning === auction.id && (
        <div className="mt-2.5 flex gap-1.5 flex-wrap">
          <input
            autoFocus value={cloneName}
            onChange={(e) => onCloneNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onConfirmClone(); if (e.key === "Escape") onCancelClone(); }}
            placeholder="New auction name"
            className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-md text-xs outline-none"
            style={{
              background: "var(--color-surface-container)",
              border: "1px solid var(--color-border-overlay)",
              color: "var(--color-on-surface)",
              fontFamily: "var(--font-body-md)",
            }}
          />
          <button
            onClick={onConfirmClone}
            className="shrink-0 px-3.5 py-1.5 rounded-md text-xs font-bold"
            style={{ border: "none", background: "var(--color-theme-orange)", color: "var(--color-on-primary)", cursor: "pointer", fontFamily: "var(--font-label-mono)" }}
          >
            Clone
          </button>
          <button
            onClick={onCancelClone}
            className="shrink-0 px-2.5 py-1.5 rounded-md text-xs"
            style={{ border: "1px solid var(--color-border-overlay)", background: "transparent", color: "var(--color-outline)", cursor: "pointer", fontFamily: "var(--font-label-mono)" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, onClick, active = false, accent = false }: { label: string; onClick: () => void; active?: boolean; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-xs font-semibold"
      style={{
        cursor: "pointer",
        fontFamily: "var(--font-label-mono)",
        border: accent ? "1px solid rgba(201,151,31,0.25)" : "1px solid var(--color-border-overlay)",
        background: "transparent",
        color: active ? "var(--color-success)" : accent ? "var(--color-theme-orange)" : "var(--color-on-surface-variant)",
      }}
    >
      {label}
    </button>
  );
}

function LinkRow({ label, url, icon, note, copied, onCopy }: { label: string; url: string; icon: string; note: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="p-3 rounded-lg" style={{ border: "1px solid var(--color-outline-variant)", background: "var(--color-surface-container)" }}>
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "var(--color-theme-orange)" }}>{icon}</span>
          <span className="text-[13px] font-bold" style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-body-md)" }}>{label}</span>
        </div>
        <button
          onClick={onCopy}
          className="px-2.5 py-0.5 rounded text-[11px] font-semibold"
          style={{
            border: "1px solid var(--color-border-overlay)",
            background: "transparent",
            color: copied ? "var(--color-success)" : "var(--color-on-surface-variant)",
            cursor: "pointer",
            fontFamily: "var(--font-label-mono)",
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <p
        className="mb-0.5 text-[10px] overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-label-mono)" }}
      >
        {url}
      </p>
      <p className="text-[11px]" style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-body-md)" }}>{note}</p>
    </div>
  );
}