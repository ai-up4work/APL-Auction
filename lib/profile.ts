// lib/profile.ts
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/types/user"

function mapRow(row: any): Profile {
  return {
    id: row.id,
    userId: row.id,
    username: row.username ?? row.email?.split("@")[0] ?? "",
    displayName: row.full_name ?? row.email?.split("@")[0] ?? "",
    bio: row.bio ?? "",
    profileImage: row.avatar_url ?? "/default-avatar.png",
    profileBanner: row.banner_url ?? "/images/website-background.png",
    updatedAt: row.updated_at,
  }
}

export async function getOrCreateProfile(userId: string, email: string): Promise<Profile | null> {
  const { data: existing, error: fetchError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()

  if (fetchError) {
    console.error("Failed to fetch profile:", fetchError.message)
    return null
  }

  if (existing) {
    return mapRow(existing)
  }

  // No profile row yet - create a minimal default one from the auth user's
  // email. (If you have a DB trigger that auto-inserts into user_profiles on
  // signup, this branch should rarely run - it's just a safety net.)
  const { data: created, error: insertError } = await supabase
    .from("user_profiles")
    .insert({
      id: userId,
      email,
      full_name: email.split("@")[0],
      username: email.split("@")[0],
    })
    .select("*")
    .single()

  if (insertError) {
    console.error("Failed to create profile:", insertError.message)
    return null
  }

  return mapRow(created)
}

interface UpdateProfileInput {
  username?: string
  displayName?: string
  bio?: string
  profileImage?: string
  profileBanner?: string
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile | null> {
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (input.username !== undefined) updates.username = input.username
  if (input.displayName !== undefined) updates.full_name = input.displayName
  if (input.bio !== undefined) updates.bio = input.bio
  if (input.profileImage !== undefined) updates.avatar_url = input.profileImage
  if (input.profileBanner !== undefined) updates.banner_url = input.profileBanner

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", userId)
    .select("*")
    .single()

  if (error) {
    console.error("Failed to update profile:", error.message)
    throw new Error(error.message)
  }

  return mapRow(data)
}