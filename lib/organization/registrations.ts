// lib/organization/registrations.ts
//
// NOTE: adjust this import to wherever your actual Supabase client lives
// if it's not this path — everything else in this file is self-contained.
import { supabase } from "@/lib/supabase"
import type { PoolTeamInput, BankPlayerInput } from "@/lib/organization/organization"

/* ────────────────────────────────────────────────────────────────── */
/*  REGISTRATION FORMS — an org can run several registration links at   */
/*  once (like separate Google Forms), each with its own banner,        */
/*  welcome message, accent color, and open/closed + capacity per type. */
/*  Every form still feeds the SAME org-wide Team Pool / Player Bank —  */
/*  the form is just a tag carried onto the pool/bank row at approval   */
/*  time (source_form_id), so admins can filter by it forever, even     */
/*  after the registration is approved, rejected, or the form itself is */
/*  edited or deleted.                                                  */
/* ────────────────────────────────────────────────────────────────── */

export interface RegistrationForm {
  id: string
  orgId: string
  slug: string
  name: string
  bannerUrl: string | null
  welcomeMessage: string | null
  accentColor: string | null
  teamOpen: boolean
  playerOpen: boolean
  teamCap: number | null
  playerCap: number | null
  isActive: boolean
  createdAt: string
}

function mapForm(row: any): RegistrationForm {
  return {
    id: row.id,
    orgId: row.org_id,
    slug: row.slug,
    name: row.name,
    bannerUrl: row.banner_url,
    welcomeMessage: row.welcome_message,
    accentColor: row.accent_color,
    teamOpen: row.team_open,
    playerOpen: row.player_open,
    teamCap: row.team_cap,
    playerCap: row.player_cap,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export async function getRegistrationFormsForOrg(orgId: string): Promise<RegistrationForm[]> {
  const { data, error } = await supabase
    .from("registration_forms")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return data.map(mapForm)
}

export async function getActiveRegistrationFormsForOrg(orgId: string): Promise<RegistrationForm[]> {
  const forms = await getRegistrationFormsForOrg(orgId)
  return forms.filter((f) => f.isActive)
}

/** Fetches a single form by id. Used at submission time to re-check the
 *  form's live open/active/cap state server-side, rather than trusting
 *  whatever the client had cached from page load — see submitTeamRegistration
 *  / submitPlayerRegistration below. */
export async function getRegistrationFormById(formId: string): Promise<RegistrationForm | null> {
  const { data, error } = await supabase.from("registration_forms").select("*").eq("id", formId).single()
  if (error || !data) return null
  return mapForm(data)
}

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "form"
}

export async function createRegistrationForm(
  orgId: string,
  userId: string,
  input: { name: string; slug?: string }
): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await supabase
    .from("registration_forms")
    .insert({
      org_id: orgId,
      slug: slugify(input.slug || input.name),
      name: input.name.trim(),
      created_by: userId,
    })
    .select("id")
    .single()
  if (error || !data) {
    if (error?.code === "23505") {
      return { id: null, error: "A form with that link already exists — try a different name." }
    }
    return { id: null, error: error?.message ?? "Couldn't create the form." }
  }
  return { id: data.id }
}

export async function updateRegistrationForm(
  formId: string,
  patch: Partial<{
    name: string
    bannerUrl: string
    welcomeMessage: string
    accentColor: string
    teamOpen: boolean
    playerOpen: boolean
    teamCap: number | null
    playerCap: number | null
    isActive: boolean
  }>
): Promise<{ ok: boolean; error?: string }> {
  const row: Record<string, any> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) row.name = patch.name
  if (patch.bannerUrl !== undefined) row.banner_url = patch.bannerUrl || null
  if (patch.welcomeMessage !== undefined) row.welcome_message = patch.welcomeMessage || null
  if (patch.accentColor !== undefined) row.accent_color = patch.accentColor || null
  if (patch.teamOpen !== undefined) row.team_open = patch.teamOpen
  if (patch.playerOpen !== undefined) row.player_open = patch.playerOpen
  if (patch.teamCap !== undefined) row.team_cap = patch.teamCap
  if (patch.playerCap !== undefined) row.player_cap = patch.playerCap
  if (patch.isActive !== undefined) row.is_active = patch.isActive

  const { error } = await supabase.from("registration_forms").update(row).eq("id", formId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteRegistrationForm(formId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("registration_forms").delete().eq("id", formId)
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "This form still has registrations attached — deactivate it instead of deleting it.",
      }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Public lookup for the registration page(s): org by slug only. */
export async function getOrgBySlugForRegistration(
  orgSlug: string
): Promise<{ id: string; name: string; slug: string } | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", orgSlug)
    .single()
  if (error || !data) return null
  return data
}

