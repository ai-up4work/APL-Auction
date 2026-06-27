"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Team {
  id: number;
  code: string;
  tier: "Pro" | "Elite" | "Legend";
  owner: string;
  name: string;
  color: string;
  roster: number;
  logo: string;
}

let _nextId = 10;
function nextId() { return _nextId++; }

// ── Initial data ──────────────────────────────────────────────────────────────
const INITIAL_TEAMS: Team[] = [
  {
    id: 1, code: "CK", tier: "Pro", owner: "Fraser & Co.", name: "Colombo Kings",
    color: "#002B5B", roster: 8,
    logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuBGZEFsZEExJW7DMUwPPUd4jIpS4MzHL_jwHhAkoAEqPNOithkjhP04KjuIEA7vHanvaN5GtYFUpDylT38P37jFZXkNOZm92EUr4ZIS21KHyH0bxG-yvoQngEyzHl1PzheB_Y3BJCJPlBYHXyPBfR4GYXF5AU2n_3QawAopHm1wW37bckkp89U8g33-QCYEbocryfbsqcoD8ntVA8Ge_saxsHTDpm5XkefiADizh21maaetQ1DzKOsvj-mUpEjCc70gSM2afCntCew",
  },
  {
    id: 2, code: "KW", tier: "Elite", owner: "MJ Holdings", name: "Kandy Warriors",
    color: "#e45d35", roster: 12,
    logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuDx5NPblel9xPIO1UdtkFaoRu8qICCnXarW1Rbo6Ycn1nlaM_5P9ZQticpEGXo30GWtW9WvbtReNvahha_G8Lf9ySKb-4wC_rR8KWiz6g1NgKqKtS_EDFOJs1HSAymukyanN6p64VTUPCZBxMPvaq4z1-IfjFkFG5peSZUW8FfxmyqiVMqWf-fe7QA0cOKu4o7w9Z_WpiwjzcwmTllEayYHoquZivEevRUbGW29FTmDgS-tQZ927gERBrRA5wzcDL5KHZqKtHM09Qc",
  },
  {
    id: 3, code: "GG", tier: "Pro", owner: "Nadeem Abid", name: "Galle Gladiators",
    color: "#4B0082", roster: 6,
    logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuDst4Chqv9boiM9deT3ixVz6Umvtwmp3kGvvxAtpsDqWmS6KI15lyZFQnX0K28JbZMefeTDIEwwb1cs31ebVMf7YuGVDBsEljdEF4u6r7suESQxr1xjsRps88wztuu5ma6pNngJjpKXCnAzPLnWg3yvL9hwrBI1KVFEX5uQO7zkAEq8nHUovolnsJgVk6J3Pj4j4Th4BSlPEzzHREv4B4NSue4w2YuujGO7NYQAxKrSDpmmbEw5KmZ0r2XRdgm_J7b3IO_FibnuEOE",
  },
  {
    id: 4, code: "JS", tier: "Pro", owner: "Arnold George", name: "Jaffna Stallions",
    color: "#006400", roster: 10,
    logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuA1Yqq_gu7dFEFFJ9Vjpm-1qVEIq1vCLPTd5BluCdxaUJ4B9DYmTKP7KnPZfjmyETGUAHjkIaHvZ50Hn8jQhncL1c0wiVEpd23jiUeXNCejQ0BFbf8kU70UPXhEsbz7jYBSQu7C1HIM__3nZRg1sab-BPHew95Y2Y-qOnLDBckRlfW-EoC6_FV5Mof2ElobuTr3ifLSOyuA1E1gY25XAIiJD5oU13KZyf-3fkcMkQevfyI6LUqE2zHrK5V7aKcOmJByMho8rXbIeCw",
  },
];

const TOOLS = [
  { icon: "upload_file", label: "Import CSV" },
  { icon: "palette",     label: "Batch Style" },
  { icon: "sync",        label: "Global Sync" },
  { icon: "monitoring",  label: "Analytics" },
];

