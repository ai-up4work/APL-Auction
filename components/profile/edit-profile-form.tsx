"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateProfile } from "@/lib/profile"
import type { Profile } from "@/types/user"

interface EditProfileFormProps {
  profile: Profile
  userId: string
  onUpdated?: (profile: Profile) => void
}

export default function EditProfileForm({ profile, userId, onUpdated }: EditProfileFormProps) {
  const [formData, setFormData] = useState({
    username: profile.username || "",
    displayName: profile.displayName || "",
    bio: profile.bio || "",
    profileImage: profile.profileImage || "",
    profileBanner: profile.profileBanner || "",
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const updated = await updateProfile(userId, {
        username: formData.username,
        displayName: formData.displayName,
        bio: formData.bio,
        profileImage: formData.profileImage,
        profileBanner: formData.profileBanner,
      })

      if (!updated) {
        throw new Error("Failed to update profile")
      }

      setSuccess("Profile updated successfully")
      onUpdated?.(updated)
    } catch (err: any) {
      console.error("Profile update error:", err)
      setError(err.message || "Failed to update profile")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive" className="bg-red-900/20 border-red-900 text-red-300">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-900/20 border-green-900 text-green-300">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="username" className="font-cinzel text-xs uppercase tracking-wide text-gray-400">
          Username
        </Label>
        <Input
          id="username"
          name="username"
          value={formData.username}
          onChange={handleChange}
          required
          className="bg-black/50 border-gold/30 text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName" className="font-cinzel text-xs uppercase tracking-wide text-gray-400">
          Display Name
        </Label>
        <Input
          id="displayName"
          name="displayName"
          value={formData.displayName}
          onChange={handleChange}
          required
          className="bg-black/50 border-gold/30 text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio" className="font-cinzel text-xs uppercase tracking-wide text-gray-400">
          Bio
        </Label>
        <Textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          rows={5}
          className="bg-black/50 border-gold/30 text-white"
          placeholder="Tell us about yourself..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profileImage" className="font-cinzel text-xs uppercase tracking-wide text-gray-400">
          Profile Image URL
        </Label>
        <Input
          id="profileImage"
          name="profileImage"
          value={formData.profileImage}
          onChange={handleChange}
          placeholder="https://example.com/avatar.png"
          className="bg-black/50 border-gold/30 text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profileBanner" className="font-cinzel text-xs uppercase tracking-wide text-gray-400">
          Profile Banner URL
        </Label>
        <Input
          id="profileBanner"
          name="profileBanner"
          value={formData.profileBanner}
          onChange={handleChange}
          placeholder="https://example.com/banner.png"
          className="bg-black/50 border-gold/30 text-white"
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-gold hover:bg-gold/90 text-black font-bold font-cinzel"
        disabled={isLoading}
      >
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  )
}