"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ImageUploadProps {
  onUpload: (formData: FormData) => Promise<{ success: boolean; error?: string; imageUrl?: string }>
  buttonText?: string
  className?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  isIconOnly?: boolean
  iconClassName?: string
}

export default function ImageUpload({
  onUpload,
  buttonText = "Upload Image",
  className = "",
  variant = "outline",
  size = "default",
  isIconOnly = false,
  iconClassName = "",
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append("file", file)

      console.log("Selected file:", file.name, file.type, file.size)

      const result = await onUpload(formData)
      console.log("Upload result:", result)

      if (!result.success) {
        setError(result.error || "Upload failed")
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000) // Clear success message after 3 seconds
      }
    } catch (err: any) {
      console.error("Upload error:", err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setIsUploading(false)
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isUploading}
        className={className}
      >
        {isUploading ? (
          <Loader2 className={`h-4 w-4 animate-spin ${!isIconOnly ? "mr-2" : ""}`} />
        ) : (
          <Upload className={`h-4 w-4 ${!isIconOnly ? "mr-2" : ""} ${iconClassName}`} />
        )}
        {!isIconOnly && (isUploading ? "Uploading..." : buttonText)}
      </Button>

      {error && (
        <Alert variant="destructive" className="mt-2 bg-red-900/20 border-red-900 text-red-300">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mt-2 bg-green-900/20 border-green-900 text-green-300">
          <AlertDescription>Upload successful!</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
