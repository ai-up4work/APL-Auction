"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Player, Team } from "@/types/auction";
import ImageUploadField from "@/components/Admin/ImageUploadField";

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = "Batsman" | "Bowler" | "All-rounder" | "Wicket Keeper";

// ── Props ─────────────────────────────────────────────────────────────────────
interface PlayersTabProps {
  locked: boolean;
  players: Player[];
  teams: Team[];
  auctionId: string; // needed so uploaded photos land in {auctionId}/Auction-Images/player-images/
  onAddPlayer: (data: Omit<Player, "id" | "supabaseId">) => Promise<void>;
  onEditPlayer: (id: number, data: Omit<Player, "id" | "supabaseId">) => Promise<void>;
  onDeletePlayer: (id: number) => Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  Batsman:         { bg: "rgba(173,198,255,0.12)", text: "var(--color-tertiary)"   },
  Bowler:          { bg: "var(--color-success-container)", text: "var(--color-success)" },
  "All-rounder":   { bg: "rgba(200,205,216,0.12)", text: "var(--color-secondary)"  },
  "Wicket Keeper": { bg: "var(--color-warning-container)", text: "var(--color-warning)" },
};

const ROLES: Role[] = ["Batsman", "Bowler", "All-rounder", "Wicket Keeper"];
const FILTERS = ["All", ...ROLES] as const;
type Filter = (typeof FILTERS)[number];

const DEFAULT_BASE_PRICE = 500;

const EMPTY_FORM: Omit<Player, "id" | "supabaseId"> = {
  name: "", role: "Batsman", origin: "Local",
  price: DEFAULT_BASE_PRICE, capped: false, img: "", country: "",
  ownerTeamCode: undefined,
};

// ── Lock Banner ───────────────────────────────────────────────────────────────
function LockBanner() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
      style={{ background: "var(--color-warning-container)", border: "1px solid var(--color-warning-outline)" }}>
      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-warning)", flexShrink: 0 }}>lock</span>
      <p style={{ fontSize: "12px", color: "var(--color-warning)", fontFamily: "var(--font-body-md)" }}>
        Player pool is <strong>locked</strong> while the auction is live. Stop or re-auction to make changes.
      </p>
    </div>
  );
}

