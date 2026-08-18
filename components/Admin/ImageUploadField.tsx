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

  // ─────────────────────────────────────────────────────────────────────────
  // STYLE A
  // Direct context upload.
  //
  // Used when:
  //   context + contextId
  //
  // Upload goes directly to /api/uploads or the supplied onImageUpload handler.
  // ─────────────────────────────────────────────────────────────────────────
  context?: "auction" | "tournament" | "organization" | "award" | "match"
  contextId?: string
  subType?: string
  awardId?: string

  onImageUpload?: (
    formData: FormData
  ) => Promise<{
    success: boolean
    error?: string
    imageUrl?: string
    url?: string
  }>

  // ─────────────────────────────────────────────────────────────────────────
  // STYLE B
  // Kind-based upload through lib/uploadImage.ts.
  //
  // Used by:
  //   PlayerBankTab
  //   TeamPoolTab legacy callers
  //   Match editor
  // ─────────────────────────────────────────────────────────────────────────
  auctionId?: string
  matchId?: string
  kind?: UploadKind

  // ─────────────────────────────────────────────────────────────────────────
  // PRESENTATION
  // ─────────────────────────────────────────────────────────────────────────
  placeholder?: string
  description?: string
  previewClassName?: string
  allowManualUrl?: boolean
  allowDelete?: boolean
  onDelete?: () => void
  accentColor?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// URL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a value is safe to pass to next/image.
 *
 * Supports:
 *   /images/logo.png
 *   /uploads/logo.png
 *   https://example.com/logo.png
 *   http://example.com/logo.png
 *
 * Rejects:
 *   abc
 *   undefined
 *   null
 *   https//example.com/image.png
 *   example.com/image.png
 *   javascript:...
 */
function isValidImageSrc(src: string | undefined | null): boolean {
  if (!src) return false

  const value = src.trim()

  if (!value) return false

  // Local/public Next.js paths.
  if (value.startsWith("/")) {
    return true
  }

  try {
    const url = new URL(value)

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    )
  } catch {
    return false
  }
}

/**
 * Returns a safe value for display.
 *
 * We intentionally do NOT try to "repair" malformed URLs.
 * A malformed URL should be reported instead of silently changing
 * the value and potentially storing the wrong URL.
 */
