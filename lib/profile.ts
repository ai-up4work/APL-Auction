// lib/profile.ts
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/types/user"

// Wraps supabase.auth.signUp so the register page doesn't need to import
// `supabase` directly. The handle_new_user DB trigger (on auth.users
// insert) takes care of creating the user_profiles/organizations/
// org_memberships rows - this function's only job is to create the auth
// user and hand back whatever Supabase returns.
export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  emailRedirectTo?: string
) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo:
        emailRedirectTo ??
        (typeof window !== "undefined" ? `${window.location.origin}/auth/login` : undefined),
    },
  })
}

// Wraps supabase.auth.signInWithPassword so pages don't need to import
// `supabase` directly just to sign in.
export async function loginUser(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

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

// Creates a brand-new org for a user who signed up without an invite.
// NOTE: this assumes an `organizations` table shaped roughly like
// (id uuid, name text, created_by uuid). Adjust column names here if yours
// differs - I don't have that table's schema, only that `auctions.org_id`
// and `user_profiles.current_org_id` reference `organizations(id)`.
async function createPersonalOrg(userId: string, email: string): Promise<string | null> {
  const orgName = `${email.split("@")[0]}'s Org`

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: orgName,
      created_by: userId,
    })
    .select("id")
    .single()

  if (error) {
    console.error("Failed to create personal org:", error.message)
    return null
  }

  return data.id as string
}

export async function getOrCreateProfile(
  userId: string,
  email: string,
  inviteOrgId?: string | null
): Promise<Profile | null> {
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

  // No profile row yet - figure out which org this brand-new user belongs
  // to before creating the row:
  //   - if they signed up via an invite link, inviteOrgId will be set and
  //     we join that existing org
  //   - otherwise, spin up a fresh personal org for them, which they can
  //     rename/change later
  const orgId = inviteOrgId ?? (await createPersonalOrg(userId, email))

  const { data: created, error: insertError } = await supabase
    .from("user_profiles")
    .insert({
      id: userId,
      email,
      full_name: email.split("@")[0],
      username: email.split("@")[0],
      current_org_id: orgId,
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