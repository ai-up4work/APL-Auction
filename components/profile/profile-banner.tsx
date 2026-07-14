"use client"

import { useState } from "react"
import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import DirectUpload from "./direct-upload"
import { useProfileUpdater } from "./update-profile"

interface ProfileBannerProps {
  bannerUrl?: string | null
  isOwnProfile?: boolean
}

export default function ProfileBanner({ bannerUrl, isOwnProfile = false }: ProfileBannerProps) {
  const [currentBannerUrl, setCurrentBannerUrl] = useState(bannerUrl)
  const [error, setError] = useState<string | null>(null)
  const { updateProfileBanner, isUpdating, error: updateError } = useProfileUpdater()

  const handleBannerUploadSuccess = (url: string) => {
    setCurrentBannerUrl(url)
    // Force refresh after a short delay to ensure the database update is complete
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  const handleUpdateProfile = async (url: string) => {
    const success = await updateProfileBanner(url)
    if (!success && updateError) {
      setError(updateError)
    }
    return success
  }

  return (
    <div className="relative w-full h-48 md:h-64 lg:h-80 overflow-hidden bg-gradient-to-r from-gray-900 to-gray-800">
      {currentBannerUrl ? (
        <img src={currentBannerUrl || "/placeholder.svg"} alt="Profile Banner" className="w-full h-full object-cover" />
      ) : null}

      <div className="absolute bottom-4 right-4 flex gap-2">
        <Button variant="ghost" size="icon" className="bg-black/50 hover:bg-black/70 text-white">
          <Share2 className="h-4 w-4" />
        </Button>

        {isOwnProfile && (
          <DirectUpload
            onSuccess={handleBannerUploadSuccess}
            buttonText="Change Banner"
            className="bg-black/50 hover:bg-black/70 text-white"
            isIconOnly={false}
            updateProfile={handleUpdateProfile}
            fileType="banner"
          />
        )}
      </div>

      {error && (
        <Alert
          variant="destructive"
          className="absolute bottom-16 right-4 left-4 md:left-auto md:w-80 bg-red-900/90 border-red-900 text-white"
        >
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
