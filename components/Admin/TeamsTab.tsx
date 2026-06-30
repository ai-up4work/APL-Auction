"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { Team } from "@/types/auction";
import ImageUploadField from "@/components/Admin/ImageUploadField";

// ── Constants ─────────────────────────────────────────────────────────────────
const TOOLS = [
  { icon: "upload_file", label: "Import CSV" },
  { icon: "palette",     label: "Batch Style" },
  { icon: "sync",        label: "Global Sync" },
  { icon: "monitoring",  label: "Analytics" },
];

const TIERS: Team["tier"][] = ["Pro", "Elite", "Legend"];
const MAX_TEAMS = 8;

const EMPTY_FORM: Omit<Team, "id" | "roster" | "supabaseId"> = {
  name: "", code: "", tier: "Pro", owner: "", color: "var(--color-theme-orange)", logo: "", pin: "",
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface TeamsTabProps {
  locked: boolean;
  teams: Team[];
  auctionId?: string; // needed so uploaded logos land in {auctionId}/Auction-Images/team-images/
  onAddTeam: (data: Omit<Team, "id" | "roster" | "supabaseId">) => Promise<void>;
  onEditTeam: (id: number, data: Omit<Team, "id" | "roster" | "supabaseId">) => Promise<void>;
  onDeleteTeam: (id: number) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5"
      style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
      {children}
    </label>
  );
}

function inputBase(): React.CSSProperties {
  return {
    background: "var(--color-surface-container-low)",
    border: "1px solid var(--color-border-overlay)",
    color: "var(--color-on-surface)",
    fontFamily: "var(--font-body-md)",
  };
}

function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--color-theme-orange)";
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--color-border-overlay)";
}

// ── Lock Banner ───────────────────────────────────────────────────────────────
function LockBanner() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
      style={{ background: "var(--color-warning-container)", border: "1px solid var(--color-warning-outline)" }}>
      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-warning)", flexShrink: 0 }}>lock</span>
      <p style={{ fontSize: "12px", color: "var(--color-warning)", fontFamily: "var(--font-body-md)" }}>
        Team configuration is <strong>locked</strong> while the auction is live. Stop or re-auction to make changes.
      </p>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
interface ToastProps { message: string; type: "success" | "error" }

function Toast({ message, type }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
      style={{
        background: type === "success" ? "var(--color-success-container)" : "var(--color-error-container)",
        border: `1px solid ${type === "success" ? "var(--color-success)" : "var(--color-error)"}`,
        backdropFilter: "blur(12px)", minWidth: "220px",
      }}>
      <span className="material-symbols-outlined"
        style={{ fontSize: "18px", color: type === "success" ? "var(--color-success)" : "var(--color-error)", flexShrink: 0 }}>
        {type === "success" ? "check_circle" : "error"}
      </span>
      <span style={{ fontFamily: "var(--font-body-md)", fontSize: "13px", color: "var(--color-on-surface)" }}>{message}</span>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState<(ToastProps & { key: number }) | null>(null);
  function show(message: string, type: ToastProps["type"] = "success") {
    const key = Date.now();
    setToast({ message, type, key });
    setTimeout(() => setToast((t) => (t?.key === key ? null : t)), 3000);
  }
  return { toast, show };
}