/** Public lookup for a specific form's registration page. */
export async function getRegistrationFormBySlug(
  orgSlug: string,
  formSlug: string
): Promise<{ org: { id: string; name: string; slug: string }; form: RegistrationForm } | null> {
  const org = await getOrgBySlugForRegistration(orgSlug)
  if (!org) return null
  const { data, error } = await supabase
    .from("registration_forms")
    .select("*")
    .eq("org_id", org.id)
    .eq("slug", formSlug)
    .eq("is_active", true)
    .single()
  if (error || !data) return null
  return { org, form: mapForm(data) }
}

/** Count is per-form, since caps are configured per-form now. */
export async function getRegistrationCount(formId: string, type: "team" | "player"): Promise<number> {
  const { count } = await supabase
    .from("pending_registrations")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId)
    .eq("type", type)
    .in("status", ["pending", "approved"])
  return count ?? 0
}

/* ────────────────────────────────────────────────────────────────── */
/*  SUBMISSIONS — public, unauthenticated writes from a registration    */
/*  page. Every submission is tagged with both org_id (broad queries)   */
/*  and form_id (precise filtering).                                    */
/*                                                                       */
/*  Both submit functions re-fetch the form and re-check                */
/*  active/open/cap right here, immediately before inserting — NOT      */
/*  just trusting the `open`/`cap` values the calling page loaded on    */
/*  mount. The page-level check exists purely for UX (disabling         */
/*  buttons, showing "closed"); this is the actual enforcement, since   */
/*  these functions are the only path that writes a pending             */
/*  registration and can be called directly regardless of what the UI   */
/*  displayed.                                                          */
/*                                                                       */
/*  Note this still isn't fully race-proof under concurrent submissions */
/*  landing in the same instant (check-then-insert, not an atomic DB    */
/*  transaction) — if the cap is a hard constraint you can't go over    */
/*  by even one, add a DB-level check constraint or trigger on          */
/*  pending_registrations as a second line of defense.                  */
/* ────────────────────────────────────────────────────────────────── */

export type SubmitRegistrationResult = { id: string | null; error?: string }

export async function submitTeamRegistration(
  formId: string,
  orgId: string,
  input: PoolTeamInput,
  contact: { contactName: string; contactEmail: string; contactPhone?: string }
): Promise<SubmitRegistrationResult> {
  const form = await getRegistrationFormById(formId)
  if (!form || !form.isActive) {
    return { id: null, error: "This registration form is no longer available." }
  }
  if (!form.teamOpen) {
    return { id: null, error: "Team registration is closed for this form." }
  }
  if (form.teamCap != null) {
    const count = await getRegistrationCount(formId, "team")
    if (count >= form.teamCap) {
      return { id: null, error: "Team registration is full." }
    }
  }

  const { data, error } = await supabase
    .from("pending_registrations")
    .insert({
      org_id: orgId,
      form_id: formId,
      type: "team",
      payload: input,
      contact_name: contact.contactName,
      contact_email: contact.contactEmail,
      contact_phone: contact.contactPhone ?? null,
    })
    .select("id")
    .single()
  if (error || !data) return { id: null, error: error?.message ?? "Couldn't submit your registration." }
  return { id: data.id }
}

export async function submitPlayerRegistration(
  formId: string,
  orgId: string,
  input: BankPlayerInput,
  contact: { contactName: string; contactEmail: string; contactPhone?: string }
): Promise<SubmitRegistrationResult> {
  const form = await getRegistrationFormById(formId)
  if (!form || !form.isActive) {
    return { id: null, error: "This registration form is no longer available." }
  }
  if (!form.playerOpen) {
    return { id: null, error: "Player registration is closed for this form." }
  }
  if (form.playerCap != null) {
    const count = await getRegistrationCount(formId, "player")
    if (count >= form.playerCap) {
      return { id: null, error: "Player registration is full." }
    }
  }

  const { data, error } = await supabase
    .from("pending_registrations")
    .insert({
      org_id: orgId,
      form_id: formId,
      type: "player",
      payload: input,
      contact_name: contact.contactName,
      contact_email: contact.contactEmail,
      contact_phone: contact.contactPhone ?? null,
    })
    .select("id")
    .single()
  if (error || !data) return { id: null, error: error?.message ?? "Couldn't submit your registration." }
  return { id: data.id }
}