const TIERS: Team["tier"][] = ["Pro", "Elite", "Legend"];
const MAX_TEAMS = 8;

const EMPTY_FORM: Omit<Team, "id" | "roster"> = {
  name: "", code: "", tier: "Pro", owner: "", color: "#e45d35", logo: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5"
      style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
      {children}
    </label>
  );
}

function inputBase(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#e0e3e4",
    fontFamily: "'Inter', sans-serif",
  };
}

function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(228,93,53,0.5)";
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
}

// ── Lock Banner ───────────────────────────────────────────────────────────────
function LockBanner() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
      style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fbbf24", flexShrink: 0 }}>lock</span>
      <p style={{ fontSize: "12px", color: "#fbbf24", fontFamily: "'Inter', sans-serif" }}>
        Team configuration is <strong>locked</strong> while the auction is live. Stop or re-auction to make changes.
      </p>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
interface ToastProps { message: string; type: "success" | "error" }

function Toast({ message, type }: ToastProps) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
      style={{
        background: type === "success" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
        border: `1px solid ${type === "success" ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
        backdropFilter: "blur(12px)",
        minWidth: "220px",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: type === "success" ? "#34d399" : "#f87171", flexShrink: 0 }}>
        {type === "success" ? "check_circle" : "error"}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#e0e3e4" }}>{message}</span>
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

// ── Franchise Modal (Add + Edit) ──────────────────────────────────────────────
interface FranchiseModalProps {
  initial?: Team;
  existingCodes: string[];
  onClose: () => void;
  onSave: (data: Omit<Team, "id" | "roster">) => void;
}

function FranchiseModal({ initial, existingCodes, onClose, onSave }: FranchiseModalProps) {
  const isEdit = !!initial;
  const [form, setForm] = useState<Omit<Team, "id" | "roster">>(
    initial
      ? { name: initial.name, code: initial.code, tier: initial.tier, owner: initial.owner, color: initial.color, logo: initial.logo }
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
        style={{ background: "#181c1d", border: "1px solid rgba(228,93,53,0.2)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: "22px", fontWeight: 700, color: "#e0e3e4" }}>
              {isEdit ? "Edit Franchise" : "Create New Franchise"}
            </h3>
            <p style={{ fontSize: "12px", color: "#c6c6cd", marginTop: "2px" }}>
              {isEdit ? "Update this franchise's details" : "Register a new competing franchise"}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", color: "#c6c6cd" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e45d35"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#c6c6cd"; }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
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
              style={{ ...inputBase(), fontFamily: "'Geist', monospace", letterSpacing: "0.1em" }}
              onFocus={focusOn} onBlur={focusOff} />
          </div>

          <div>
            <FieldLabel>Tier</FieldLabel>
            <select value={form.tier} onChange={(e) => set("tier", e.target.value as Team["tier"])}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputBase()}>
              {TIERS.map((t) => <option key={t} value={t} style={{ background: "#181c1d" }}>{t}</option>)}
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
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", padding: "2px" }} />
              <span className="text-xs font-mono" style={{ color: "#c6c6cd" }}>{form.color.toUpperCase()}</span>
            </div>
          </div>

          <div>
            <FieldLabel>Logo URL</FieldLabel>
            <input type="text" value={form.logo} onChange={(e) => set("logo", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputBase()} onFocus={focusOn} onBlur={focusOff} />
          </div>
        </div>

        {(form.name || form.code) && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
              style={{ background: "#313536", border: `2px solid ${form.color}55` }}>
              {form.logo
                ? <img src={form.logo} alt="" className="w-9 h-9 object-contain" />
                : <span className="text-[10px] font-black" style={{ color: form.color, fontFamily: "'Geist', monospace" }}>{form.code || "—"}</span>
              }
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#e0e3e4", fontFamily: "'Archivo Narrow', sans-serif" }}>
                {form.name || "Franchise Name"}
              </p>
              <p className="text-[10px]" style={{ color: "#9a9aa5", fontFamily: "'Geist', monospace" }}>
                {form.code || "CODE"} • {form.tier} {form.owner ? `• ${form.owner}` : ""}
              </p>
            </div>
            <div className="ml-auto w-3 h-3 rounded-full shrink-0" style={{ background: form.color }} />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#c6c6cd", fontFamily: "'Geist', monospace" }}>
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:-translate-y-0.5"
            style={{ background: "#e45d35", color: "#fff", fontFamily: "'Geist', monospace", boxShadow: "0 0 18px rgba(228,93,53,0.25)" }}>
            {isEdit ? "Save Changes" : "Create Franchise"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────
function DeleteConfirm({ team, onConfirm, onCancel }: { team: Team; onConfirm: () => void; onCancel: () => void }) {
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9999 }}
      onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "#181c1d", border: "1px solid rgba(248,113,113,0.3)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(248,113,113,0.12)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#f87171" }}>warning</span>
          </div>
          <h3 style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: "17px", fontWeight: 700, color: "#e0e3e4" }}>
            Remove {team.name}?
          </h3>
        </div>
        <p className="text-[13px] leading-5" style={{ color: "#9a9aa5", fontFamily: "'Inter', sans-serif" }}>
          This franchise and all its configuration will be permanently removed. This cannot be undone.
        </p>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#c6c6cd", fontFamily: "'Geist', monospace" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-black"
            style={{ background: "#f87171", color: "#fff", fontFamily: "'Geist', monospace" }}>
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
  team, isActive, onClick, locked,
  onEdit, onDelete,
}: {
  team: Team;
  isActive: boolean;
  onClick: () => void;
  locked: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => !locked && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative overflow-hidden flex flex-col gap-4 p-5 rounded-xl"
      style={{
        background: "rgba(16,20,21,0.4)",
        backdropFilter: "blur(24px)",
        border: isActive
          ? "2px solid rgba(228,93,53,0.5)"
          : `1px solid ${hovered && !locked ? "rgba(228,93,53,0.4)" : "rgba(255,255,255,0.08)"}`,
        backgroundColor: isActive ? "rgba(228,93,53,0.04)" : undefined,
        boxShadow: isActive ? "0 4px 24px rgba(228,93,53,0.12)" : "0 4px 20px rgba(0,0,0,0.3)",
        transform: hovered && !isActive && !locked ? "translateY(-3px)" : "translateY(0)",
        transition: "all 0.2s ease",
        cursor: locked ? "default" : "pointer",
        opacity: locked ? 0.7 : 1,
      }}
    >
      <div className="absolute top-0 right-0 w-36 h-36 rounded-full pointer-events-none"
        style={{
          background: isActive || (hovered && !locked) ? "rgba(228,93,53,0.1)" : "rgba(228,93,53,0.04)",
          transform: "translate(50%,-50%)", filter: "blur(36px)",
        }} />

      {isActive && (
        <div className="absolute top-3 right-3 z-20">
          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full"
            style={{ background: "rgba(228,93,53,0.18)", color: "#e45d35", border: "1px solid rgba(228,93,53,0.35)", fontFamily: "'Geist', monospace" }}>
            Active Selection
          </span>
        </div>
      )}

      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden shadow-lg"
            style={{ background: "#313536", border: isActive ? "2px solid rgba(228,93,53,0.5)" : "1px solid #45464d" }}>
            {team.logo
              ? <img src={team.logo} alt={team.name} className="w-14 h-14 object-contain" />
              : <span className="text-sm font-black" style={{ color: team.color, fontFamily: "'Geist', monospace" }}>{team.code}</span>
            }
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tight"
                style={{ fontFamily: "'Geist', monospace", color: "#e45d35", background: "rgba(228,93,53,0.12)", border: "1px solid rgba(228,93,53,0.2)" }}>
                {team.code} • {team.tier}
              </span>
              <span className="text-[10px]" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>{team.owner}</span>
            </div>
            <h3 className="text-xl tracking-tight"
              style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 600, color: "#e0e3e4" }}>
              {team.name}
            </h3>
          </div>
        </div>

        {!locked && (
          <div className={`flex items-center gap-1.5 transition-opacity duration-150 ${hovered ? "opacity-100" : "opacity-0"}`}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(24,28,29,0.8)", color: "#c6c6cd", border: "1px solid rgba(255,255,255,0.1)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e45d35"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#c6c6cd"; }}
              title="Edit franchise">
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>edit</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(24,28,29,0.8)", color: "#c6c6cd", border: "1px solid rgba(255,255,255,0.1)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#c6c6cd"; }}
              title="Remove franchise">
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
            </button>
          </div>
        )}
        {locked && (
          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#45464d" }}>lock</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5 relative z-10">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest"
            style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>Identity Color</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white/10" style={{ background: team.color }} />
            <span className="text-[10px]" style={{ fontFamily: "'Geist', monospace", color: "#e0e3e4" }}>
              {team.color.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest"
            style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>Roster Size</span>
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold" style={{ color: "#e45d35" }}>
              {String(team.roster).padStart(2, "0")}
            </span>
            <span className="text-[10px]" style={{ color: "#c6c6cd" }}>Players Locked</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function TeamsTab({ locked = false }: { locked?: boolean }) {
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [activeTeamId, setActiveTeamId] = useState<number>(2);

  const [modal, setModal] = useState<null | { mode: "add" } | { mode: "edit"; team: Team }>(null);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const { toast, show: showToast } = useToast();

  const atCapacity = teams.length >= MAX_TEAMS;

  function handleAdd(data: Omit<Team, "id" | "roster">) {
    const newTeam: Team = { ...data, id: nextId(), roster: 0 };
    setTeams((prev) => [...prev, newTeam]);
    setActiveTeamId(newTeam.id);
    showToast(`${newTeam.name} has been created.`);
  }

  function handleEdit(data: Omit<Team, "id" | "roster">) {
    setTeams((prev) => prev.map((t) =>
      t.id === (modal as { mode: "edit"; team: Team }).team.id
        ? { ...t, ...data }
        : t
    ));
    showToast("Franchise updated successfully.");
  }

  function handleDelete(team: Team) {
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
    if (activeTeamId === team.id && teams.length > 1) {
      const remaining = teams.filter((t) => t.id !== team.id);
      setActiveTeamId(remaining[0].id);
    }
    setDeleteTarget(null);
    showToast(`${team.name} has been removed.`, "error");
  }

  function existingCodes(excludeId?: number) {
    return teams
      .filter((t) => t.id !== excludeId)
      .map((t) => t.code.toUpperCase());
  }

  return (
    <>
      {modal?.mode === "add" && (
        <FranchiseModal
          existingCodes={existingCodes()}
          onClose={() => setModal(null)}
          onSave={handleAdd}
        />
      )}
      {modal?.mode === "edit" && (
        <FranchiseModal
          initial={modal.team}
          existingCodes={existingCodes(modal.team.id)}
          onClose={() => setModal(null)}
          onSave={handleEdit}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          team={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} />}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          {locked && <LockBanner />}

          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: "32px", lineHeight: "40px", fontWeight: 700, letterSpacing: "0.01em", color: "#e0e3e4" }}>
                Franchise Directory{" "}
                <span style={{ color: "rgba(228,93,53,0.55)" }}>({teams.length}/{MAX_TEAMS})</span>
              </h2>
              <p className="mt-1.5 max-w-xl" style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", lineHeight: "22px", color: "#c6c6cd" }}>
                Configure competing franchises and visual identities for the broadcast engine.
              </p>
            </div>

            {!locked && (
              <button
                onClick={() => {
                  if (atCapacity) {
                    showToast(`Maximum of ${MAX_TEAMS} franchises reached.`, "error");
                    return;
                  }
                  setModal({ mode: "add" });
                }}
                className="px-5 py-2.5 font-bold flex items-center gap-1.5 rounded-xl transition-all hover:-translate-y-0.5 whitespace-nowrap ml-6"
                style={{
                  background: atCapacity ? "rgba(255,255,255,0.06)" : "#e45d35",
                  color: atCapacity ? "#45464d" : "#fff",
                  boxShadow: atCapacity ? "none" : "0 0 20px rgba(228,93,53,0.25)",
                  fontFamily: "'Geist', monospace",
                  fontSize: "12px",
                  cursor: atCapacity ? "not-allowed" : "pointer",
                }}
                title={atCapacity ? `Maximum of ${MAX_TEAMS} franchises reached` : undefined}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
                Create New Franchise
              </button>
            )}
          </div>

          {atCapacity && !locked && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
              style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#fbbf24", flexShrink: 0 }}>info</span>
              <p style={{ fontSize: "12px", color: "#fbbf24", fontFamily: "'Inter', sans-serif" }}>
                All {MAX_TEAMS} franchise slots are filled. Remove a franchise to add a new one.
              </p>
            </div>
          )}

          {teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-xl"
              style={{ border: "1px dashed rgba(255,255,255,0.08)", color: "#9a9aa5" }}>
              <span className="material-symbols-outlined text-4xl mb-3" style={{ color: "#45464d" }}>group</span>
              <p className="text-sm mb-4" style={{ fontFamily: "'Geist', monospace" }}>No franchises yet</p>
              {!locked && (
                <button onClick={() => setModal({ mode: "add" })}
                  className="px-4 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "#e45d35", color: "#fff", fontFamily: "'Geist', monospace" }}>
                  Create First Franchise
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
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

        {/* Right sidebar */}
        <aside className="w-full lg:w-72 flex flex-col gap-5 shrink-0">
          <div className="p-4 rounded-xl"
            style={{
              background: "rgba(16,20,21,0.4)", backdropFilter: "blur(24px)",
              border: "1px solid rgba(228,93,53,0.12)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              opacity: locked ? 0.5 : 1, pointerEvents: locked ? "none" : "auto",
            }}>
            <h4 className="text-base mb-4" style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 600, color: "#e0e3e4" }}>
              Management Tools
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {TOOLS.map((tool) => (
                <SidebarTool key={tool.label} icon={tool.icon} label={tool.label} />
              ))}
            </div>
            <button
              className="w-full mt-4 py-3 font-black text-[10px] uppercase rounded-xl transition-all hover:opacity-90 hover:-translate-y-0.5"
              style={{ background: "#e45d35", color: "#fff", letterSpacing: "0.18em", fontFamily: "'Geist', monospace", boxShadow: "0 0 18px rgba(228,93,53,0.25)" }}
              onClick={() => showToast("Opening live dashboard…")}>
              Access Live Dashboard
            </button>
          </div>

          <div className="p-3 rounded-lg border" style={{ background: "rgba(24,28,29,0.3)", borderColor: "rgba(69,70,77,0.3)" }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-3"
              style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
              Franchise Data Sync
            </p>
            <div className="space-y-3">
              {[
                { label: "Purse Utilization",  value: "42%",   pct: 42, color: "#e45d35" },
                { label: "Squad Composition",  value: `${teams.reduce((s, t) => s + t.roster, 0)} / ${teams.length * 25}`, pct: Math.round((teams.reduce((s, t) => s + t.roster, 0) / Math.max(teams.length * 25, 1)) * 100), color: "#c6c6cd" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span style={{ color: "#c6c6cd" }}>{item.label}</span>
                    <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "#313536" }}>
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
        background: hovered ? "rgba(228,93,53,0.08)" : "rgba(39,43,44,0.4)",
        borderColor: hovered ? "rgba(228,93,53,0.5)" : "rgba(69,70,77,0.3)",
      }}>
      <span className="material-symbols-outlined text-xl" style={{ color: "#e45d35" }}>{icon}</span>
      <span className="text-[9px] font-black uppercase tracking-widest"
        style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
        {label}
      </span>
    </button>
  );
}