// app/lib/organization/registrations.ts
//
// Public self-registration + admin approval, sitting on top of the
// existing team_pool / player_bank tables. Nothing in here writes to
// those tables directly — approval calls the exact same addPoolTeam /
// addBankPlayer functions organization.ts already exposes, so an
// approved registration is indistinguishable from a team/player an admin
// typed in by hand.
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  addPoolTeam,
  addBankPlayer,
  type OrgSummary,
  type PoolTeamInput,
  type BankPlayerInput,
} from "./organization";

/* ────────────────────────────────────────────────────────────────── */
/*  PUBLIC LOOKUP — used by the unauthenticated /register/[slug] page   */
/* ────────────────────────────────────────────────────────────────── */

/** Registration-page customization, stored on the organizations row (see
 *  20260728b_registration_customization.sql). teamOpen/playerOpen let an
 *  admin close one side (e.g. teams) while the other stays open; the caps
 *  are optional soft limits enforced client-side via getRegistrationCount
 *  — for a hard guarantee, back them with a DB trigger. */
export interface RegistrationSettings {
  bannerUrl: string | null;
  welcomeMessage: string | null;
  /** A hex color (e.g. "#d4af37") used to override the page's --gold CSS
   *  variable. Null/empty means "use the site default gold". */
  accentColor: string | null;
  teamCap: number | null;
  playerCap: number | null;
  teamOpen: boolean;
  playerOpen: boolean;
}

export interface PublicRegistrationOrg extends OrgSummary, RegistrationSettings {}

const REGISTRATION_SETTINGS_COLUMNS =
  "registration_banner_url, registration_welcome_message, registration_accent_color, registration_team_cap, registration_player_cap, registration_team_open, registration_player_open";

function mapSettingsRow(data: any): RegistrationSettings {
  return {
    bannerUrl: data.registration_banner_url,
    welcomeMessage: data.registration_welcome_message,
    accentColor: data.registration_accent_color,
    teamCap: data.registration_team_cap,
    playerCap: data.registration_player_cap,
    teamOpen: data.registration_team_open ?? true,
    playerOpen: data.registration_player_open ?? true,
  };
}

/** Resolves an org from its slug with no auth required, including its
 *  registration-page customization — this is the single lookup the public
 *  /register/[slug] page needs. */
export async function getOrgBySlugForRegistration(slug: string): Promise<PublicRegistrationOrg | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(`id, name, slug, plan, description, logo_url, ${REGISTRATION_SETTINGS_COLUMNS}`)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    plan: data.plan,
    description: data.description,
    logoUrl: data.logo_url,
    ...mapSettingsRow(data),
  };
}

/** Admin-only — used by the Registrations tab's customization panel. */
export async function getRegistrationSettingsForOrg(orgId: string): Promise<RegistrationSettings | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(REGISTRATION_SETTINGS_COLUMNS)
    .eq("id", orgId)
    .maybeSingle();

  if (error || !data) return null;
  return mapSettingsRow(data);
}

export interface RegistrationSettingsInput {
  bannerUrl?: string;
  welcomeMessage?: string;
  accentColor?: string;
  teamCap?: number | null;
  playerCap?: number | null;
  teamOpen?: boolean;
  playerOpen?: boolean;
}

