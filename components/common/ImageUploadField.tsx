"use client"

import { useState } from "react"
import { Upload, Loader2, ImageOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ImageUploadFieldProps {
  label: string
  value: string
  onChange: (url: string) => void
  onImageUpload?: (formData: FormData) => Promise<{ success: boolean; error?: string; imageUrl?: string }>
  placeholder?: string
  description?: string
  previewClassName?: string
  context?: "tournament" | "organization" | "award" | "match" | "auction"
  contextId?: string
  subType?: string // "banner", "logo", "team-images", "player-images", etc.
  awardId?: string // For award context
  allowManualUrl?: boolean
  allowDelete?: boolean
  onDelete?: () => void
}

export default function ImageUploadField({
  label,
  value,
  onChange,
  onImageUpload,
  placeholder = "https://…",
  description = "Upload or paste an image URL",
  previewClassName = "w-20 h-12",
  context,
  contextId,
  subType = "default",
  awardId,
  allowManualUrl = true,
  allowDelete = false,
  onDelete,
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageBroken, setImageBroken] = useState(false)

  const handleUpload = async (file: File) => {
    if (!context || !contextId) {
      setError("Upload context not configured")
      return
    }

    setIsUploading(true)
    setError(null)
    setImageBroken(false)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("context", context)
      formData.append("contextId", contextId)
      formData.append("subType", subType)
      if (awardId) {
        formData.append("awardId", awardId)
      }

      // Use provided handler or default API
      let result: any
      if (onImageUpload) {
        result = await onImageUpload(formData)
      } else {
        const response = await fetch("/api/uploads", { method: "POST", body: formData })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Upload failed")
        }
        result = await response.json()
      }

      if (!result.success && !result.imageUrl) {
        setError(result.error || "Upload failed")
      } else {
        const imageUrl = result.imageUrl || result.url
        onChange(imageUrl)
      }
    } catch (err: any) {
      console.error("[v0] Upload error:", err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
    // Reset input
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) {
      handleUpload(file)
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-gray-400 text-sm block font-medium">{label}</label>

      <div className="flex gap-3 items-start">
        <div className="flex-1 space-y-2">
          {allowManualUrl && (
            <Input
              value={value}
              onChange={(e) => {
                onChange(e.target.value)
                setImageBroken(false)
              }}
              placeholder={placeholder}
              className="bg-black/50 border-gold/30 text-white"
            />
          )}

          {context && contextId && (
            <div
              className="border-2 border-dashed border-gold/30 rounded-lg p-4 text-center cursor-pointer hover:border-gold/50 transition-colors bg-black/30"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                type="file"
                id={`image-upload-${label}`}
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
                disabled={isUploading}
              />
              <label
                htmlFor={`image-upload-${label}`}
                className="flex flex-col items-center gap-2 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-5 w-5 text-gold animate-spin" />
                    <span className="text-xs text-gold">Uploading…</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-gold/60" />
                    <span className="text-xs text-gray-400">
                      Drag & drop or click to upload
                    </span>
                  </>
                )}
              </label>
            </div>
          )}
        </div>

        <div
          className={`shrink-0 rounded-md border border-gold/20 bg-black/60 flex items-center justify-center overflow-hidden ${previewClassName}`}
        >
          {value && !imageBroken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImageBroken(true)}
            />
          ) : (
            <ImageOff className="h-4 w-4 text-gray-600" />
          )}
        </div>

        {allowDelete && value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {description && (
        <p className="text-gray-500 text-xs">{description}</p>
      )}

      {error && (
        <Alert variant="destructive" className="bg-red-900/20 border-red-900 text-red-300">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
