"use client";

import React, { useRef, useState } from "react";
import { FieldLabel, IconBtn } from "./ui";

export function ImageUploader({
  auctionId,
  kind,
  value,
  onChange,
  label,
  compact,
}: {
  auctionId: string;
  kind: "team" | "player";
  value: string;
  onChange: (url: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("auctionId", auctionId);
      fd.append("kind", kind);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const size = compact ? 34 : 44;

  return (
    <div className="flex flex-col gap-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="flex items-center gap-2.5">
        <div
          className="relative rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{
            width: size,
            height: size,
            background: "var(--color-surface-container-low)",
            border: "1px solid var(--color-border-overlay)",
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: compact ? 16 : 18, color: "var(--color-outline)" }}>
              image
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
          style={{
            fontFamily: "var(--font-label-mono)",
            background: hovered ? "rgba(201,151,31,0.1)" : "var(--color-surface-container-low)",
            border: "1px solid var(--color-border-overlay)",
            color: hovered ? "var(--color-theme-orange)" : "var(--color-on-surface-variant)",
            cursor: uploading ? "wait" : "pointer",
          }}
        >
          <span className={`material-symbols-outlined ${uploading ? "animate-spin" : ""}`} style={{ fontSize: 14 }}>
            {uploading ? "progress_activity" : "upload"}
          </span>
          {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>

        {value && !uploading && <IconBtn icon="close" title="Remove image" danger onClick={() => onChange("")} />}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {error && (
        <span className="text-[10px]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-error)" }}>
          {error}
        </span>
      )}
    </div>
  );
}