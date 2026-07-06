"use client";
import React, { useRef, useState } from "react";

export function ImageUploader({
  auctionId,
  kind,
  value,
  onChange,
}: {
  auctionId: string;
  kind: "team" | "player";
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
          />
        )}
        <input
          className="text-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload"
        />
        <button
          type="button"
          className="fx-btn fx-toggle-off"
          style={{ flexShrink: 0 }}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "…" : "Upload"}
        </button>
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
      </div>
      {error && <span className="font-mono-geist text-[9px] text-red-400">{error}</span>}
    </div>
  );
}