function normalizeImageUrl(
  value: string | undefined | null
): string {
  return typeof value === "string" ? value.trim() : ""
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

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
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [imageBroken, setImageBroken] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────
  // DETERMINE UPLOAD MODE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Style A has priority whenever BOTH context and contextId are supplied.
   *
   * This preserves the original behavior.
   */
  const useDirectContext = Boolean(
    context && contextId
  )

  /**
   * Style B requires a kind.
   */
  const useKindUpload = Boolean(kind)

  /**
   * An upload UI should be available when either upload strategy is valid.
   */
  const canUpload =
    useDirectContext || useKindUpload

  /**
   * The URL used for preview.
   *
   * IMPORTANT:
   * We validate it before passing it to next/image.
   */
  const normalizedValue = normalizeImageUrl(value)

  const validImageSrc =
    isValidImageSrc(normalizedValue)

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLE FILE
  // ─────────────────────────────────────────────────────────────────────────

  async function handleFile(
    file: File | undefined | null
  ) {
    if (disabled || !file) return

    setError(null)
    setImageBroken(false)

    // ───────────────────────────────────────────────────────────────────────
    // BASIC FILE VALIDATION
    // ───────────────────────────────────────────────────────────────────────

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.")
      return
    }

    // Optional safety limit.
    // 10 MB is large enough for logos and player images while preventing
    // accidental huge uploads.
    const MAX_FILE_SIZE = 10 * 1024 * 1024

    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be smaller than 10 MB.")
      return
    }

    // ───────────────────────────────────────────────────────────────────────
    // STYLE A — DIRECT CONTEXT
    // ───────────────────────────────────────────────────────────────────────

    if (useDirectContext) {
      setUploading(true)

      try {
        const formData = new FormData()

        formData.append("file", file)
        formData.append("context", context!)
        formData.append("contextId", contextId!)
        formData.append("subType", subType)

        if (awardId) {
          formData.append("awardId", awardId)
        }

        // Tell the API which image this field currently owns.
        //
        // The API can delete this old image only after the new upload
        // succeeds.
        if (normalizedValue) {
          formData.append(
            "oldImageUrl",
            normalizedValue
          )
        }

        let result: {
          success?: boolean
          error?: string
          imageUrl?: string
          url?: string
        }

        // ───────────────────────────────────────────────────────────────────
        // Custom direct uploader
        // ───────────────────────────────────────────────────────────────────

        if (onImageUpload) {
          result = await onImageUpload(formData)
        } else {
          // ─────────────────────────────────────────────────────────────────
          // Default direct uploader
          // ─────────────────────────────────────────────────────────────────

          const response = await fetch(
            "/api/uploads",
            {
              method: "POST",
              body: formData,
            }
          )

          let responseData: {
            success?: boolean
            error?: string
            imageUrl?: string
            url?: string
          } = {}

          try {
            responseData =
              await response.json()
          } catch {
            throw new Error(
              `Upload failed (${response.status})`
            )
          }

          if (!response.ok) {
            throw new Error(
              responseData.error ||
                "Upload failed"
            )
          }

          result = responseData
        }

        // ───────────────────────────────────────────────────────────────────
        // Extract URL
        // ───────────────────────────────────────────────────────────────────

        const uploadedUrl =
          normalizeImageUrl(
            result.imageUrl ||
              result.url
          )

        if (!result.success && !uploadedUrl) {
          setError(
            result.error ||
              "Upload failed"
          )
          return
        }

        if (!uploadedUrl) {
          setError(
            "Upload succeeded but no image URL was returned."
          )
          return
        }

        // ───────────────────────────────────────────────────────────────────
        // IMPORTANT:
        //
        // Do not save malformed URLs into form state.
        // This is what prevents the original next/image crash.
        // ───────────────────────────────────────────────────────────────────

        if (!isValidImageSrc(uploadedUrl)) {
          setError(
            "Upload returned an invalid image URL."
          )
          return
        }

        onChange(uploadedUrl)
        setImageBroken(false)
      } catch (e: unknown) {
        const message =
          e instanceof Error
            ? e.message
            : "Upload failed"

        setError(message)
      } finally {
        setUploading(false)

        // Allow selecting the exact same file again.
        if (inputRef.current) {
          inputRef.current.value = ""
        }
      }

      return
    }

    // ───────────────────────────────────────────────────────────────────────
    // STYLE B — KIND BASED UPLOAD
    // ───────────────────────────────────────────────────────────────────────

    if (!kind) {
      setError(
        "ImageUploadField: missing `kind`."
      )
      return
    }

    /**
     * Team/player/logo uploads use auctionId.
     * Match-related uploads use matchId.
     *
     * Keeping the fallback preserves the original component API.
     */
    const effectiveId =
      auctionId ?? matchId

    if (!effectiveId) {
      setError(
        kind === "team" ||
        kind === "player" ||
        kind === "logo"
          ? "Auction not ready yet — try again in a moment."
          : "Not ready to upload yet — try again in a moment."
      )
      return
    }

    setUploading(true)

    try {
      // ─────────────────────────────────────────────────────────────────────
      // Preserve the existing uploadAuctionImage API.
      // ─────────────────────────────────────────────────────────────────────

      const options = {
        ...(awardId
          ? { awardId }
          : {}),
        ...(normalizedValue
          ? {
              oldImageUrl:
                normalizedValue,
            }
          : {}),
      }

      const result =
        await uploadAuctionImage(
          effectiveId,
          kind,
          file,
          options
        )

      const uploadedUrl =
        normalizeImageUrl(
          result?.url
        )

      if (!uploadedUrl) {
        throw new Error(
          "Upload succeeded but no image URL was returned."
        )
      }

      // ─────────────────────────────────────────────────────────────────────
      // Validate before storing it.
      // ─────────────────────────────────────────────────────────────────────

      if (!isValidImageSrc(uploadedUrl)) {
        throw new Error(
          "Upload returned an invalid image URL."
        )
      }

      onChange(uploadedUrl)
      setImageBroken(false)
      setError(null)
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Upload failed"

      setError(message)
    } finally {
      setUploading(false)

      // Allow selecting the same file again.
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DRAG & DROP
  // ─────────────────────────────────────────────────────────────────────────

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>
  ) {
    e.preventDefault()
    setDragOver(false)

    if (disabled || uploading) {
      return
    }

    const file =
      e.dataTransfer.files?.[0]

    void handleFile(file)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────────────

  async function handleDeleteClick() {
    if (
      !normalizedValue ||
      deleting ||
      disabled
    ) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const response =
        await fetch(
          "/api/uploads",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              imageUrl:
                normalizedValue,
            }),
          }
        )

      let result: {
        success?: boolean
        error?: string
      } = {}

      try {
        result = await response.json()
      } catch {
        // DELETE endpoints don't always return JSON.
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Delete failed"
        )
      }

      onChange("")
      setImageBroken(false)
      setError(null)

      onDelete?.()
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Failed to delete image"

      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MANUAL URL
  // ─────────────────────────────────────────────────────────────────────────

  function handleManualUrlChange(
    nextValue: string
  ) {
    onChange(nextValue)
    setImageBroken(false)

    const trimmed =
      nextValue.trim()

    if (!trimmed) {
      setError(null)
      return
    }

    if (!isValidImageSrc(trimmed)) {
      setError(
        "Enter a valid image URL, such as https://example.com/image.png"
      )
      return
    }

    setError(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* LABEL */}
      <label className="text-gray-400 text-sm block font-medium">
        {label}
      </label>

      <div className="flex gap-3 items-start">
        {/* ───────────────────────────────────────────────────────────────────
            LEFT SIDE
        ─────────────────────────────────────────────────────────────────── */}

        <div className="flex-1 space-y-2">
          {/* MANUAL URL INPUT */}
          {allowManualUrl && (
            <input
              value={value}
              onChange={(e) =>
                handleManualUrlChange(
                  e.target.value
                )
              }
              disabled={disabled}
              placeholder={placeholder}
              className="w-full bg-black/50 border border-gold/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-gold/60 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}

          {/* UPLOAD AREA */}
          {canUpload && (
            <div
              onDragOver={(e) => {
                if (
                  !disabled &&
                  !uploading
                ) {
                  e.preventDefault()
                  setDragOver(true)
                }
              }}
              onDragLeave={() =>
                setDragOver(false)
              }
              onDrop={handleDrop}
              onClick={() => {
                if (
                  !uploading &&
                  !disabled
                ) {
                  inputRef.current?.click()
                }
              }}
              className="border-2 border-dashed rounded-lg p-4 text-center transition-colors bg-black/30"
              style={{
                borderColor: dragOver
                  ? accentColor
                  : "rgba(245,166,35,0.3)",

                opacity:
                  disabled ? 0.5 : 1,

                cursor:
                  disabled ||
                  uploading
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                className="hidden"
                disabled={
                  disabled ||
                  uploading
                }
                onChange={(e) => {
                  const file =
                    e.target.files?.[0]

                  void handleFile(file)
                }}
              />

              <div className="flex flex-col items-center gap-2">
                {uploading ? (
                  <>
                    <Loader2
                      className="h-5 w-5 animate-spin"
                      style={{
                        color:
                          accentColor,
                      }}
                    />

                    <span
                      className="text-xs"
                      style={{
                        color:
                          accentColor,
                      }}
                    >
                      Uploading…
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-gold/60" />

                    <span className="text-xs text-gray-400">
                      Drag & drop or click to upload
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────────────
            PREVIEW
        ─────────────────────────────────────────────────────────────────── */}

        <div
          className={`shrink-0 rounded-md border border-gold/20 bg-black/60 flex items-center justify-center overflow-hidden ${previewClassName}`}
        >
          {validImageSrc &&
          !imageBroken ? (
            <Image
              src={normalizedValue}
              alt=""
              className="w-full h-full object-cover"
              onError={() =>
                setImageBroken(true)
              }
              width={52}
              height={52}
              unoptimized
            />
          ) : (
            <ImageOff className="h-4 w-4 text-gray-600" />
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────────────
            DELETE BUTTON
        ─────────────────────────────────────────────────────────────────── */}

        {allowDelete &&
          normalizedValue && (
            <button
              type="button"
              onClick={
                handleDeleteClick
              }
              disabled={
                deleting ||
                disabled
              }
              className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/20 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete image"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          )}
      </div>

      {/* DESCRIPTION */}
      {description && (
        <p className="text-gray-500 text-xs">
          {description}
        </p>
      )}

      {/* INVALID URL / UPLOAD ERROR */}
      {error && (
        <p className="text-red-400 text-xs">
          {error}
        </p>
      )}
    </div>
  )
}