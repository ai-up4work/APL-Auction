"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Shield, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import ImageUpload from "@/components/profile/image-upload"
// import { uploadProfileImage, uploadProfileBanner } from "@/app/actions/upload-actions"
import type { Profile } from "@/types/user"

interface ProfileHeaderProps {
  profile: Profile
  isOwnProfile: boolean
  onRefresh?: () => Promise<void>
}

// Mocked upload actions — swap these out for the real server actions
// (uploadProfileImage, uploadProfileBanner) once they're wired back up.
function mockUploadProfileImage(formData: FormData) {
  const file = formData.get("file") as File | null
  const imageUrl = file ? URL.createObjectURL(file) : null
  return { success: true, imageUrl }
}

function mockUploadProfileBanner(formData: FormData) {
  const file = formData.get("file") as File | null
  const imageUrl = file ? URL.createObjectURL(file) : null
  return { success: true, imageUrl }
}

export default function ProfileHeader({ profile, isOwnProfile, onRefresh }: ProfileHeaderProps) {
  const [profileImage, setProfileImage] = useState<string | null>(profile.profileImage)
  const [profileBanner, setProfileBanner] = useState<string | null>(profile.profileBanner)

  const handleProfileImageUpload = async (formData: FormData) => {
    // const result = await uploadProfileImage(formData)
    const result = mockUploadProfileImage(formData)
    if (result.success && result.imageUrl) {
      setProfileImage(result.imageUrl)
      if (onRefresh) await onRefresh()
    }
    return result
  }

  const handleBannerUpload = async (formData: FormData) => {
    // const result = await uploadProfileBanner(formData)
    const result = mockUploadProfileBanner(formData)
    if (result.success && result.imageUrl) {
      setProfileBanner(result.imageUrl)
      if (onRefresh) await onRefresh()
    }
    return result
  }

  return (
    <div className="relative">
      {/* Banner Image */}
      <div className="relative h-48 md:h-64 w-full rounded-t-lg overflow-hidden">
        {profileBanner ? (
          <Image
            src={profileBanner || "/placeholder.svg"}
            alt={`${profile.displayName}'s banner`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-wardens-gold/20 to-wardens-gold/5"></div>
        )}

        {isOwnProfile && (
          <div className="absolute top-4 right-4">
            <ImageUpload
              onUpload={handleBannerUpload}
              buttonText="Change Banner"
              className="bg-black/50 border-wardens-gold/50 text-white hover:bg-black/70"
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Profile Image and Info */}
      <div className="relative px-6 pb-6 bg-black/50 border-b border-wardens-gold/20">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-end -mt-16 md:-mt-20">
          <div className="relative">
            <div className="h-32 w-32 md:h-40 md:w-40 rounded-full overflow-hidden border-4 border-black bg-black/50">
              {profileImage ? (
                <Image
                  src={profileImage || "/placeholder.svg"}
                  alt={profile.displayName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-wardens-gold/10">
                  <Shield className="h-16 w-16 text-wardens-gold/50" />
                </div>
              )}
            </div>

            {isOwnProfile && (
              <div className="absolute bottom-0 right-0">
                <ImageUpload
                  onUpload={handleProfileImageUpload}
                  className="bg-black/50 border-wardens-gold/50 text-white hover:bg-black/70 rounded-full h-10 w-10 p-0"
                  size="icon"
                  isIconOnly={true}
                />
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white font-cinzel">{profile.displayName}</h1>
          </div>

          {isOwnProfile && (
            <div className="md:ml-auto mt-4 md:mt-0">
              <Link href="/profile/edit">
                <Button className="bg-wardens-gold hover:bg-wardens-gold/90 text-black">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}