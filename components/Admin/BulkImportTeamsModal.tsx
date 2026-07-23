"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { Team } from "@/types/auction";

const VALID_TIERS = ["Pro", "Elite", "Legend"] as const;

interface ParsedRow {
  line: number;
  name: string;
  code: string;
  tier: Team["tier"];
  owner: string;
  color: string;
  pin: string;
  error: string | null;
}

interface Props {
  existingCodes: string[];
  remainingSlots: number;
  onClose: () => void;
  onImport: (rows: Omit<Team, "id" | "roster" | "supabaseId">[]) => Promise<void>;
}

const TEMPLATE_CSV =
  "name,code,tier,owner,color,pin\n" +
  "Ironspire Sentinels,IRS,Elite,House Marrow,#6b7280,4821\n" +
  "Thornwood Wardens,THW,Pro,Greenward Holdings,#2d5016,9013\n";

// Minimal CSV line parser — handles quoted fields containing commas, without
// pulling in a dependency for what is otherwise a flat 6-column format.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { fields.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

function parseCsv(text: string, existingCodes: string[]): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    name:  header.indexOf("name"),
    code:  header.indexOf("code"),
    tier:  header.indexOf("tier"),
    owner: header.indexOf("owner"),
    color: header.indexOf("color"),
    pin:   header.indexOf("pin"),
  };

  const seenCodes = new Set(existingCodes.map((c) => c.toUpperCase()));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const name  = idx.name  >= 0 ? (fields[idx.name]  ?? "") : "";
    const rawCode = idx.code  >= 0 ? (fields[idx.code]  ?? "") : "";
    const rawTier = idx.tier  >= 0 ? (fields[idx.tier]  ?? "") : "";
    const owner = idx.owner >= 0 ? (fields[idx.owner] ?? "") : "";
    const color = idx.color >= 0 ? (fields[idx.color] ?? "") : "";
    const rawPin  = idx.pin   >= 0 ? (fields[idx.pin]   ?? "") : "";

    const code = rawCode.toUpperCase().slice(0, 3);
    const pin  = rawPin.replace(/\D/g, "").slice(0, 6);

    const tierMatch = VALID_TIERS.find(
      (t) => t.toLowerCase() === rawTier.trim().toLowerCase()
    );

    let error: string | null = null;
    if (!name.trim())        error = "Missing franchise name.";
    else if (!rawCode.trim()) error = "Missing team code.";
    else if (rawCode.trim().length > 3) error = "Team code must be 3 characters or fewer.";
    else if (!owner.trim())  error = "Missing owner/organisation.";
    else if (!tierMatch)     error = `Invalid tier "${rawTier}" — must be Pro, Elite, or Legend.`;
    else if (seenCodes.has(code)) error = `Code "${code}" is already in use.`;
    else if (pin && pin.length < 4) error = "PIN must be at least 4 digits if provided.";

    if (!error) seenCodes.add(code);

    rows.push({
      line: i + 1,
      name: name.trim(),
      code,
      tier: (tierMatch ?? "Pro") as Team["tier"],
      owner: owner.trim(),
      color: color.trim() || "var(--color-theme-orange)",
      pin,
      error,
    });
  }

  return rows;
}