/* ────────────────────────────────────────────────────────────────── */
/*  ADMIN SIDE — list, filter, approve, reject.                         */
/* ────────────────────────────────────────────────────────────────── */

export interface PendingRegistration {
  id: string
  orgId: string
  formId: string | null
  formName: string | null // joined in from registration_forms, for display + filtering
  type: "team" | "player"
  status: "pending" | "approved" | "rejected"
  payload: PoolTeamInput | BankPlayerInput
  contactName: string
  contactEmail: string
  contactPhone: string | null
  submittedAt: string
  rejectionReason: string | null
}

function mapRegistration(row: any): PendingRegistration {
  return {
    id: row.id,
    orgId: row.org_id,
    formId: row.form_id,
    formName: row.registration_forms?.name ?? null,
    type: row.type,
    status: row.status,
    payload: row.payload,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    submittedAt: row.submitted_at,
    rejectionReason: row.rejection_reason,
  }
}

/** Every registration for the org, across all its forms — join in the
 *  form's name once here so the admin list/filter doesn't need a
 *  second round trip. */
export async function getRegistrationsForOrg(orgId: string): Promise<PendingRegistration[]> {
  const { data, error } = await supabase
    .from("pending_registrations")
    .select("*, registration_forms(name)")
    .eq("org_id", orgId)
    .order("submitted_at", { ascending: false })
  if (error || !data) return []
  return data.map(mapRegistration)
}

export function subscribeToOrgRegistrations(orgId: string, onChange: () => void) {
  return supabase
    .channel(`org-registrations-${orgId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pending_registrations", filter: `org_id=eq.${orgId}` },
      onChange
    )
    .subscribe()
}

/** Copies an approved registration into Team Pool / Player Bank, tagging
 *  the new row with source_form_id + source_registration_id. Those two
 *  columns are the permanent record of where the entry came from — set
 *  once, here, and never re-derived afterward, so the origin survives
 *  independent of anything that later happens to the form or the
 *  pending_registrations row itself. */
export async function approveRegistration(
  reg: PendingRegistration,
  orgId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  if (reg.type === "team") {
    const p = reg.payload as PoolTeamInput
    const { error: insertError } = await supabase.from("team_pool").insert({
      org_id: orgId,
      name: p.name,
      code: p.code,
      owner: p.owner ?? "",
      tier: p.tier,
      color: p.color,
      logo: p.logo ?? "",
      created_by: userId,
      source_form_id: reg.formId,
      source_registration_id: reg.id,
    })
    if (insertError) return { ok: false, error: insertError.message }
  } else {
    const p = reg.payload as BankPlayerInput
    const { error: insertError } = await supabase.from("player_bank").insert({
      org_id: orgId,
      name: p.name,
      role: p.role,
      origin: p.origin,
      country: p.country ?? "",
      img: p.img ?? "",
      capped: p.capped,
      created_by: userId,
      source_form_id: reg.formId,
      source_registration_id: reg.id,
    })
    if (insertError) return { ok: false, error: insertError.message }
  }

  const { error } = await supabase
    .from("pending_registrations")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: userId })
    .eq("id", reg.id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function rejectRegistration(
  regId: string,
  userId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("pending_registrations")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      rejection_reason: reason.trim() || "Not accepted.",
    })
    .eq("id", regId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function bulkApproveRegistrations(
  regs: PendingRegistration[],
  orgId: string,
  userId: string
): Promise<{ okIds: string[]; failedIds: string[] }> {
  const okIds: string[] = []
  const failedIds: string[] = []
  for (const reg of regs) {
    const result = await approveRegistration(reg, orgId, userId)
    if (result.ok) okIds.push(reg.id)
    else failedIds.push(reg.id)
  }
  return { okIds, failedIds }
}