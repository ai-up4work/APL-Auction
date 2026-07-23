// components/ImageUploadField.tsx
"use client";

import { useRef, useState } from "react";
import { uploadAuctionImage, type UploadKind } from "@/lib/uploadImage";

interface ImageUploadFieldProps {
  auctionId: string;
  kind:      UploadKind; // "team" | "player" | "logo"
  value:     string;     // current image URL (empty string if none)
  onChange:  (url: string) => void;
  label?:    string;
  disabled?: boolean;    // optional — existing callers that don't pass it keep working unchanged
  // Accent color for the upload affordance — pass the team color, or
  // omit to use the theme orange default.
  accentColor?: string;
}

export default function ImageUploadField({
  auctionId,
  kind,
  value,
  onChange,
  label = "Image",
  disabled = false,
  accentColor = "var(--color-theme-orange)",
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [dragOver,  setDragOver]  = useState(false);

  async function handleFile(file: File | undefined | null) {
    if (disabled || !file) return;
    setError(null);

    if (!auctionId) {
      setError("Auction not ready yet — try again in a moment.");
      return;
    }

    setUploading(true);
    try {
      const { url } = await uploadAuctionImage(auctionId, kind, file);
      onChange(url);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label
        className="block text-[9px] font-bold uppercase tracking-widest mb-1.5"
        style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}
      >
        {label}
      </label>

      <div
        onDragOver={(e) => { if (!disabled) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !uploading && !disabled && inputRef.current?.click()}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
        style={{
          background: dragOver ? `${accentColor}11` : "var(--color-surface-container-low)",
          border: `1px dashed ${dragOver ? accentColor : "var(--color-border-overlay)"}`,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {/* Preview / placeholder */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
          style={{ background: "var(--color-surface-bright)", border: "1px solid var(--color-outline-variant)" }}
        >
          {uploading ? (
            <span className="material-symbols-outlined animate-spin text-base" style={{ color: accentColor }}>
              progress_activity
            </span>
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-12 h-12 object-cover" />
          ) : (
            <span className="material-symbols-outlined text-base" style={{ color: "var(--color-surface-variant)" }}>
              {(() => {
                // map upload kind to icon name
                switch (kind) {
                  case "team":
                    return "shield";
                  case "logo":
                    return "workspace_premium";
                  default:
                    return "person";
                }
              })()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
            {uploading ? "Uploading…" : value ? "Replace image" : "Click or drop an image"}
          </p>
          <p className="text-[10px]" style={{ color: "var(--color-outline)" }}>
            PNG, JPG, WEBP or GIF · max 5MB
          </p>
        </div>

        {value && !uploading && !disabled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="p-1.5 rounded-md shrink-0"
            style={{ background: "var(--color-surface-container)", color: "var(--color-on-surface-variant)" }}
            title="Remove image"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-[10px]" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}