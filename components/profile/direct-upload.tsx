"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { v4 as uuidv4 } from "uuid"
import { useSession } from "next-auth/react"

interface DirectUploadProps {
  onSuccess: (url: string) => void
  buttonText?: string
  className?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  isIconOnly?: boolean
  iconClassName?: string
  updateProfile?: (url: string) => Promise<void>
  fileType: "avatar" | "banner"
}

export default function DirectUpload({
  onSuccess,
  buttonText = "Upload Image",
  className = "",
  variant = "outline",
  size = "default",
  isIconOnly = false,
  iconClassName = "",
  updateProfile,
  fileType,
}: DirectUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: session } = useSession()

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
      // Check file type
      if (!file.type.startsWith("image/")) {
        throw new Error("File must be an image")
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("File size must be less than 5MB")
      }

      // Generate a unique filename
      const fileExt = file.name.split(".").pop()
      const fileName = `${fileType}-${session?.user?.id || "user"}-${uuidv4()}.${fileExt}`

      console.log("Uploading file:", {
        fileName,
        fileType: file.type,
        fileSize: file.size,
      })

      console.log("Upload requested:", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      })

      setError("File upload is not available at this time.")
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