export default function BulkImportTeamsModal({ existingCodes, remainingSlots, onClose, onImport }: Props) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importError, setImportError] = useState("");

  const validRows = rows?.filter((r) => !r.error) ?? [];
  const invalidRows = rows?.filter((r) => r.error) ?? [];
  const overCapacity = validRows.length > remainingSlots;

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRaw(text);
      setRows(parseCsv(text, existingCodes));
    };
    reader.readAsText(file);
  }

  function handleParseClick() {
    setRows(parseCsv(raw, existingCodes));
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportError("");
    setProgress(0);

    const toImport = overCapacity ? validRows.slice(0, remainingSlots) : validRows;

    try {
      // Sequential, not Promise.all — keeps per-row failures isolated and
      // lets the progress counter reflect real completion order rather
      // than firing all inserts at once against upsertTeam.
      for (let i = 0; i < toImport.length; i++) {
        await onImport([{
          name:  toImport[i].name,
          code:  toImport[i].code,
          tier:  toImport[i].tier,
          owner: toImport[i].owner,
          color: toImport[i].color,
          logo:  "",
          pin:   toImport[i].pin,
        }]);
        setProgress(i + 1);
      }
      onClose();
    } catch (err: any) {
      setImportError(err?.message || "Import failed partway through — some franchises may have been created.");
    } finally {
      setImporting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9999 }}
      onClick={() => !importing && onClose()}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "var(--color-surface-container)", border: "1px solid var(--color-border-overlay)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div>
            <h3 style={{ fontFamily: "var(--font-headline-md)", fontSize: "22px", fontWeight: 700, color: "var(--color-on-surface)" }}>
              Bulk Import Franchises
            </h3>
            <p style={{ fontSize: "12px", color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
              Upload a CSV or paste rows below. Columns: name, code, tier, owner, color, pin.
            </p>
          </div>
          <button onClick={() => !importing && onClose()}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--color-surface-container-high)", color: "var(--color-on-surface-variant)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
        </div>

        <button onClick={downloadTemplate}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface-variant)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>download</span>
          Download CSV Template
        </button>

        <div className="flex flex-col gap-3">
          <label
            className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl cursor-pointer"
            style={{ border: "1px dashed var(--color-border-overlay)", background: "var(--color-surface-container-low)" }}>
            <span className="material-symbols-outlined text-2xl" style={{ color: "var(--color-theme-orange)" }}>upload_file</span>
            <span className="text-xs font-bold" style={{ color: "var(--color-on-surface-variant)", fontFamily: "var(--font-label-mono)" }}>
              Click to choose a .csv file
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </label>

          <p className="text-[10px] text-center" style={{ color: "var(--color-outline)" }}>— or paste CSV text —</p>

          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={TEMPLATE_CSV}
            rows={5}
            className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)" }}
          />

          <button onClick={handleParseClick} disabled={!raw.trim()}
            className="self-start px-4 py-2 rounded-lg text-xs font-bold"
            style={{
              background: raw.trim() ? "var(--color-theme-orange)" : "var(--color-surface-container-high)",
              color: raw.trim() ? "var(--color-on-primary)" : "var(--color-surface-variant)",
              cursor: raw.trim() ? "pointer" : "not-allowed",
            }}>
            Parse & Preview
          </button>
        </div>

        {rows && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-xs">
              <span style={{ color: "var(--color-success-green)" }}>{validRows.length} valid</span>
              {invalidRows.length > 0 && (
                <span style={{ color: "var(--color-error)" }}>{invalidRows.length} with errors</span>
              )}
              {overCapacity && (
                <span style={{ color: "var(--color-warning)" }}>
                  Only {remainingSlots} slot{remainingSlots === 1 ? "" : "s"} remain — first {remainingSlots} valid rows will be imported.
                </span>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: "var(--color-border-overlay)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--color-surface-container-low)" }}>
                    <th className="text-left px-2 py-1.5">Line</th>
                    <th className="text-left px-2 py-1.5">Name</th>
                    <th className="text-left px-2 py-1.5">Code</th>
                    <th className="text-left px-2 py-1.5">Tier</th>
                    <th className="text-left px-2 py-1.5">Owner</th>
                    <th className="text-left px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line} style={{ borderTop: "1px solid var(--color-border-overlay)" }}>
                      <td className="px-2 py-1.5" style={{ color: "var(--color-outline)" }}>{r.line}</td>
                      <td className="px-2 py-1.5" style={{ color: "var(--color-on-surface)" }}>{r.name || "—"}</td>
                      <td className="px-2 py-1.5 font-mono" style={{ color: "var(--color-on-surface)" }}>{r.code || "—"}</td>
                      <td className="px-2 py-1.5" style={{ color: "var(--color-on-surface)" }}>{r.tier}</td>
                      <td className="px-2 py-1.5" style={{ color: "var(--color-on-surface)" }}>{r.owner || "—"}</td>
                      <td className="px-2 py-1.5">
                        {r.error
                          ? <span style={{ color: "var(--color-error)" }}>{r.error}</span>
                          : <span style={{ color: "var(--color-success-green)" }}>OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importError && (
          <p className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "var(--color-error-container)", color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
            {importError}
          </p>
        )}

        {importing && (
          <p className="text-xs" style={{ color: "var(--color-theme-orange)" }}>
            Importing… {progress}/{overCapacity ? remainingSlots : validRows.length}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={() => !importing && onClose()} disabled={importing}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface-variant)" }}>
            Cancel
          </button>
          <button onClick={handleImport} disabled={!rows || validRows.length === 0 || importing}
            className="flex-1 py-2.5 rounded-xl text-sm font-black"
            style={{
              background: (!rows || validRows.length === 0 || importing) ? "var(--color-surface-container-high)" : "var(--color-theme-orange)",
              color: (!rows || validRows.length === 0 || importing) ? "var(--color-surface-variant)" : "var(--color-on-primary)",
              cursor: (!rows || validRows.length === 0 || importing) ? "not-allowed" : "pointer",
            }}>
            {importing ? "Importing…" : `Import ${validRows.length > 0 ? Math.min(validRows.length, remainingSlots) : ""} Franchise${validRows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}