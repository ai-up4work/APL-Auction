// components/Admin/PlayersTab.tsx
"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Player } from "@/types/auction";

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = "Batsman" | "Bowler" | "All-rounder" | "Wicket Keeper";

// ── Props ─────────────────────────────────────────────────────────────────────
interface PlayersTabProps {
  locked: boolean;
  players: Player[];
  onAddPlayer: (data: Omit<Player, "id" | "supabaseId">) => Promise<void>;
  onDeletePlayer: (id: number) => Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  Batsman:         { bg: "rgba(56,132,255,0.12)",  text: "#4d9fff" },
  Bowler:          { bg: "rgba(52,211,153,0.12)",  text: "#34d399" },
  "All-rounder":   { bg: "rgba(168,85,247,0.12)",  text: "#c084fc" },
  "Wicket Keeper": { bg: "rgba(251,191,36,0.12)",  text: "#fbbf24" },
};

const ROLES: Role[] = ["Batsman", "Bowler", "All-rounder", "Wicket Keeper"];
const FILTERS = ["All", ...ROLES] as const;
type Filter = (typeof FILTERS)[number];

const DEFAULT_BASE_PRICE = 500;

const EMPTY_FORM: Omit<Player, "id" | "supabaseId"> = {
  name: "", role: "Batsman", origin: "Local",
  price: DEFAULT_BASE_PRICE, capped: false, img: "", country: "",
};

// ── Lock Banner ───────────────────────────────────────────────────────────────
function LockBanner() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
      style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fbbf24", flexShrink: 0 }}>lock</span>
      <p style={{ fontSize: "12px", color: "#fbbf24", fontFamily: "'Inter', sans-serif" }}>
        Player pool is <strong>locked</strong> while the auction is live. Stop or re-auction to make changes.
      </p>
    </div>
  );
}

