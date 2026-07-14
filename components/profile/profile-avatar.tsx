"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import DirectUpload from "./direct-upload"
import { useProfileUpdater } from "./update-profile"

interface ProfileAvatarProps {
  imageUrl?: string | null
  username: string
  isOwnProfile?: boolean
}

export default function ProfileAvatar({ imageUrl, username, isOwnProfile = false }: ProfileAvatarProps) {
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl)
  const [error, setError] = useState<string | null>(null)
  const { updateProfileImage, isUpdating, error: updateError } = useProfileUpdater()

  const initials = username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)

  const handleAvatarUploadSuccess = (url: string) => {
    setCurrentImageUrl(url)
    // Force refresh after a short delay to ensure the database update is complete
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  const handleUpdateProfile = async (url: string) => {
    const success = await updateProfileImage(url)
    if (!success && updateError) {
      setError(updateError)
    }
    return success
  }

  return (
    <div className="relative">
      <Avatar className="h-24 w-24 border-4 border-background">
        <AvatarImage src={currentImageUrl || undefined} alt={username} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      {isOwnProfile && (
        <div className="absolute -bottom-2 -right-2">
          <DirectUpload
            onSuccess={handleAvatarUploadSuccess}
            isIconOnly={true}
            className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 p-1"
            iconClassName="h-full w-full"
            size="icon"
            updateProfile={handleUpdateProfile}
            fileType="avatar"
          />
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="absolute top-full mt-2 w-48 bg-red-900/90 border-red-900 text-white">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
