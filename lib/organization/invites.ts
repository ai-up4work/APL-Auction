// lib/organization/invites.ts
import { supabase } from "@/lib/supabase";

export type MemberRole = "admin" | "auctioneer" | "scorer" | "viewer" | "owner";

export interface OrgInvite {
  id: string;
  orgId: string;
  email: string;
  role: MemberRole;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
}

export interface OrgMember {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: MemberRole;
  status: string;
  joinedAt: string | null;
}

/** Every org has exactly one "founding admin" — whoever created it. Insert
 *  this once at org-creation time (call it right after createOrganization
 *  succeeds, alongside inserting the organizations row itself). Idempotent
 *  via onConflict so it's safe to call again if the org already has this
 *  membership. */
export async function ensureOwnerMembership(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("org_memberships")
    .upsert(
      { org_id: orgId, user_id: userId, role: "admin", status: "active", joined_at: new Date().toISOString() },
      { onConflict: "org_id,user_id" }
    );
  if (error) console.error("ensureOwnerMembership failed:", error.message);
}

/** Returns the current user's role for this org, or null if they have no
 *  active membership at all. This is the single source of truth every
 *  route guard below calls into. */
export async function getMembershipRole(orgId: string, userId: string): Promise<MemberRole | null> {
  const { data, error } = await supabase
    .from("org_memberships")
    .select("role, status")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("getMembershipRole failed:", error.message);
    return null;
  }
  return (data?.role as MemberRole) ?? null;
}

/** Resolves the org_id behind an auction id, so a route guard that only
 *  has `auctionId` in its params (e.g. /auction/live/[auctionId]) can
 *  still look up the current user's role for that auction's org. */
export async function getOrgIdForAuction(auctionId: string): Promise<string | null> {
  const { data, error } = await supabase.from("auctions").select("org_id").eq("id", auctionId).maybeSingle();
  if (error || !data?.org_id) return null;
  return data.org_id;
}

/** Same resolution, but for a match id (used by the overlay routes, which
 *  key off matches.id / matches.auction_id rather than a real auction). */
export async function getOrgIdForMatch(matchId: string): Promise<string | null> {
  const { data, error } = await supabase.from("matches").select("org_id").eq("id", matchId).maybeSingle();
  if (error || !data?.org_id) return null;
  return data.org_id;
}

export async function getMembersForOrg(orgId: string): Promise<OrgMember[]> {
  // First get memberships
  const { data: memberships, error: memberError } = await supabase
    .from("org_memberships")
    .select("id, user_id, role, status, joined_at")
    .eq("org_id", orgId)
    .order("joined_at", { ascending: false });

  if (memberError) {
    console.error("getMembersForOrg failed:", memberError.message);
    return [];
  }

  if (!memberships || memberships.length === 0) return [];

  // Get user IDs from memberships
  const userIds = memberships.map((m: any) => m.user_id);

  // Fetch profiles for these users
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) ?? []);

  return memberships.map((m: any) => ({
    id: m.id,
    userId: m.user_id,
    email: profileMap.get(m.user_id)?.email ?? "",
    fullName: profileMap.get(m.user_id)?.full_name ?? null,
    role: m.role,
    status: m.status,
    joinedAt: m.joined_at,
  }));
}

export async function getPendingInvitesForOrg(orgId: string): Promise<OrgInvite[]> {
  const { data, error } = await supabase
    .from("org_invites")
    .select("id, org_id, email, role, token, status, created_at, expires_at")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPendingInvitesForOrg failed:", error.message);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    orgId: r.org_id,
    email: r.email,
    role: r.role,
    token: r.token,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));
}

export interface InviteResult {
  ok: boolean;
  error?: string;
  invite?: OrgInvite;
}

/** Creates (or refreshes) a pending invite for an email+role. If a pending
 *  invite already exists for this email on this org, it's replaced rather
 *  than duplicated — re-inviting someone (e.g. to bump their role, or
 *  because the link expired) should just work. */
export async function createInvite(
  orgId: string,
  invitedBy: string,
  email: string,
  role: MemberRole
): Promise<InviteResult> {
  const normalizedEmail = email.trim().toLowerCase();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  // Clear out any stale pending invite for the same email first.
  await supabase
    .from("org_invites")
    .update({ status: "revoked" })
    .eq("org_id", orgId)
    .eq("email", normalizedEmail)
    .eq("status", "pending");

  const { data, error } = await supabase
    .from("org_invites")
    .insert({
      org_id: orgId,
      email: normalizedEmail,
      role,
      created_by: invitedBy,
    })
    .select("id, org_id, email, role, token, status, created_at, expires_at")
    .single();

  if (error || !data) {
    console.error("createInvite failed:", error?.message);
    return { ok: false, error: "Couldn't send that invite — please try again." };
  }

  // TODO: Send invitation email here with link: /invite/${data.token}
  // Example: await sendInviteEmail(data.email, data.token, role);

  return {
    ok: true,
    invite: {
      id: data.id,
      orgId: data.org_id,
      email: data.email,
      role: data.role,
      token: data.token,
      status: data.status,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    },
  };
}

export async function revokeInvite(inviteId: string): Promise<boolean> {
  const { error } = await supabase.from("org_invites").update({ status: "revoked" }).eq("id", inviteId);
  if (error) {
    console.error("revokeInvite failed:", error.message);
    return false;
  }
  return true;
}

export async function updateMemberRole(membershipId: string, role: MemberRole): Promise<boolean> {
  const { error } = await supabase.from("org_memberships").update({ role }).eq("id", membershipId);
  if (error) {
    console.error("updateMemberRole failed:", error.message);
    return false;
  }
  return true;
}

export async function removeMember(membershipId: string): Promise<boolean> {
  const { error } = await supabase.from("org_memberships").delete().eq("id", membershipId);
  if (error) {
    console.error("removeMember failed:", error.message);
    return false;
  }
  return true;
}

export interface AcceptInviteResult {
  ok: boolean;
  error?: string;
  orgId?: string;
}

/** Called from a dedicated accept-invite page (e.g. /invite/[token]) once
 *  the invited user is signed in. Validates the token, checks it matches
 *  the signed-in user's email (case-insensitively) and hasn't expired,
 *  then creates the real org_memberships row and marks the invite used. */
export async function acceptInvite(token: string, userId: string, userEmail: string): Promise<AcceptInviteResult> {
  const { data: invite, error: fetchErr } = await supabase
    .from("org_invites")
    .select("id, org_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (fetchErr || !invite) return { ok: false, error: "This invite link is invalid." };
  if (invite.status !== "pending") return { ok: false, error: "This invite has already been used or revoked." };
  if (new Date(invite.expires_at) < new Date()) return { ok: false, error: "This invite has expired." };
  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, error: "This invite was sent to a different email address." };
  }

  const { error: upsertErr } = await supabase.from("org_memberships").upsert(
    {
      org_id: invite.org_id,
      user_id: userId,
      role: invite.role,
      status: "active",
      joined_at: new Date().toISOString(),
    },
    { onConflict: "org_id,user_id" }
  );

  if (upsertErr) {
    console.error("acceptInvite(upsert membership) failed:", upsertErr.message);
    return { ok: false, error: "Couldn't join the organization — please try again." };
  }

  const { error: updateErr } = await supabase
    .from("org_invites")
    .update({ status: "accepted", joined_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (updateErr) {
    console.error("acceptInvite(mark accepted) failed:", updateErr.message);
  }

  return { ok: true, orgId: invite.org_id };
}