// ── Add Player Modal ──────────────────────────────────────────────────────────
function AddPlayerModal({
  onClose, onAdd,
}: {
  onClose: () => void;
  onAdd: (p: Omit<Player, "id" | "supabaseId">) => Promise<void>;
}) {
  const [form, setForm] = useState<Omit<Player, "id" | "supabaseId">>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Player name is required."); return; }
    if (form.price < 1)    { setError("Base price must be at least 1 pt."); return; }
    setSaving(true);
    try {
      await onAdd({ ...form, name: form.name.trim() });
      onClose();
    } catch {
      setError("Failed to add player. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#e0e3e4",
    fontFamily: "'Inter', sans-serif",
  };
  const focusOn  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = "rgba(228,93,53,0.5)"; };
  const focusOff = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9999 }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "#181c1d", border: "1px solid rgba(228,93,53,0.2)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: "22px", fontWeight: 700, color: "#e0e3e4" }}>
              Register Player
            </h3>
            <p style={{ fontSize: "12px", color: "#c6c6cd", marginTop: "2px" }}>Add a player to the pre-auction pool</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FieldLabel>Full Name *</FieldLabel>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Virat Kohli"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <FieldLabel>Base Price (pts) *</FieldLabel>
            <input type="number" min={1} value={form.price} onChange={(e) => set("price", Number(e.target.value))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ ...inputStyle, fontFamily: "'Geist', monospace" }} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <FieldLabel>Country</FieldLabel>
            <input type="text" value={form.country} onChange={(e) => set("country", e.target.value)}
              placeholder="e.g. India"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <select value={form.role} onChange={(e) => set("role", e.target.value as Role)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle }}>
              {ROLES.map((r) => <option key={r} value={r} style={{ background: "#181c1d" }}>{r}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Origin</FieldLabel>
            <select value={form.origin} onChange={(e) => set("origin", e.target.value as Player["origin"])}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle }}>
              {(["Local", "Overseas"] as const).map((o) => <option key={o} value={o} style={{ background: "#181c1d" }}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Capped toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "#e0e3e4" }}>International capped</p>
            <p className="text-[11px]" style={{ color: "#c6c6cd" }}>Has represented their national team</p>
          </div>
          <Toggle checked={form.capped} onChange={(v) => set("capped", v)} />
        </div>

        {/* Photo URL — optional with note */}
        <div>
          <FieldLabel>Photo URL <span style={{ color: "#9a9aa5", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(optional)</span></FieldLabel>
          <input type="text" value={form.img} onChange={(e) => set("img", e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          {!form.img && (
            <p className="mt-1.5 text-[10px] flex items-center gap-1" style={{ color: "#fbbf24" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>warning</span>
              No photo — a placeholder will be shown on the auction board.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#c6c6cd", fontFamily: "'Geist', monospace" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:-translate-y-0.5"
            style={{
              background: saving ? "rgba(228,93,53,0.5)" : "#e45d35",
              color: "#fff", fontFamily: "'Geist', monospace",
              boxShadow: "0 0 18px rgba(228,93,53,0.25)",
              cursor: saving ? "wait" : "pointer",
            }}>
            {saving ? "Registering…" : "Register Player"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Player Card ───────────────────────────────────────────────────────────────
function PlayerCard({
  player, onDelete, locked,
}: {
  player: Player; onDelete: () => void; locked: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const roleStyle = ROLE_COLORS[player.role as Role] ?? { bg: "rgba(255,255,255,0.08)", text: "#c6c6cd" };
  const missingPhoto = !player.img;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative overflow-hidden rounded-xl flex flex-col"
      style={{
        background: "rgba(16,20,21,0.4)",
        backdropFilter: "blur(24px)",
        border: `1px solid ${
          missingPhoto
            ? "rgba(251,191,36,0.25)"          // ← amber border if no photo
            : hovered && !locked
            ? "rgba(228,93,53,0.4)"
            : "rgba(255,255,255,0.08)"
        }`,
        boxShadow: hovered && !locked ? "0 4px 24px rgba(228,93,53,0.1)" : "0 4px 20px rgba(0,0,0,0.3)",
        transform: hovered && !locked ? "translateY(-3px)" : "translateY(0)",
        transition: "all 0.2s ease",
      }}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: hovered && !locked ? "rgba(228,93,53,0.09)" : "rgba(228,93,53,0.04)",
          transform: "translate(40%,-40%)", filter: "blur(32px)",
        }} />

      <div className="relative w-full flex items-end justify-center overflow-hidden"
        style={{ height: "160px", background: "rgba(24,28,29,0.6)" }}>
        {player.img ? (
          <img src={player.img} alt={player.name} className="h-full w-full object-cover" style={{ objectPosition: "center 10%" }} />
        ) : (
          // ── No photo: amber placeholder ──
          <div className="h-full w-full flex flex-col items-center justify-center gap-2"
            style={{ background: "rgba(251,191,36,0.04)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(251,191,36,0.3)" }}>
              person
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ fontFamily: "'Geist', monospace", color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>
              No Photo
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(16,20,21,0.95), transparent)" }} />

        {player.capped && (
          <div className="absolute top-2.5 left-2.5">
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: "rgba(228,93,53,0.18)", color: "#e45d35", border: "1px solid rgba(228,93,53,0.35)", fontFamily: "'Geist', monospace" }}>
              Capped
            </span>
          </div>
        )}

        {hovered && !locked && (
          <div className="absolute top-2.5 right-2.5 flex gap-1.5 z-10">
            <IconButton icon="delete" danger onClick={(e) => { e.stopPropagation(); onDelete(); }} />
          </div>
        )}
        {locked && (
          <div className="absolute top-2.5 right-2.5">
            <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#45464d" }}>lock</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 relative z-10">
        <div>
          <h3 className="text-lg leading-tight tracking-tight"
            style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 700, color: "#e0e3e4" }}>
            {player.name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ fontFamily: "'Geist', monospace", background: roleStyle.bg, color: roleStyle.text }}>
              {player.role}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                fontFamily: "'Geist', monospace",
                background: player.origin === "Overseas" ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.06)",
                color: player.origin === "Overseas" ? "#c084fc" : "#9a9aa5",
              }}>
              {player.origin}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
            Base Price
          </span>
          <span className="text-sm font-black" style={{ fontFamily: "'Geist', monospace", color: "#e45d35" }}>
            {player.price.toLocaleString()} pts
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function PlayersTab({ locked, players, onAddPlayer, onDeletePlayer }: PlayersTabProps) {
  const [filter, setFilter]       = useState<Filter>("All");
  const [showModal, setShowModal] = useState(false);
  const [poolLocked, setPoolLocked] = useState(false);

  const isEditingBlocked = locked || poolLocked;
  const filtered = filter === "All" ? players : players.filter((p) => p.role === filter);

  const roleCounts = ROLES.reduce<Record<Role, number>>((acc, r) => {
    acc[r] = players.filter((p) => p.role === r).length;
    return acc;
  }, {} as Record<Role, number>);

  const totalPoolValue    = players.reduce((sum, p) => sum + p.price, 0);
  const missingPhotoCount = players.filter((p) => !p.img).length;

  const handleDelete = useCallback(async (id: number) => {
    try { await onDeletePlayer(id); } catch { /* handled by context */ }
  }, [onDeletePlayer]);

  const handleAdd = useCallback(async (data: Omit<Player, "id" | "supabaseId">) => {
    await onAddPlayer(data);
  }, [onAddPlayer]);

  return (
    <>
      {showModal && !isEditingBlocked && (
        <AddPlayerModal onClose={() => setShowModal(false)} onAdd={handleAdd} />
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          {locked && <LockBanner />}
          {poolLocked && !locked && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
              style={{ background: "rgba(228,93,53,0.07)", border: "1px solid rgba(228,93,53,0.25)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#e45d35", flexShrink: 0 }}>lock</span>
              <p style={{ fontSize: "12px", color: "#e45d35", fontFamily: "'Inter', sans-serif" }}>
                Pool is <strong>manually locked</strong>.{" "}
                <button className="underline" onClick={() => setPoolLocked(false)}>Unlock</button> to make changes.
              </p>
            </div>
          )}

          {/* ── Missing photos warning — amber, non-blocking ── */}
          {missingPhotoCount > 0 && !locked && (
            <div className="flex items-start gap-3 px-5 py-3 rounded-xl mb-6"
              style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fbbf24", flexShrink: 0, marginTop: "1px" }}>
                image_not_supported
              </span>
              <div>
                <p className="text-sm font-bold mb-0.5" style={{ color: "#fbbf24", fontFamily: "'Inter', sans-serif" }}>
                  {missingPhotoCount} player{missingPhotoCount > 1 ? "s" : ""} without a photo
                </p>
                <p className="text-[11px]" style={{ color: "rgba(251,191,36,0.7)", fontFamily: "'Inter', sans-serif" }}>
                  Photos are optional — players without one will show a placeholder on the auction board. You can still launch.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: "32px", lineHeight: "40px", fontWeight: 700, letterSpacing: "0.01em", color: "#e0e3e4" }}>
                Player Registry{" "}
                <span style={{ color: "rgba(228,93,53,0.55)" }}>({players.length} registered)</span>
              </h2>
              <p className="mt-1.5 max-w-xl" style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", lineHeight: "22px", color: "#c6c6cd" }}>
                Add and manage players before the auction begins. Base price defaults to {DEFAULT_BASE_PRICE} pts.
              </p>
            </div>
            {!isEditingBlocked && (
              <button onClick={() => setShowModal(true)}
                className="px-5 py-2.5 font-bold flex items-center gap-1.5 rounded-xl transition-all hover:-translate-y-0.5 whitespace-nowrap ml-6"
                style={{ background: "#e45d35", color: "#fff", boxShadow: "0 0 20px rgba(228,93,53,0.25)", fontFamily: "'Geist', monospace", fontSize: "12px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>person_add</span>
                Register Player
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap mb-6">
            {FILTERS.map((f) => {
              const isActive = filter === f;
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                  style={{
                    fontFamily: "'Geist', monospace",
                    background: isActive ? "rgba(228,93,53,0.15)" : "rgba(255,255,255,0.04)",
                    border: isActive ? "1px solid rgba(228,93,53,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: isActive ? "#e45d35" : "#9a9aa5",
                  }}>
                  {f}
                  {f !== "All" && (
                    <span className="px-1.5 py-0.5 rounded text-[8px]"
                      style={{ background: isActive ? "rgba(228,93,53,0.2)" : "rgba(255,255,255,0.06)", color: isActive ? "#e45d35" : "#9a9aa5" }}>
                      {roleCounts[f as Role] ?? 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-xl"
              style={{ border: "1px dashed rgba(255,255,255,0.08)", color: "#9a9aa5" }}>
              <span className="material-symbols-outlined text-4xl mb-3" style={{ color: "#45464d" }}>person_search</span>
              <p className="text-sm" style={{ fontFamily: "'Geist', monospace" }}>No players in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((player) => (
                <PlayerCard key={player.id} player={player} locked={isEditingBlocked} onDelete={() => handleDelete(player.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="w-full lg:w-72 flex flex-col gap-5 shrink-0">
          {/* Pool summary */}
          <div className="p-4 rounded-xl"
            style={{ background: "rgba(16,20,21,0.4)", backdropFilter: "blur(24px)", border: "1px solid rgba(228,93,53,0.12)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <h4 className="text-base mb-4" style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 600, color: "#e0e3e4" }}>
              Pool Summary
            </h4>
            <div className="space-y-3">
              {ROLES.map((role) => {
                const count = roleCounts[role] ?? 0;
                const pct = players.length > 0 ? Math.round((count / players.length) * 100) : 0;
                const roleStyle = ROLE_COLORS[role] ?? { text: "#c6c6cd" };
                return (
                  <div key={role}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span style={{ color: "#c6c6cd" }}>{role}</span>
                      <span className="font-bold" style={{ color: roleStyle.text }}>{count} players</span>
                    </div>
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "#313536" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: roleStyle.text }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
                Total Base Value
              </span>
              <span className="text-sm font-black" style={{ fontFamily: "'Geist', monospace", color: "#e45d35" }}>
                {totalPoolValue.toLocaleString()} pts
              </span>
            </div>

            {/* Photo coverage stat */}
            {players.length > 0 && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
                  Photo Coverage
                </span>
                <span className="text-sm font-black" style={{
                  fontFamily: "'Geist', monospace",
                  color: missingPhotoCount === 0 ? "#34d399" : "#fbbf24",
                }}>
                  {players.length - missingPhotoCount}/{players.length}
                </span>
              </div>
            )}
          </div>

          {/* Bulk actions */}
          <div className="p-4 rounded-xl"
            style={{
              background: "rgba(16,20,21,0.4)", backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              opacity: isEditingBlocked ? 0.5 : 1,
              pointerEvents: isEditingBlocked ? "none" : "auto",
            }}>
            <h4 className="text-base mb-4" style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 600, color: "#e0e3e4" }}>
              Bulk Actions
            </h4>
            <div className="flex flex-col gap-2">
              {[
                { icon: "upload_file", label: "Import via CSV",  onClick: () => alert("CSV import — wire up your handler") },
                { icon: "download",    label: "Export Registry", onClick: () => alert("Export — wire up your handler") },
              ].map((action) => (
                <SidebarActionButton key={action.label} icon={action.icon} label={action.label} onClick={action.onClick} />
              ))}
            </div>
            <button onClick={() => setPoolLocked(true)}
              className="w-full mt-4 py-3 font-black text-[10px] uppercase rounded-xl transition-all hover:opacity-90 hover:-translate-y-0.5"
              style={{ background: "#e45d35", color: "#fff", letterSpacing: "0.18em", fontFamily: "'Geist', monospace", boxShadow: "0 0 18px rgba(228,93,53,0.25)" }}>
              Lock Player Pool
            </button>
          </div>

          {/* Overseas quota */}
          <div className="p-3 rounded-lg border" style={{ background: "rgba(24,28,29,0.3)", borderColor: "rgba(69,70,77,0.3)" }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
              Overseas Quota
            </p>
            <div className="space-y-3">
              {([
                { label: "Overseas Players", count: players.filter((p) => p.origin === "Overseas").length, color: "#e45d35" },
                { label: "Local Players",    count: players.filter((p) => p.origin === "Local").length,    color: "#c6c6cd" },
              ] as const).map((item) => {
                const pct = players.length ? Math.round((item.count / players.length) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span style={{ color: "#c6c6cd" }}>{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>{item.count} / {players.length}</span>
                    </div>
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "#313536" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-colors"
      style={{ background: checked ? "#e45d35" : "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: checked ? "calc(100% - 18px)" : "2px" }} />
    </button>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
      style={{ background: "rgba(255,255,255,0.06)", color: hovered ? "#e45d35" : "#c6c6cd" }}>
      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
    </button>
  );
}

function IconButton({ icon, danger = false, onClick }: { icon: string; danger?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
      style={{
        background: "rgba(16,20,21,0.8)", border: "1px solid rgba(255,255,255,0.1)",
        color: hovered ? (danger ? "#f87171" : "#e45d35") : "#c6c6cd",
      }}>
      <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>{icon}</span>
    </button>
  );
}

function SidebarActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left"
      style={{
        background: hovered ? "rgba(228,93,53,0.08)" : "rgba(39,43,44,0.4)",
        borderColor: hovered ? "rgba(228,93,53,0.5)" : "rgba(69,70,77,0.3)",
        color: hovered ? "#e45d35" : "#c6c6cd",
        fontFamily: "'Geist', monospace", fontSize: "11px",
      }}>
      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#e45d35" }}>{icon}</span>
      {label}
    </button>
  );
}