export async function updateRegistrationSettings(
  orgId: string,
  patch: RegistrationSettingsInput
): Promise<{ ok: boolean; error?: string }> {
  const dbPatch: Record<string, any> = {};
  if (patch.bannerUrl !== undefined) dbPatch.registration_banner_url = patch.bannerUrl.trim() || null;
  if (patch.welcomeMessage !== undefined) dbPatch.registration_welcome_message = patch.welcomeMessage.trim() || null;
  if (patch.accentColor !== undefined) dbPatch.registration_accent_color = patch.accentColor.trim() || null;
  if (patch.teamCap !== undefined) dbPatch.registration_team_cap = patch.teamCap;
  if (patch.playerCap !== undefined) dbPatch.registration_player_cap = patch.playerCap;
  if (patch.teamOpen !== undefined) dbPatch.registration_team_open = patch.teamOpen;
  if (patch.playerOpen !== undefined) dbPatch.registration_player_open = patch.playerOpen;

  const { error } = await supabase.from("organizations").update(dbPatch).eq("id", orgId);
  if (error) {
    console.error("updateRegistrationSettings failed:", error.message);
    return { ok: false, error: "Couldn't save registration page settings — please try again." };
  }
  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────── */
/*  SUBMISSION — called from the public form, writes into the pending    */
/*  queue only                                                          */
/* ────────────────────────────────────────────────────────────────── */

export type RegistrationType = "team" | "player";
export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface PendingRegistration {
  id: string;
  orgId: string;
  type: RegistrationType;
  status: RegistrationStatus;
  /** PoolTeamInput shape when type is "team", BankPlayerInput when "player". */
  payload: PoolTeamInput | BankPlayerInput;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface SubmitContactInput {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
}

export async function submitTeamRegistration(
  orgId: string,
  team: PoolTeamInput,
  contact: SubmitContactInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pending_registrations")
    .insert({
      org_id: orgId,
      type: "team",
      status: "pending",
      payload: team,
      contact_name: contact.contactName.trim(),
      contact_email: contact.contactEmail.trim(),
      contact_phone: contact.contactPhone?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("submitTeamRegistration failed:", error?.message);
    return null;
  }
  return data.id;
}

export async function submitPlayerRegistration(
  orgId: string,
  player: BankPlayerInput,
  contact: SubmitContactInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pending_registrations")
    .insert({
      org_id: orgId,
      type: "player",
      status: "pending",
      payload: player,
      contact_name: contact.contactName.trim(),
      contact_email: contact.contactEmail.trim(),
      contact_phone: contact.contactPhone?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("submitPlayerRegistration failed:", error?.message);
    return null;
  }
  return data.id;
}

/** How many team/player registrations are already pending or approved for
 *  this org. Client-side capacity hint only (e.g. "64/64 teams — closed")
 *  — if capacity is a hard requirement, back it with a DB trigger, since
 *  this check can be bypassed by calling the insert directly. */
export async function getRegistrationCount(orgId: string, type: RegistrationType): Promise<number> {
  const { count, error } = await supabase
    .from("pending_registrations")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("type", type)
    .in("status", ["pending", "approved"]);

  if (error) {
    console.error("getRegistrationCount failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/* ────────────────────────────────────────────────────────────────── */
/*  ADMIN REVIEW — list, approve, reject                               */
/* ────────────────────────────────────────────────────────────────── */

function mapRow(r: any): PendingRegistration {
  return {
    id: r.id,
    orgId: r.org_id,
    type: r.type,
    status: r.status,
    payload: r.payload ?? {},
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at,
    rejectionReason: r.rejection_reason,
  };
}

/** Admin-only — relies on the RLS select policy (org membership) to scope
 *  results; the .eq("org_id", ...) here is belt-and-braces, not the only
 *  thing standing between orgs. */
export async function getRegistrationsForOrg(orgId: string): Promise<PendingRegistration[]> {
  const { data, error } = await supabase
    .from("pending_registrations")
    .select("*")
    .eq("org_id", orgId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("getRegistrationsForOrg failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export interface ReviewResult {
  ok: boolean;
  error?: string;
}

/** Approves a team registration by copying its payload into team_pool via
 *  addPoolTeam — the same insert path TeamPoolTab's "Add to Pool" button
 *  uses. If that insert fails, the registration is left pending so it can
 *  be retried rather than silently lost. */
export async function approveTeamRegistration(
  reg: PendingRegistration,
  orgId: string,
  reviewerId: string
): Promise<ReviewResult> {
  if (reg.type !== "team") return { ok: false, error: "This registration isn't a team." };

  const team = await addPoolTeam(orgId, reviewerId, reg.payload as PoolTeamInput);
  if (!team) return { ok: false, error: "Couldn't add this team to the Team Pool — please try again." };

  const { error } = await supabase
    .from("pending_registrations")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewerId })
    .eq("id", reg.id);

  if (error) console.error("approveTeamRegistration(mark approved) failed:", error.message);
  return { ok: true };
}

/** Same pattern as approveTeamRegistration, but into player_bank via
 *  addBankPlayer. */
export async function approvePlayerRegistration(
  reg: PendingRegistration,
  orgId: string,
  reviewerId: string
): Promise<ReviewResult> {
  if (reg.type !== "player") return { ok: false, error: "This registration isn't a player." };

  const player = await addBankPlayer(orgId, reviewerId, reg.payload as BankPlayerInput);
  if (!player) return { ok: false, error: "Couldn't add this player to the Player Bank — please try again." };

  const { error } = await supabase
    .from("pending_registrations")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewerId })
    .eq("id", reg.id);

  if (error) console.error("approvePlayerRegistration(mark approved) failed:", error.message);
  return { ok: true };
}

/** Dispatches to the right approve function based on reg.type — this is
 *  the one the Registrations tab actually calls. */
export async function approveRegistration(
  reg: PendingRegistration,
  orgId: string,
  reviewerId: string
): Promise<ReviewResult> {
  return reg.type === "team"
    ? approveTeamRegistration(reg, orgId, reviewerId)
    : approvePlayerRegistration(reg, orgId, reviewerId);
}

export async function rejectRegistration(
  regId: string,
  reviewerId: string,
  reason: string
): Promise<ReviewResult> {
  const { error } = await supabase
    .from("pending_registrations")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      rejection_reason: reason.trim() || "Not accepted.",
    })
    .eq("id", regId);

  if (error) {
    console.error("rejectRegistration failed:", error.message);
    return { ok: false, error: "Couldn't reject that registration — please try again." };
  }
  return { ok: true };
}

/** Bulk approve — one row at a time, same pattern as deleteTournaments in
 *  organization.ts, so one bad row (e.g. a duplicate team code) doesn't
 *  block the rest of the batch. */
export async function bulkApproveRegistrations(
  regs: PendingRegistration[],
  orgId: string,
  reviewerId: string
): Promise<{ okIds: string[]; failedIds: string[] }> {
  const okIds: string[] = [];
  const failedIds: string[] = [];
  for (const reg of regs) {
    const result = await approveRegistration(reg, orgId, reviewerId);
    if (result.ok) okIds.push(reg.id);
    else failedIds.push(reg.id);
  }
  return { okIds, failedIds };
}

/* ────────────────────────────────────────────────────────────────── */
/*  REALTIME SYNC — same pattern as subscribeToOrgTournaments            */
/* ────────────────────────────────────────────────────────────────── */

export function subscribeToOrgRegistrations(orgId: string, onChange: () => void): RealtimeChannel {
  const channel = supabase
    .channel(`org-registrations-${orgId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pending_registrations", filter: `org_id=eq.${orgId}` },
      onChange
    )
    .subscribe();
  return channel;
}