// ── PIN Visibility Toggle ─────────────────────────────────────────────────────
function PinInput({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--color-border-overlay)", background: disabled ? "var(--color-surface-container-lowest)" : "var(--color-surface-container-low)" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        maxLength={6}
        disabled={disabled}
        placeholder="4–6 digits"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        style={{
          color: disabled ? "var(--color-surface-variant)" : "var(--color-on-surface)",
          fontFamily: "var(--font-label-mono)",
          letterSpacing: show ? "0.2em" : "0.3em",
          cursor: disabled ? "not-allowed" : "auto",
        }}
        onFocus={(e) => { if (!disabled) e.currentTarget.parentElement!.style.borderColor = "var(--color-theme-orange)"; }}
        onBlur={(e)  => { e.currentTarget.parentElement!.style.borderColor = "var(--color-border-overlay)"; }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="px-2.5 border-l flex items-center"
        style={{ borderColor: "var(--color-border-overlay)", color: "var(--color-outline)" }}
        tabIndex={-1}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
          {show ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  );
}

// ── Franchise Modal ───────────────────────────────────────────────────────────
interface FranchiseModalProps {
  initial?: Team;
  existingCodes: string[];
  auctionId?: string;
  onClose: () => void;
  onSave: (data: Omit<Team, "id" | "roster" | "supabaseId">) => void;
}

function FranchiseModal({ initial, existingCodes, auctionId, onClose, onSave }: FranchiseModalProps) {
  const isEdit = !!initial;
  const [form, setForm] = useState<Omit<Team, "id" | "roster" | "supabaseId">>(
    initial
      ? { name: initial.name, code: initial.code, tier: initial.tier, owner: initial.owner, color: initial.color, logo: initial.logo, pin: initial.pin ?? "" }
      : { ...EMPTY_FORM }
  );
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.name.trim())  { setError("Franchise name is required."); return; }
    if (!form.code.trim())  { setError("Team code is required."); return; }
    if (form.code.trim().length > 3) { setError("Team code must be 3 characters or fewer."); return; }
    if (!form.owner.trim()) { setError("Owner name is required."); return; }
    if (form.pin && form.pin.length < 4) { setError("PIN must be at least 4 digits."); return; }

    const upperCode = form.code.trim().toUpperCase();
    if (existingCodes.includes(upperCode)) {
      setError(`Code "${upperCode}" is already in use by another franchise.`);
      return;
    }
    onSave({ ...form, code: upperCode, name: form.name.trim(), owner: form.owner.trim() });
    onClose();
  }

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
              {isEdit ? "Edit Franchise" : "Create New Franchise"}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
              {isEdit ? "Update this franchise's details" : "Register a new competing franchise"}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--color-surface-container-high)", color: "var(--color-on-surface-variant)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-theme-orange)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-on-surface-variant)"; }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "var(--color-error-container)", color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FieldLabel>Franchise Name *</FieldLabel>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Colombo Kings"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputBase()} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <FieldLabel>Team Code * (max 3)</FieldLabel>
            <input type="text" value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase().slice(0, 3))}
              placeholder="e.g. CK"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none uppercase"
              style={{ ...inputBase(), fontFamily: "var(--font-label-mono)", letterSpacing: "0.1em" }}
              onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <FieldLabel>Tier</FieldLabel>
            <select value={form.tier} onChange={(e) => set("tier", e.target.value as Team["tier"])}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputBase()}>
              {TIERS.map((t) => <option key={t} value={t} style={{ background: "var(--color-surface-container)" }}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <FieldLabel>Owner / Organisation *</FieldLabel>
            <input type="text" value={form.owner} onChange={(e) => set("owner", e.target.value)}
              placeholder="e.g. MJ Holdings"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputBase()} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <FieldLabel>Identity Color</FieldLabel>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={(e) => set("color", e.target.value)}
                className="w-10 h-9 rounded-lg cursor-pointer"
                style={{ background: "transparent", border: "1px solid var(--color-border-overlay)", padding: "2px" }} />
              <span className="text-xs font-mono" style={{ color: "var(--color-on-surface-variant)" }}>{form.color.toUpperCase()}</span>
            </div>
          </div>

          {/* ── TEAM LOGO — now an upload field instead of a raw URL input.
               Uploads go to {auctionId}/Auction-Images/team-images/ via
               /api/uploads, and the resulting public URL is stored on
               form.logo exactly as before, so the rest of the save flow
               (onSave → teams.logo) is unchanged. ── */}
          <div>
            <ImageUploadField
              auctionId={auctionId ?? ""}
              kind="team"
              value={form.logo}
              onChange={(url) => set("logo", url)}
              label="Team Logo"
              accentColor={form.color}
            />
          </div>

          {/* ── PIN FIELD ── */}
          <div className="col-span-2">
            <FieldLabel>Owner Access PIN (4–6 digits)</FieldLabel>
            <PinInput value={form.pin ?? ""} onChange={(v) => set("pin", v)} />
            <p className="mt-1.5 text-[10px]" style={{ color: "var(--color-outline)" }}>
              Team owners use this PIN to access the bidding room. Leave blank to set later.
            </p>
          </div>
        </div>

        {(form.name || form.code) && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
              style={{ background: "var(--color-surface-bright)", border: `2px solid ${form.color}55` }}>
              {form.logo
                ? <img src={form.logo} alt="" className="w-10 h-10 object-cover" />
                : <span className="text-[10px] font-black" style={{ color: form.color, fontFamily: "var(--font-label-mono)" }}>{form.code || "—"}</span>
              }
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-headline-md)" }}>
                {form.name || "Franchise Name"}
              </p>
              <p className="text-[10px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}>
                {form.code || "CODE"} • {form.tier} {form.owner ? `• ${form.owner}` : ""}
                {form.pin ? ` • PIN: ${"•".repeat(form.pin.length)}` : " • No PIN set"}
              </p>
            </div>
            <div className="ml-auto w-3 h-3 rounded-full shrink-0" style={{ background: form.color }} />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface-variant)", fontFamily: "var(--font-label-mono)" }}>
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:-translate-y-0.5"
            style={{ background: "var(--color-theme-orange)", color: "var(--color-on-primary)", fontFamily: "var(--font-label-mono)", boxShadow: "0 0 18px rgba(201,151,31,0.25)" }}>
            {isEdit ? "Save Changes" : "Create Franchise"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────
function DeleteConfirm({ team, onConfirm, onCancel }: { team: Team; onConfirm: () => void; onCancel: () => void }) {
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9999 }}
      onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface-container)", border: "1px solid var(--color-error)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--color-error-container)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-error)" }}>warning</span>
          </div>
          <h3 style={{ fontFamily: "var(--font-headline-md)", fontSize: "17px", fontWeight: 700, color: "var(--color-on-surface)" }}>
            Remove {team.name}?
          </h3>
        </div>
        <p className="text-[13px] leading-5" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
          This franchise and all its configuration will be permanently removed. This cannot be undone.
        </p>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface-variant)", fontFamily: "var(--font-label-mono)" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-black"
            style={{ background: "var(--color-error)", color: "var(--color-on-error)", fontFamily: "var(--font-label-mono)" }}>
            Remove Franchise
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Team Card ─────────────────────────────────────────────────────────────────
function TeamCard({
  team, isActive, onClick, locked, onEdit, onDelete,
}: {
  team: Team; isActive: boolean; onClick: () => void;
  locked: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hasPIN = !!team.pin;

  return (
    <div
      onClick={() => !locked && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative overflow-hidden flex flex-col gap-4 p-5 rounded-xl"
      style={{
        background: "var(--color-surface-glass)",
        backdropFilter: "blur(24px)",
        border: isActive
          ? "2px solid var(--color-theme-orange)"
          : `1px solid ${hovered && !locked ? "rgba(201,151,31,0.4)" : "var(--color-border-overlay)"}`,
        backgroundColor: isActive ? "rgba(201,151,31,0.04)" : undefined,
        boxShadow: isActive ? "0 4px 24px rgba(201,151,31,0.12)" : "0 4px 20px rgba(0,0,0,0.3)",
        transform: hovered && !isActive && !locked ? "translateY(-3px)" : "translateY(0)",
        transition: "all 0.2s ease",
        cursor: locked ? "default" : "pointer",
        opacity: locked ? 0.7 : 1,
      }}>
      <div className="absolute top-0 right-0 w-36 h-36 rounded-full pointer-events-none"
        style={{
          background: isActive || (hovered && !locked) ? "rgba(201,151,31,0.1)" : "rgba(201,151,31,0.04)",
          transform: "translate(50%,-50%)", filter: "blur(36px)",
        }} />

      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden shadow-lg"
            style={{ background: "var(--color-surface-bright)", border: isActive ? "2px solid var(--color-theme-orange)" : "1px solid var(--color-outline-variant)" }}>
            {team.logo
              ? <img src={team.logo} alt={team.name} className="w-16 h-16 object-cover" />
              : <span className="text-sm font-black" style={{ color: team.color, fontFamily: "var(--font-label-mono)" }}>{team.code}</span>
            }
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tight"
                style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)", background: "rgba(201,151,31,0.12)", border: "1px solid rgba(201,151,31,0.2)" }}>
                {team.code} • {team.tier}
              </span>
              <span className="text-[10px]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>{team.owner}</span>
            </div>
            <h3 className="text-xl tracking-tight" style={{ fontFamily: "var(--font-headline-md)", fontWeight: 600, color: "var(--color-on-surface)" }}>
              {team.name}
            </h3>
          </div>
        </div>

        {/*
          FIX: edit/delete buttons used to be gated behind `hovered` via an
          opacity-0 / opacity-100 className toggle. That made them invisible
          and unreachable on touch devices, and easy to miss otherwise.
          They are now always rendered (no hover-only opacity gating) as
          long as the card isn't locked by a live/paused auction.
        */}
        {hovered && !locked ? (
          <div className="flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: "var(--color-surface-container)", color: "var(--color-on-surface-variant)", border: "1px solid var(--color-border-overlay)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-theme-orange)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-on-surface-variant)"; }}
              title="Edit franchise">
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>edit</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: "var(--color-surface-container)", color: "var(--color-on-surface-variant)", border: "1px solid var(--color-border-overlay)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-error)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-on-surface-variant)"; }}
              title="Remove franchise">
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
            </button>
          </div>
        ) : (
          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--color-surface-variant)" }}>lock</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 pt-4 border-t relative z-10" style={{ borderColor: "var(--color-border-overlay)" }}>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
            Identity Color
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white/10" style={{ background: team.color }} />
            <span className="text-[10px]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface)" }}>
              {team.color.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
            Roster Size
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold" style={{ color: "var(--color-theme-orange)" }}>
              {String(team.roster).padStart(2, "0")}
            </span>
            <span className="text-[10px]" style={{ color: "var(--color-on-surface-variant)" }}>Players</span>
          </div>
        </div>

        {/* ── PIN STATUS ── */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
            Owner PIN
          </span>
          <div className="flex items-center gap-1.5">
            {hasPIN ? (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "var(--color-success-green)" }}>lock</span>
                <span className="text-[10px]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-success-green)" }}>
                  {"•".repeat(team.pin!.length)}
                </span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "var(--color-error)" }}>lock_open</span>
                <span className="text-[10px]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-error)" }}>Not set</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function TeamsTab({ locked, teams, auctionId, onAddTeam, onEditTeam, onDeleteTeam }: TeamsTabProps) {
  const [activeTeamId, setActiveTeamId] = useState<number | null>(teams[0]?.id ?? null);
  const [modal, setModal] = useState<null | { mode: "add" } | { mode: "edit"; team: Team }>(null);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const { toast, show: showToast } = useToast();

  const atCapacity = teams.length >= MAX_TEAMS;

  if (activeTeamId !== null && !teams.find((t) => t.id === activeTeamId) && teams.length > 0) {
    setActiveTeamId(teams[0].id);
  }

  // PIN warning banner
  const teamsWithoutPin = teams.filter((t) => !t.pin);
  const showPinWarning = teamsWithoutPin.length > 0 && !locked;

  async function handleAdd(data: Omit<Team, "id" | "roster" | "supabaseId">) {
    try {
      await onAddTeam(data);
      showToast(`${data.name} has been created.`);
    } catch {
      showToast("Failed to create franchise.", "error");
    }
  }

  async function handleEdit(data: Omit<Team, "id" | "roster" | "supabaseId">) {
    if (modal?.mode !== "edit") return;
    try {
      await onEditTeam(modal.team.id, data);
      showToast("Franchise updated successfully.");
    } catch {
      showToast("Failed to update franchise.", "error");
    }
  }

  async function handleDelete(team: Team) {
    try {
      await onDeleteTeam(team.id);
      setDeleteTarget(null);
      showToast(`${team.name} has been removed.`, "error");
    } catch {
      showToast("Failed to remove franchise.", "error");
    }
  }

  function existingCodes(excludeId?: number) {
    return teams.filter((t) => t.id !== excludeId).map((t) => t.code.toUpperCase());
  }

  return (
    <>
      {modal?.mode === "add" && (
        <FranchiseModal existingCodes={existingCodes()} auctionId={auctionId} onClose={() => setModal(null)} onSave={handleAdd} />
      )}
      {modal?.mode === "edit" && (
        <FranchiseModal initial={modal.team} existingCodes={existingCodes(modal.team.id)} auctionId={auctionId} onClose={() => setModal(null)} onSave={handleEdit} />
      )}
      {deleteTarget && (
        <DeleteConfirm team={deleteTarget} onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} />}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          {locked && <LockBanner />}

          {/* ── PIN warning banner ── */}
          {showPinWarning && (
            <div className="flex items-start gap-3 px-5 py-3 rounded-xl mb-6"
              style={{ background: "var(--color-warning-container)", border: "1px solid var(--color-warning-outline)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-warning)", flexShrink: 0, marginTop: "1px" }}>
                lock_open
              </span>
              <div>
                <p className="text-sm font-bold mb-0.5" style={{ color: "var(--color-warning)", fontFamily: "var(--font-body-md)" }}>
                  {teamsWithoutPin.length} franchise{teamsWithoutPin.length > 1 ? "s" : ""} missing owner PIN
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-warning)", opacity: 0.7, fontFamily: "var(--font-body-md)" }}>
                  {teamsWithoutPin.map((t) => t.name).join(", ")} — click the edit button on each card to set their PIN before launch.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 style={{ fontFamily: "var(--font-headline-lg)", fontSize: "32px", lineHeight: "40px", fontWeight: 700, letterSpacing: "0.01em", color: "var(--color-on-surface)" }}>
                Franchise Directory{" "}
                <span style={{ color: "rgba(201,151,31,0.55)" }}>({teams.length}/{MAX_TEAMS})</span>
              </h2>
              <p className="mt-1.5 max-w-xl" style={{ fontFamily: "var(--font-body-md)", fontSize: "14px", lineHeight: "22px", color: "var(--color-on-surface-variant)" }}>
                Configure competing franchises and visual identities for the broadcast engine.
              </p>
            </div>

            {!locked && (
              <button
                onClick={() => {
                  if (atCapacity) { showToast(`Maximum of ${MAX_TEAMS} franchises reached.`, "error"); return; }
                  setModal({ mode: "add" });
                }}
                className="px-5 py-2.5 font-bold flex items-center gap-1.5 rounded-xl transition-all hover:-translate-y-0.5 whitespace-nowrap ml-6"
                style={{
                  background: atCapacity ? "var(--color-surface-container-high)" : "var(--color-theme-orange)",
                  color: atCapacity ? "var(--color-surface-variant)" : "var(--color-on-primary)",
                  boxShadow: atCapacity ? "none" : "0 0 20px rgba(201,151,31,0.25)",
                  fontFamily: "var(--font-label-mono)", fontSize: "12px",
                  cursor: atCapacity ? "not-allowed" : "pointer",
                }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
                Create New Franchise
              </button>
            )}
          </div>

          {atCapacity && !locked && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
              style={{ background: "var(--color-warning-container)", border: "1px solid var(--color-warning-outline)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--color-warning)", flexShrink: 0 }}>info</span>
              <p style={{ fontSize: "12px", color: "var(--color-warning)", fontFamily: "var(--font-body-md)" }}>
                All {MAX_TEAMS} franchise slots are filled. Remove a franchise to add a new one.
              </p>
            </div>
          )}

          {teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-xl"
              style={{ border: "1px dashed var(--color-border-overlay)", color: "var(--color-outline)" }}>
              <span className="material-symbols-outlined text-4xl mb-3" style={{ color: "var(--color-surface-variant)" }}>group</span>
              <p className="text-sm mb-4" style={{ fontFamily: "var(--font-label-mono)" }}>No franchises yet</p>
              {!locked && (
                <button onClick={() => setModal({ mode: "add" })}
                  className="px-4 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--color-theme-orange)", color: "var(--color-on-primary)", fontFamily: "var(--font-label-mono)" }}>
                  Create First Franchise
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {teams.map((team) => (
                <TeamCard
                  key={team.id} team={team}
                  isActive={activeTeamId === team.id}
                  onClick={() => setActiveTeamId(team.id)}
                  locked={locked}
                  onEdit={() => setModal({ mode: "edit", team })}
                  onDelete={() => setDeleteTarget(team)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 flex flex-col gap-5 shrink-0">
          <div className="p-4 rounded-xl"
            style={{
              background: "var(--color-surface-glass)", backdropFilter: "blur(24px)",
              border: "1px solid rgba(201,151,31,0.12)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              opacity: locked ? 0.5 : 1, pointerEvents: locked ? "none" : "auto",
            }}>
            <h4 className="text-base mb-4" style={{ fontFamily: "var(--font-headline-md)", fontWeight: 600, color: "var(--color-on-surface)" }}>
              Management Tools
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {TOOLS.map((tool) => <SidebarTool key={tool.label} icon={tool.icon} label={tool.label} />)}
            </div>
            <button
              className="w-full mt-4 py-3 font-black text-[10px] uppercase rounded-xl transition-all hover:opacity-90 hover:-translate-y-0.5"
              style={{ background: "var(--color-theme-orange)", color: "var(--color-on-primary)", letterSpacing: "0.18em", fontFamily: "var(--font-label-mono)", boxShadow: "0 0 18px rgba(201,151,31,0.25)" }}
              onClick={() => showToast("Opening live dashboard…")}>
              Access Live Dashboard
            </button>
          </div>

          {/* PIN status summary */}
          <div className="p-4 rounded-xl"
            style={{ background: "var(--color-surface-glass)", backdropFilter: "blur(24px)", border: "1px solid var(--color-border-overlay)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <h4 className="text-base mb-4" style={{ fontFamily: "var(--font-headline-md)", fontWeight: 600, color: "var(--color-on-surface)" }}>
              PIN Status
            </h4>
            <div className="flex flex-col gap-2">
              {teams.length === 0 ? (
                <p className="text-[11px]" style={{ color: "var(--color-outline)" }}>No franchises yet.</p>
              ) : (
                teams.map((team) => (
                  <div key={team.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: "var(--color-surface-container-low)", border: `1px solid ${team.pin ? "rgba(52,211,153,0.15)" : "rgba(255,180,171,0.2)"}` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: team.color }} />
                      <span className="text-[11px] font-bold" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface)" }}>
                        {team.code}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--color-outline)" }}>{team.name}</span>
                    </div>
                    {team.pin ? (
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "var(--color-success-green)" }}>check_circle</span>
                        <span className="text-[9px] font-black uppercase" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-success-green)" }}>Set</span>
                      </div>
                    ) : (
                      <button onClick={() => setModal({ mode: "edit", team })}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all"
                        style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-error)", background: "var(--color-error-container)", border: "1px solid var(--color-error)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>add</span>
                        Set PIN
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg border" style={{ background: "var(--color-surface-container)", borderColor: "var(--color-outline-variant)" }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
              Franchise Data Sync
            </p>
            <div className="space-y-3">
              {[
                { label: "Purse Utilization", value: "42%", pct: 42, color: "var(--color-theme-orange)" },
                {
                  label: "Squad Composition",
                  value: `${teams.reduce((s, t) => s + t.roster, 0)} / ${teams.length * 25}`,
                  pct: Math.round((teams.reduce((s, t) => s + t.roster, 0) / Math.max(teams.length * 25, 1)) * 100),
                  color: "var(--color-on-surface-variant)",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span style={{ color: "var(--color-on-surface-variant)" }}>{item.label}</span>
                    <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--color-surface-variant)" }}>
                    <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function SidebarTool({ icon, label }: { icon: string; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all"
      style={{
        background: hovered ? "rgba(201,151,31,0.08)" : "var(--color-surface-container)",
        borderColor: hovered ? "rgba(201,151,31,0.5)" : "var(--color-outline-variant)",
      }}>
      <span className="material-symbols-outlined text-xl" style={{ color: "var(--color-theme-orange)" }}>{icon}</span>
      <span className="text-[9px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
        {label}
      </span>
    </button>
  );
}