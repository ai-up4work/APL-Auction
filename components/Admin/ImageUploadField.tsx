// components/Admin/ImageUploadField.tsx
"use client"

import { useRef, useState } from "react"
import { Upload, Loader2, ImageOff, Trash2 } from "lucide-react"
import { uploadAuctionImage, type UploadKind } from "@/lib/uploadImage"
import Image from "next/image"

interface ImageUploadFieldProps {
  label?: string
  value: string
  onChange: (url: string) => void
  disabled?: boolean

  // ── Style A: direct context upload (used by TeamPoolTab) ──
  // When context + contextId are both present, the upload goes straight
  // to /api/uploads with these fields — no dependency on lib/uploadImage.ts.
  context?: "auction" | "tournament" | "organization" | "award" | "match"
  contextId?: string
  subType?: string
  awardId?: string
  onImageUpload?: (formData: FormData) => Promise<{ success: boolean; error?: string; imageUrl?: string }>

  // ── Style B: kind-based upload via lib/uploadImage.ts (used by
  // PlayerBankTab, TeamPoolTab-legacy callers, and the match editor) ──
  auctionId?: string // required when kind is "team" | "player" | "logo"
  matchId?: string   // used instead of auctionId for non-legacy kinds
  kind?: UploadKind  // "team" | "player" | "logo" | "tournament" | "organization" | "match" | "award"

  // Shared presentation props
  placeholder?: string
  description?: string
  previewClassName?: string
  allowManualUrl?: boolean
  allowDelete?: boolean
  onDelete?: () => void
  accentColor?: string
}

export default function ImageUploadField({
  label = "Image",
  value,
  onChange,
  disabled = false,

  context,
  contextId,
  subType = "default",
  awardId,
  onImageUpload,

  auctionId,
  matchId,
  kind,

  placeholder = "https://…",
  description = "Upload or paste an image URL",
  previewClassName = "w-20 h-12",
  allowManualUrl = true,
  allowDelete = false,
  onDelete,
  accentColor = "var(--color-theme-orange)",
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [imageBroken, setImageBroken] = useState(false)

  // Which upload path to use: Style A (direct context) takes priority
  // whenever both context + contextId are supplied; otherwise fall back
  // to Style B (kind-based, via uploadAuctionImage).
  const useDirectContext = !!(context && contextId)

  async function handleFile(file: File | undefined | null) {
    if (disabled || !file) return
    setError(null)
    setImageBroken(false)

    if (useDirectContext) {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("context", context!)
        formData.append("contextId", contextId!)
        formData.append("subType", subType)
        if (awardId) formData.append("awardId", awardId)

        let result: any
        if (onImageUpload) {
          result = await onImageUpload(formData)
        } else {
          const res = await fetch("/api/uploads", { method: "POST", body: formData })
          if (!res.ok) {
            const errData = await res.json()
            throw new Error(errData.error || "Upload failed")
          }
          result = await res.json()
        }

        if (!result.success && !result.imageUrl) {
          setError(result.error || "Upload failed")
        } else {
          onChange(result.imageUrl || result.url)
        }
      } catch (e: any) {
        setError(e?.message ?? "Upload failed")
      } finally {
        setUploading(false)
      }
      return
    }

    // Style B — kind-based path
    if (!kind) {
      setError("ImageUploadField: missing `kind` (and no context/contextId provided)")
      return
    }
    const effectiveId = auctionId ?? matchId
    if (!effectiveId) {
      setError(
        kind === "team" || kind === "player" || kind === "logo"
          ? "Auction not ready yet — try again in a moment."
          : "Not ready to upload yet — try again in a moment."
      )
      return
    }

    setUploading(true)
    try {
      const { url } = await uploadAuctionImage(effectiveId, kind, file, awardId ? { awardId } : undefined)
      onChange(url)
    } catch (e: any) {
      setError(e?.message ?? "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (!disabled) handleFile(e.dataTransfer.files?.[0])
  }

  const canUpload = useDirectContext || !!kind

  return (
    <div className="space-y-2">
      <label className="text-gray-400 text-sm block font-medium">{label}</label>

      <div className="flex gap-3 items-start">
        <div className="flex-1 space-y-2">
          {allowManualUrl && (
            <input
              value={value}
              onChange={(e) => {
                onChange(e.target.value)
                setImageBroken(false)
              }}
              placeholder={placeholder}
              className="w-full bg-black/50 border border-gold/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-gold/60"
            />
          )}

          {canUpload && (
            <div
              onDragOver={(e) => { if (!disabled) { e.preventDefault(); setDragOver(true) } }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && !disabled && inputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors bg-black/30"
              style={{
                borderColor: dragOver ? accentColor : "rgba(245,166,35,0.3)",
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
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
              <div className="flex flex-col items-center gap-2">
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: accentColor }} />
                    <span className="text-xs" style={{ color: accentColor }}>Uploading…</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-gold/60" />
                    <span className="text-xs text-gray-400">Drag & drop or click to upload</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          className={`shrink-0 rounded-md border border-gold/20 bg-black/60 flex items-center justify-center overflow-hidden ${previewClassName}`}
        >
          {value && !imageBroken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <Image src={value} alt="" className="w-full h-full object-cover" onError={() => setImageBroken(true)} width={52} height={52} />
          ) : (
            <ImageOff className="h-4 w-4 text-gray-600" />
          )}
        </div>

        {allowDelete && value && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/20 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {description && <p className="text-gray-500 text-xs">{description}</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}