"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
// import { updateProfileData } from "@/app/actions/profile-actions"
import type { Profile } from "@/types/user"

interface EditProfileFormProps {
  profile: Profile
  userId: string
}

// Mocked profile updater — swap this out for the real server action
// (updateProfileData) once it's wired back up.
function mockUpdateProfileData(_input: {
  userId: string
  displayName: string
  bio: string
}) {
  return { success: true }
}

export default function EditProfileForm({ profile, userId }: EditProfileFormProps) {
  const [formData, setFormData] = useState({
    displayName: profile.displayName || "",
    bio: profile.bio || "",
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
      // const result = await updateProfileData({
      //   userId,
      //   displayName: formData.displayName,
      //   bio: formData.bio,
      // })
      const result = mockUpdateProfileData({
        userId,
        displayName: formData.displayName,
        bio: formData.bio,
      })

      if (!result.success) {
        throw new Error(result.error || "Failed to update profile")
      }

      setSuccess("Profile updated successfully")
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
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          name="displayName"
          value={formData.displayName}
          onChange={handleChange}
          required
          className="bg-black/50 border-wardens-gold/30 text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          rows={5}
          className="bg-black/50 border-wardens-gold/30 text-white"
          placeholder="Tell us about yourself..."
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-wardens-gold hover:bg-wardens-gold/90 text-black font-bold"
        disabled={isLoading}
      >
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  )
}