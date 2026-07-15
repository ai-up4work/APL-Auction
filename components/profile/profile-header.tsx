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

// Matches the shape ImageUpload's onUpload prop expects exactly:
// success: boolean, error?: string, imageUrl?: string (no null).
interface UploadResult {
  success: boolean
  error?: string
  imageUrl?: string
}

// Simulates a network round-trip so loading states in ImageUpload are
// actually visible during dev, instead of resolving instantly.
function simulateUploadDelay(ms = 900) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Reads the file as a data URL instead of URL.createObjectURL, so the
// "uploaded" image survives a page refresh (blob: URLs get revoked and
// go blank on reload since nothing is actually persisted to a server yet).
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

// Mocked upload actions — swap these out for the real server actions
// (uploadProfileImage, uploadProfileBanner) once they're wired back up.
async function mockUploadProfileImage(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file") as File | null

  if (!file) {
    return { success: false, error: "No file selected" }
  }

  try {
    await simulateUploadDelay()
    const imageUrl = await readFileAsDataUrl(file)
    return { success: true, imageUrl }
  } catch (err) {
    console.error("Mock profile image upload error:", err)
    return { success: false, error: "Failed to upload image" }
  }
}

async function mockUploadProfileBanner(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file") as File | null

  if (!file) {
    return { success: false, error: "No file selected" }
  }

  try {
    await simulateUploadDelay()
    const imageUrl = await readFileAsDataUrl(file)
    return { success: true, imageUrl }
  } catch (err) {
    console.error("Mock profile banner upload error:", err)
    return { success: false, error: "Failed to upload banner" }
  }
}

export default function ProfileHeader({ profile, isOwnProfile, onRefresh }: ProfileHeaderProps) {
  const [profileImage, setProfileImage] = useState<string | null>(profile.profileImage)
  const [profileBanner, setProfileBanner] = useState<string | null>(profile.profileBanner)

  const handleProfileImageUpload = async (formData: FormData) => {
    // const result = await uploadProfileImage(formData)
    const result = await mockUploadProfileImage(formData)
    if (result.success && result.imageUrl) {
      setProfileImage(result.imageUrl)
      if (onRefresh) await onRefresh()
    }
    return result
  }

  const handleBannerUpload = async (formData: FormData) => {
    // const result = await uploadProfileBanner(formData)
    const result = await mockUploadProfileBanner(formData)
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