// ── Add / Edit Player Modal ───────────────────────────────────────────────────
function PlayerModal({
  teams, initial, auctionId, onClose, onSave,
}: {
  teams: Team[];
  initial?: Player;
  auctionId: string;
  onClose: () => void;
  onSave: (p: Omit<Player, "id" | "supabaseId">) => Promise<void>;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<Omit<Player, "id" | "supabaseId">>(
    initial
      ? {
          name: initial.name, role: initial.role, origin: initial.origin,
          price: initial.price, capped: initial.capped, img: initial.img,
          country: initial.country, ownerTeamCode: initial.ownerTeamCode,
        }
      : { ...EMPTY_FORM }
  );
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
      await onSave({ ...form, name: form.name.trim() });
      onClose();
    } catch {
      setError(isEdit ? "Failed to update player. Please try again." : "Failed to add player. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--color-surface-container-low)",
    border: "1px solid var(--color-border-overlay)",
    color: "var(--color-on-surface)",
    fontFamily: "var(--font-body-md)",
  };
  const focusOn  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = "var(--color-theme-orange)"; };
  const focusOff = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = "var(--color-border-overlay)"; };

  const selectedTeam = teams.find((t) => t.code === form.ownerTeamCode);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9999 }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "var(--color-surface-container)", border: "1px solid var(--color-border-overlay)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 style={{ fontFamily: "var(--font-headline-md)", fontSize: "22px", fontWeight: 700, color: "var(--color-on-surface)" }}>
              {isEdit ? "Edit Player" : "Register Player"}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
              {isEdit ? "Update this player's details" : "Add a player to the pre-auction pool"}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "var(--color-error-container)", color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
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
              style={{ ...inputStyle, fontFamily: "var(--font-label-mono)" }} onFocus={focusOn} onBlur={focusOff} />
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
              {ROLES.map((r) => <option key={r} value={r} style={{ background: "var(--color-surface-container)" }}>{r}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Origin</FieldLabel>
            <select value={form.origin} onChange={(e) => set("origin", e.target.value as Player["origin"])}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle }}>
              {(["Local", "Overseas"] as const).map((o) => <option key={o} value={o} style={{ background: "var(--color-surface-container)" }}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* ── CAPTAIN / OWNER ASSIGNMENT ── */}
        <div>
          <FieldLabel>
            Assign as Team Captain{" "}
            <span style={{ color: "var(--color-outline)", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(optional)</span>
          </FieldLabel>
          <select
            value={form.ownerTeamCode ?? ""}
            onChange={(e) => set("ownerTeamCode", (e.target.value || undefined) as Player["ownerTeamCode"])}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle}
            onFocus={focusOn} onBlur={focusOff}
          >
            <option value="" style={{ background: "var(--color-surface-container)" }}>— Not a captain —</option>
            {teams.map((t) => (
              <option key={t.code} value={t.code} style={{ background: "var(--color-surface-container)" }}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[10px]" style={{ color: "var(--color-outline)" }}>
            Captains are auto-purchased by their team at launch (deducted from purse) and skip the live bidding pool entirely.
          </p>
          {selectedTeam && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "rgba(201,151,31,0.06)", border: "1px solid rgba(201,151,31,0.2)" }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: selectedTeam.color }} />
              <span className="text-[11px]" style={{ color: "var(--color-theme-orange)", fontFamily: "var(--font-label-mono)" }}>
                Will be auto-assigned as {selectedTeam.name}'s captain at launch.
              </span>
            </div>
          )}
          {teams.length === 0 && (
            <p className="mt-1.5 text-[10px] flex items-center gap-1" style={{ color: "var(--color-warning)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>warning</span>
              No franchises created yet — add teams first to assign captains.
            </p>
          )}
        </div>

        {/* Capped toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg"
          style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-on-surface)" }}>International capped</p>
            <p className="text-[11px]" style={{ color: "var(--color-on-surface-variant)" }}>Has represented their national team</p>
          </div>
          <Toggle checked={form.capped} onChange={(v) => set("capped", v)} />
        </div>

        {/* ── PLAYER PHOTO — now an upload field instead of a raw URL input.
             Uploads go to {auctionId}/Auction-Images/player-images/ via
             /api/uploads, and the resulting public URL is stored on
             form.img exactly as before, so the rest of the save flow
             (onSave → players.img) is unchanged. ── */}
        <div>
          <ImageUploadField
            auctionId={auctionId}
            kind="player"
            value={form.img}
            onChange={(url) => set("img", url)}
            label="Player Photo (optional)"
          />
          {!form.img && (
            <p className="mt-1.5 text-[10px] flex items-center gap-1" style={{ color: "var(--color-warning)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>warning</span>
              No photo — a placeholder will be shown on the auction board.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface-variant)", fontFamily: "var(--font-label-mono)" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:-translate-y-0.5"
            style={{
              background: saving ? "rgba(201,151,31,0.5)" : "var(--color-theme-orange)",
              color: "var(--color-on-primary)", fontFamily: "var(--font-label-mono)",
              boxShadow: "0 0 18px rgba(201,151,31,0.25)",
              cursor: saving ? "wait" : "pointer",
            }}>
            {saving ? (isEdit ? "Saving…" : "Registering…") : (isEdit ? "Save Changes" : "Register Player")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Player Card ───────────────────────────────────────────────────────────────
function PlayerCard({
  player, onEdit, onDelete, locked, teams,
}: {
  player: Player; onEdit: () => void; onDelete: () => void; locked: boolean; teams: Team[];
}) {
  const [hovered, setHovered] = useState(false);
  const roleStyle = ROLE_COLORS[player.role as Role] ?? { bg: "var(--color-surface-container-high)", text: "var(--color-on-surface-variant)" };
  const missingPhoto = !player.img;
  const captainTeam = player.ownerTeamCode ? teams.find((t) => t.code === player.ownerTeamCode) : undefined;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative overflow-hidden rounded-xl flex flex-col"
      style={{
        background: "var(--color-surface-glass)",
        backdropFilter: "blur(24px)",
        border: `1px solid ${
          missingPhoto
            ? "var(--color-warning-outline)"
            : hovered && !locked
            ? "rgba(201,151,31,0.4)"
            : "var(--color-border-overlay)"
        }`,
        boxShadow: hovered && !locked ? "0 4px 24px rgba(201,151,31,0.1)" : "0 4px 20px rgba(0,0,0,0.3)",
        transform: hovered && !locked ? "translateY(-3px)" : "translateY(0)",
        transition: "all 0.2s ease",
      }}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: hovered && !locked ? "rgba(201,151,31,0.09)" : "rgba(201,151,31,0.04)",
          transform: "translate(40%,-40%)", filter: "blur(32px)",
        }} />

      <div className="relative w-full flex items-end justify-center overflow-hidden"
        style={{ height: "160px", background: "var(--color-surface-container)" }}>
        {player.img ? (
          <img src={player.img} alt={player.name} className="h-full w-full object-cover" style={{ objectPosition: "center 10%" }} />
        ) : (
          // ── No photo: amber placeholder ──
          <div className="h-full w-full flex flex-col items-center justify-center gap-2"
            style={{ background: "var(--color-warning-container)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(251,191,36,0.3)" }}>
              person
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-warning)", background: "var(--color-warning-container)", border: "1px solid var(--color-warning-outline)" }}>
              No Photo
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(13,17,23,0.95), transparent)" }} />

        {player.capped && (
          <div className="absolute top-2.5 left-2.5">
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: "rgba(201,151,31,0.18)", color: "var(--color-theme-orange)", border: "1px solid rgba(201,151,31,0.35)", fontFamily: "var(--font-label-mono)" }}>
              Capped
            </span>
          </div>
        )}

        {/* ── Captain badge ── */}
        {captainTeam && (
          <div className="absolute top-2.5 left-2.5" style={{ marginTop: player.capped ? "22px" : "0" }}>
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "rgba(52,211,153,0.15)", color: "var(--color-success)", border: "1px solid rgba(52,211,153,0.35)", fontFamily: "var(--font-label-mono)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "9px" }}>star</span>
              {captainTeam.code} Captain
            </span>
          </div>
        )}

        { /* ── Edit / Delete — always rendered (not hover-only) when unlocked ── */}
        {hovered && !locked && (
          <div className="absolute top-2.5 right-2.5 flex gap-1.5 z-10">
            <IconButton icon="edit" onClick={(e) => { e.stopPropagation(); onEdit(); }} />
            <IconButton icon="delete" danger onClick={(e) => { e.stopPropagation(); onDelete(); }} />
          </div>
        )}
        {locked && (
          <div className="absolute top-2.5 right-2.5">
            <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "var(--color-surface-variant)" }}>lock</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 relative z-10">
        <div>
          <h3 className="text-lg leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-headline-md)", fontWeight: 700, color: "var(--color-on-surface)" }}>
            {player.name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ fontFamily: "var(--font-label-mono)", background: roleStyle.bg, color: roleStyle.text }}>
              {player.role}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                fontFamily: "var(--font-label-mono)",
                background: player.origin === "Overseas" ? "rgba(200,205,216,0.1)" : "var(--color-surface-container-high)",
                color: player.origin === "Overseas" ? "var(--color-secondary)" : "var(--color-outline)",
              }}>
              {player.origin}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--color-outline-variant)" }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
            Base Price
          </span>
          <span className="text-sm font-black" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}>
            {player.price.toLocaleString()} pts
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function PlayersTab({ locked, players, teams, auctionId, onAddPlayer, onEditPlayer, onDeletePlayer }: PlayersTabProps) {
  const [filter, setFilter]       = useState<Filter>("All");
  const [modal, setModal] = useState<null | { mode: "add" } | { mode: "edit"; player: Player }>(null);
  const [poolLocked, setPoolLocked] = useState(false);

  const isEditingBlocked = locked || poolLocked;
  const filtered = filter === "All" ? players : players.filter((p) => p.role === filter);

  const roleCounts = ROLES.reduce<Record<Role, number>>((acc, r) => {
    acc[r] = players.filter((p) => p.role === r).length;
    return acc;
  }, {} as Record<Role, number>);

  const totalPoolValue    = players.reduce((sum, p) => sum + p.price, 0);
  const missingPhotoCount = players.filter((p) => !p.img).length;
  const captainCount      = players.filter((p) => !!p.ownerTeamCode).length;

  const handleDelete = useCallback(async (id: number) => {
    try { await onDeletePlayer(id); } catch { /* handled by context */ }
  }, [onDeletePlayer]);

  const handleAdd = useCallback(async (data: Omit<Player, "id" | "supabaseId">) => {
    await onAddPlayer(data);
  }, [onAddPlayer]);

  const handleEdit = useCallback(async (data: Omit<Player, "id" | "supabaseId">) => {
    if (modal?.mode !== "edit") return;
    await onEditPlayer(modal.player.id, data);
  }, [modal, onEditPlayer]);

  return (
    <>
      {modal?.mode === "add" && !isEditingBlocked && (
        <PlayerModal teams={teams} auctionId={auctionId} onClose={() => setModal(null)} onSave={handleAdd} />
      )}
      {modal?.mode === "edit" && !isEditingBlocked && (
        <PlayerModal teams={teams} auctionId={auctionId} initial={modal.player} onClose={() => setModal(null)} onSave={handleEdit} />
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          {locked && <LockBanner />}
          {poolLocked && !locked && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
              style={{ background: "rgba(201,151,31,0.07)", border: "1px solid rgba(201,151,31,0.25)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-theme-orange)", flexShrink: 0 }}>lock</span>
              <p style={{ fontSize: "12px", color: "var(--color-theme-orange)", fontFamily: "var(--font-body-md)" }}>
                Pool is <strong>manually locked</strong>.{" "}
                <button className="underline" onClick={() => setPoolLocked(false)}>Unlock</button> to make changes.
              </p>
            </div>
          )}

          {/* ── Missing photos warning — amber, non-blocking ── */}
          {missingPhotoCount > 0 && !locked && (
            <div className="flex items-start gap-3 px-5 py-3 rounded-xl mb-6"
              style={{ background: "var(--color-warning-container)", border: "1px solid var(--color-warning-outline)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-warning)", flexShrink: 0, marginTop: "1px" }}>
                image_not_supported
              </span>
              <div>
                <p className="text-sm font-bold mb-0.5" style={{ color: "var(--color-warning)", fontFamily: "var(--font-body-md)" }}>
                  {missingPhotoCount} player{missingPhotoCount > 1 ? "s" : ""} without a photo
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-warning)", opacity: 0.7, fontFamily: "var(--font-body-md)" }}>
                  Photos are optional — players without one will show a placeholder on the auction board. You can still launch.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 style={{ fontFamily: "var(--font-headline-lg)", fontSize: "32px", lineHeight: "40px", fontWeight: 700, letterSpacing: "0.01em", color: "var(--color-on-surface)" }}>
                Player Registry{" "}
                <span style={{ color: "rgba(201,151,31,0.55)" }}>({players.length} registered)</span>
              </h2>
              <p className="mt-1.5 max-w-xl" style={{ fontFamily: "var(--font-body-md)", fontSize: "14px", lineHeight: "22px", color: "var(--color-on-surface-variant)" }}>
                Add and manage players before the auction begins. Base price defaults to {DEFAULT_BASE_PRICE} pts.
              </p>
            </div>
            {!isEditingBlocked && (
              <button onClick={() => setModal({ mode: "add" })}
                className="px-5 py-2.5 font-bold flex items-center gap-1.5 rounded-xl transition-all hover:-translate-y-0.5 whitespace-nowrap ml-6"
                style={{ background: "var(--color-theme-orange)", color: "var(--color-on-primary)", boxShadow: "0 0 20px rgba(201,151,31,0.25)", fontFamily: "var(--font-label-mono)", fontSize: "12px" }}>
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
                    fontFamily: "var(--font-label-mono)",
                    background: isActive ? "rgba(201,151,31,0.15)" : "var(--color-surface-container-low)",
                    border: isActive ? "1px solid rgba(201,151,31,0.4)" : "1px solid var(--color-border-overlay)",
                    color: isActive ? "var(--color-theme-orange)" : "var(--color-outline)",
                  }}>
                  {f}
                  {f !== "All" && (
                    <span className="px-1.5 py-0.5 rounded text-[8px]"
                      style={{ background: isActive ? "rgba(201,151,31,0.2)" : "var(--color-surface-container-high)", color: isActive ? "var(--color-theme-orange)" : "var(--color-outline)" }}>
                      {roleCounts[f as Role] ?? 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-xl"
              style={{ border: "1px dashed var(--color-border-overlay)", color: "var(--color-outline)" }}>
              <span className="material-symbols-outlined text-4xl mb-3" style={{ color: "var(--color-surface-variant)" }}>person_search</span>
              <p className="text-sm" style={{ fontFamily: "var(--font-label-mono)" }}>No players in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  locked={isEditingBlocked}
                  teams={teams}
                  onEdit={() => setModal({ mode: "edit", player })}
                  onDelete={() => handleDelete(player.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="w-full lg:w-72 flex flex-col gap-5 shrink-0">
          {/* Pool summary */}
          <div className="p-4 rounded-xl"
            style={{ background: "var(--color-surface-glass)", backdropFilter: "blur(24px)", border: "1px solid rgba(201,151,31,0.12)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <h4 className="text-base mb-4" style={{ fontFamily: "var(--font-headline-md)", fontWeight: 600, color: "var(--color-on-surface)" }}>
              Pool Summary
            </h4>
            <div className="space-y-3">
              {ROLES.map((role) => {
                const count = roleCounts[role] ?? 0;
                const pct = players.length > 0 ? Math.round((count / players.length) * 100) : 0;
                const roleStyle = ROLE_COLORS[role] ?? { text: "var(--color-on-surface-variant)" };
                return (
                  <div key={role}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span style={{ color: "var(--color-on-surface-variant)" }}>{role}</span>
                      <span className="font-bold" style={{ color: roleStyle.text }}>{count} players</span>
                    </div>
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--color-surface-variant)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--color-theme-orange)", }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: "var(--color-outline-variant)" }}>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
                Total Base Value
              </span>
              <span className="text-sm font-black" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}>
                {totalPoolValue.toLocaleString()} pts
              </span>
            </div>

            {/* Photo coverage stat */}
            {players.length > 0 && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--color-outline-variant)" }}>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
                  Photo Coverage
                </span>
                <span className="text-sm font-black" style={{
                  fontFamily: "var(--font-label-mono)",
                  color: missingPhotoCount === 0 ? "var(--color-success)" : "var(--color-warning)",
                }}>
                  {players.length - missingPhotoCount}/{players.length}
                </span>
              </div>
            )}

            {/* Captains stat */}
            {players.length > 0 && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--color-outline-variant)" }}>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
                  Captains Assigned
                </span>
                <span className="text-sm font-black" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-success)" }}>
                  {captainCount}/{teams.length}
                </span>
              </div>
            )}
          </div>

          {/* Bulk actions */}
          <div className="p-4 rounded-xl"
            style={{
              background: "var(--color-surface-glass)", backdropFilter: "blur(24px)",
              border: "1px solid var(--color-border-overlay)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              opacity: isEditingBlocked ? 0.5 : 1,
              pointerEvents: isEditingBlocked ? "none" : "auto",
            }}>
            <h4 className="text-base mb-4" style={{ fontFamily: "var(--font-headline-md)", fontWeight: 600, color: "var(--color-on-surface)" }}>
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
              style={{ background: "var(--color-theme-orange)", color: "var(--color-on-primary)", letterSpacing: "0.18em", fontFamily: "var(--font-label-mono)", boxShadow: "0 0 18px rgba(201,151,31,0.25)" }}>
              Lock Player Pool
            </button>
          </div>

          {/* Overseas quota */}
          <div className="p-3 rounded-lg border" style={{ background: "var(--color-surface-container)", borderColor: "var(--color-outline-variant)" }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
              Overseas Quota
            </p>
            <div className="space-y-3">
              {([
                { label: "Overseas Players", count: players.filter((p) => p.origin === "Overseas").length, color: "var(--color-theme-orange)" },
                { label: "Local Players",    count: players.filter((p) => p.origin === "Local").length,    color: "var(--color-on-surface-variant)" },
              ] as const).map((item) => {
                const pct = players.length ? Math.round((item.count / players.length) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span style={{ color: "var(--color-on-surface-variant)" }}>{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>{item.count} / {players.length}</span>
                    </div>
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--color-surface-variant)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-theme-orange)", }} />
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
    <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-colors"
      style={{ background: checked ? "var(--color-theme-orange)" : "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)" }}>
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
      style={{ background: "var(--color-surface-container-high)", color: hovered ? "var(--color-theme-orange)" : "var(--color-on-surface-variant)" }}>
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
        background: "var(--color-surface-container)", border: "1px solid var(--color-border-overlay)",
        color: hovered ? (danger ? "var(--color-error)" : "var(--color-theme-orange)") : "var(--color-on-surface-variant)",
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
        background: hovered ? "rgba(201,151,31,0.08)" : "var(--color-surface-container)",
        borderColor: hovered ? "rgba(201,151,31,0.5)" : "var(--color-outline-variant)",
        color: hovered ? "var(--color-theme-orange)" : "var(--color-on-surface-variant)",
        fontFamily: "var(--font-label-mono)", fontSize: "11px",
      }}>
      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--color-theme-orange)" }}>{icon}</span>
      {label}
    </button>
  );
}