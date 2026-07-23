"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Tournament } from "@/types/auction";

interface Props {
  teamCount:            number;
  tournaments:          Tournament[];
  isLoadingTournaments: boolean;
  onLoadTournaments:    () => void;
  onLink:               (tournamentId: string) => Promise<void>;
  onCreateAndLink:      (name: string, format: "single_elimination" | "double_elimination") => Promise<void>;
  onSkip:               () => Promise<void>;
}

export default function TournamentPromptModal({
  teamCount, tournaments, isLoadingTournaments, onLoadTournaments,
  onLink, onCreateAndLink, onSkip,
}: Props) {
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"single_elimination" | "double_elimination">("single_elimination");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { onLoadTournaments(); }, [onLoadTournaments]);

  async function handleLink() {
    if (!selectedId) { setError("Choose a tournament first."); return; }
    setBusy(true); setError("");
    try { await onLink(selectedId); }
    catch { setError("Failed to link tournament."); }
    finally { setBusy(false); }
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Tournament name is required."); return; }
    setBusy(true); setError("");
    try { await onCreateAndLink(name.trim(), format); }
    catch { setError("Failed to create tournament."); }
    finally { setBusy(false); }
  }

  async function handleSkip() {
    setBusy(true); setError("");
    try { await onSkip(); }
    catch { setError("Failed to save."); }
    finally { setBusy(false); }
  }

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9999 }}>
      <div className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "var(--color-surface-container)", border: "1px solid var(--color-border-overlay)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        <div>
          <h3 style={{ fontFamily: "var(--font-headline-md)", fontSize: "20px", fontWeight: 700, color: "var(--color-on-surface)" }}>
            Link this auction to a tournament?
          </h3>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-on-surface-variant)" }}>
            You now have {teamCount} franchises. Linking to a tournament keeps standings and points tables in sync — but it's optional.
          </p>
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "var(--color-error-container)", color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 text-xs font-bold">
          <button onClick={() => setMode("pick")}
            className="px-3 py-1.5 rounded-lg"
            style={{ background: mode === "pick" ? "var(--color-theme-orange)" : "var(--color-surface-container-low)", color: mode === "pick" ? "var(--color-on-primary)" : "var(--color-on-surface-variant)" }}>
            Choose Existing
          </button>
          <button onClick={() => setMode("create")}
            className="px-3 py-1.5 rounded-lg"
            style={{ background: mode === "create" ? "var(--color-theme-orange)" : "var(--color-surface-container-low)", color: mode === "create" ? "var(--color-on-primary)" : "var(--color-on-surface-variant)" }}>
            Create New
          </button>
        </div>

        {mode === "pick" ? (
          <div className="flex flex-col gap-2">
            {isLoadingTournaments ? (
              <p className="text-xs" style={{ color: "var(--color-outline)" }}>Loading tournaments…</p>
            ) : tournaments.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-outline)" }}>No existing tournaments — create one instead.</p>
            ) : (
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)" }}>
                <option value="">Select a tournament…</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.format.replace("_", " ")})</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Tournament name"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)" }} />
            <select value={format} onChange={(e) => setFormat(e.target.value as any)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)" }}>
              <option value="single_elimination">Single Elimination</option>
              <option value="double_elimination">Double Elimination</option>
            </select>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={handleSkip} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface-variant)" }}>
            Keep Standalone
          </button>
          <button onClick={mode === "pick" ? handleLink : handleCreate} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-black"
            style={{ background: "var(--color-theme-orange)", color: "var(--color-on-primary)" }}>
            {mode === "pick" ? "Link Tournament" : "Create & Link"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}