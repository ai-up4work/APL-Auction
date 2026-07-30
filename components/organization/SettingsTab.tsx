"use client"

import { useEffect, useState } from "react"
import { Save, AlertCircle, CheckCircle, Mail, Trash2, ShieldCheck, Users, UserPlus, Crown, Loader2, Copy, Check, Share2, Twitter, Linkedin, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { Panel, FieldLabel, StatusBadge, StyledSelect } from "@/components/organization/shared"
import { updateOrganization, type OrgSummary } from "@/lib/organization/organization"
import { useAuth } from "@/context/AuthContext"
import {
  createInvite,
  getPendingInvitesForOrg,
  revokeInvite,
  getMembersForOrg,
  updateMemberRole,
  removeMember,
  getMembershipRole,
  type MemberRole,
  type OrgInvite,
  type OrgMember,
} from "@/lib/organization/invites"

// NOTE: "owner" is a special, non-assignable role — it's set once when an
// org is created and isn't offered here as something you can invite
// someone into or promote/demote a member to.
const ROLE_OPTIONS: MemberRole[] = ["admin", "auctioneer", "scorer", "viewer"]

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function SettingsTab({ org }: { org: OrgSummary }) {
  const [formData, setFormData] = useState({
    name: org.name,
    slug: org.slug,
    description: org.description || "",
    logoUrl: org.logoUrl || "",
  })

  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setResult(null)

    try {
      const res = await updateOrganization(org.id, formData)

      if (res.ok) {
        setResult({ ok: true, message: "Organization updated successfully!" })
        setTimeout(() => {
          setResult(null)
        }, 3000)
      } else {
        setResult({ ok: false, message: res.error || "Failed to save" })
      }
    } catch (error) {
      setResult({ ok: false, message: "An unexpected error occurred" })
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    formData.name !== org.name ||
    formData.slug !== org.slug ||
    formData.description !== (org.description || "") ||
    formData.logoUrl !== (org.logoUrl || "")

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-6">Organization Details</h2>

        <div className="space-y-4">
          <div>
            <FieldLabel>Organization Name</FieldLabel>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Valiant League"
              className="bg-black/50 border-gold/30 text-white"
            />
          </div>

          <div>
            <FieldLabel>Slug (URL-friendly ID)</FieldLabel>
            <Input
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g., valiant-league"
              className="bg-black/50 border-gold/30 text-white"
            />
            <p className="text-gray-600 text-[11px] mt-1.5">
              Used in registration links and public URLs. Must be unique.
            </p>
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description of your organization"
              className="bg-black/50 border-gold/30 text-white"
              rows={3}
            />
          </div>

          <div>
            <FieldLabel>Logo URL</FieldLabel>
            <Input
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="bg-black/50 border-gold/30 text-white"
            />
            <p className="text-gray-600 text-[11px] mt-1.5">
              Direct link to your organization logo. Recommended: square image, at least 256x256px.
            </p>
            {formData.logoUrl && (
              <div className="mt-3 flex items-center gap-2">
                <img
                  src={formData.logoUrl}
                  alt="Logo preview"
                  className="h-12 w-12 rounded border border-gold/20 object-cover"
                  onError={(e) => {
                    ;(e.currentTarget.style.display = "none")
                  }}
                />
                <span className="text-gray-600 text-[11px]">Preview (if available)</span>
              </div>
            )}
          </div>
        </div>

        {result && (
          <p className={`flex items-center gap-1.5 text-sm mt-6 ${result.ok ? "text-green-400" : "text-red-500"}`}>
            {result.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {result.message}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          {hasChanges && <span className="text-gold/60 text-xs">You have unsaved changes</span>}
        </div>
      </Panel>

      <InvitesPanel orgId={org.id} orgName={org.name} />

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Organization Info</h2>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <FieldLabel>Organization ID</FieldLabel>
            <p className="text-white font-mono">{org.id}</p>
          </div>
          <div>
            <FieldLabel>Created</FieldLabel>
            <p className="text-white">{org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "Unknown"}</p>
          </div>
        </div>
      </Panel>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  INVITES PANEL — team members + pending invites. Admins AND the org    */
/*  owner can invite/revoke/change roles; everyone else gets a read-only  */
/*  list. The owner row itself is never editable or removable from here — */
/*  demoting or removing the org's owner isn't something this UI allows.  */
/* ────────────────────────────────────────────────────────────────── */

function InvitesPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { user } = useAuth()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const [isAdmin, setIsAdmin] = useState(false)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invites, setInvites] = useState<OrgInvite[]>([])
  const [loaded, setLoaded] = useState(false)

  const [email, setEmail] = useState("")
  const [role, setRole] = useState<MemberRole>("viewer")
  const [sending, setSending] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)
  const [copiedGeneralLink, setCopiedGeneralLink] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  const load = async () => {
    const [membersData, invitesData, myRole] = await Promise.all([
      getMembersForOrg(orgId),
      getPendingInvitesForOrg(orgId),
      user ? getMembershipRole(orgId, user.id) : Promise.resolve(null),
    ])
    setMembers(membersData)
    setInvites(invitesData)
    // Owner has the same management rights as admin everywhere in this panel.
    setIsAdmin(myRole === "admin" || myRole === "owner")
    setLoaded(true)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, user?.id])

  const handleInvite = async () => {
    if (!user || !email.trim()) return
    setSending(true)
    setInviteError(null)

    const res = await createInvite(orgId, user.id, email, role)

    if (res.ok) {
      setEmail("")
      setRole("viewer")
      await load()
    } else {
      setInviteError(res.error ?? "Couldn't send that invite.")
    }
    setSending(false)
  }

  const copyInviteLink = (invite: OrgInvite) => {
    const link = `${window.location.origin}/invite/${invite.token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedInviteId(invite.id)
      setTimeout(() => setCopiedInviteId(null), 2000)
    })
  }

  const getOrgInviteLink = () => {
    if (!invites || invites.length === 0) return null
    return `${window.location.origin}/invite/${invites[0].token}`
  }

  const copyOrgInviteLink = () => {
    const link = getOrgInviteLink()
    if (link) {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedGeneralLink(true)
        setTimeout(() => setCopiedGeneralLink(false), 2000)
      })
    }
  }

  const shareOnTwitter = () => {
    const link = getOrgInviteLink()
    if (link) {
      const text = `Join ${orgName} on our cricket platform! Click the link to accept the invite: `
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
      window.open(url, "_blank")
    }
  }

  const shareOnLinkedIn = () => {
    const link = getOrgInviteLink()
    if (link) {
      const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`
      window.open(url, "_blank")
    }
  }

  const shareViaWhatsApp = () => {
    const link = getOrgInviteLink()
    if (link) {
      const text = `Join ${orgName}! ${link}`
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`
      window.open(url, "_blank")
    }
  }

  const handleRevoke = async (invite: OrgInvite) => {
    const ok = await confirm({
      title: `Revoke invite to ${invite.email}?`,
      description: "They'll no longer be able to use this invite link to join.",
      confirmText: "Revoke invite",
      tone: "danger",
    })
    if (!ok) return

    setRevokingId(invite.id)
    const success = await revokeInvite(invite.id)
    setRevokingId(null)
    if (success) setInvites((prev) => prev.filter((i) => i.id !== invite.id))
  }

  const handleRoleChange = async (member: OrgMember, newRole: MemberRole) => {
    if (member.role === "owner") return // defense in depth — owner's role is never editable here
    const ok = await updateMemberRole(member.id, newRole)
    if (ok) setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)))
  }

  const handleRemove = async (member: OrgMember) => {
    if (member.role === "owner") return // defense in depth — owner can never be removed here
    const ok = await confirm({
      title: `Remove ${member.fullName || member.email}?`,
      description: "They'll lose access to this organization immediately.",
      confirmText: "Remove member",
      tone: "danger",
    })
    if (!ok) return

    setRemovingId(member.id)
    const success = await removeMember(member.id)
    setRemovingId(null)
    if (success) setMembers((prev) => prev.filter((m) => m.id !== member.id))
  }

  return (
    <Panel>
      <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
        <Users className="h-4 w-4 text-gold" /> Team Members & Invites
      </h2>
      <p className="text-gray-500 text-xs mb-6">
        {isAdmin
          ? "Invite people to help run this organization. Admins and the owner can invite, change roles, and remove members."
          : "Only the organization owner and admins can send invites or change member roles."}
      </p>

      {isAdmin && invites && invites.length > 0 && (
        <div className="mb-6 bg-gold/5 border border-gold/20 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gold mb-3 flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Share Organization Invite Link
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black/50 border border-gold/30 rounded px-3 py-2 text-white text-xs truncate">
                {getOrgInviteLink()}
              </div>
              <button
                onClick={copyOrgInviteLink}
                className="text-gold hover:text-gold/80 transition-colors p-2 bg-gold/10 rounded border border-gold/20 hover:border-gold/40"
                title="Copy link"
              >
                {copiedGeneralLink ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={shareOnTwitter}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded border border-blue-400/30 text-blue-400 hover:bg-blue-400/10 transition-colors"
                title="Share on Twitter"
              >
                <Twitter className="h-4 w-4" /> Twitter
              </button>
              <button
                onClick={shareOnLinkedIn}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded border border-blue-600/30 text-blue-400 hover:bg-blue-600/10 transition-colors"
                title="Share on LinkedIn"
              >
                <Linkedin className="h-4 w-4" /> LinkedIn
              </button>
              <button
                onClick={shareViaWhatsApp}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                title="Share via WhatsApp"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mb-6">
          <FieldLabel>Invite by Email</FieldLabel>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="bg-black/50 border-gold/30 text-white flex-1"
            />
            <StyledSelect
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              placeholder="Select role"
              className="w-full sm:w-40"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </StyledSelect>
            <Button
              onClick={handleInvite}
              disabled={!email.trim() || sending}
              className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invite
                </>
              )}
            </Button>
          </div>

          {inviteError && (
            <p className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
              <AlertCircle className="h-4 w-4" /> {inviteError}
            </p>
          )}
        </div>
      )}

      {!loaded ? (
        <p className="text-gray-500 text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
        </p>
      ) : (
        <>
          {isAdmin && invites.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-cinzel uppercase tracking-wide text-gray-300 mb-3">
                Pending Invites ({invites.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="bg-white/[0.02] border border-gold/10 rounded-lg p-4 flex flex-col gap-3 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{invite.email}</p>
                      <p className="text-gray-500 text-xs mt-1">Role: {roleLabel(invite.role)}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-gold/10">
                      <button
                        onClick={() => copyInviteLink(invite)}
                        title="Copy invite link"
                        className="flex-1 text-xs text-gold hover:text-gold/80 transition-colors flex items-center justify-center gap-1.5 py-1.5 px-2 rounded border border-gold/20 hover:border-gold/40"
                      >
                        {copiedInviteId === invite.id ? (
                          <>
                            <Check className="h-3 w-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy Link
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleRevoke(invite)}
                        disabled={revokingId === invite.id}
                        title="Revoke invite"
                        className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50 p-1.5"
                      >
                        {revokingId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-cinzel uppercase tracking-wide text-gray-300 mb-3">Current Members</p>
            {members.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No members yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map((member) => {
                  const isOwner = member.role === "owner"
                  const isSelf = member.userId === user?.id

                  return (
                    <div
                      key={member.id}
                      className={`rounded-lg p-4 flex items-start justify-between gap-3 transition-colors ${
                        isOwner
                          ? "bg-gold/5 border border-gold/20"
                          : "bg-white/[0.02] border border-gold/10 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <div
                          className={`h-9 w-9 rounded-full flex-shrink-0 border flex items-center justify-center ${
                            isOwner
                              ? "border-gold/40 bg-gold/10"
                              : "border-white/10 bg-black/60"
                          }`}
                        >
                          {isOwner ? (
                            <Crown className="h-4 w-4 text-gold" />
                          ) : member.role === "admin" ? (
                            <ShieldCheck className="h-4 w-4 text-gold" />
                          ) : (
                            <UserPlus className="h-4 w-4 text-white/40" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium truncate">{member.fullName || member.email}</p>
                            {isOwner && (
                              <span className="text-[10px] font-semibold text-gold uppercase tracking-wider px-2 py-0.5 bg-gold/10 border border-gold/20 rounded">
                                Owner
                              </span>
                            )}
                            {isSelf && !isOwner && (
                              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider px-2 py-0.5 bg-blue-400/10 border border-blue-400/20 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs truncate mt-0.5">{member.email}</p>
                          <p className="text-gray-600 text-xs mt-1">{roleLabel(member.role)}</p>
                        </div>
                      </div>

                      {isAdmin && !isOwner && (
                        <div className="flex items-center gap-2 shrink-0">
                          <div title={isSelf ? "Can't change your own role" : undefined}>
                            <StyledSelect
                              value={member.role}
                              onChange={(e) => handleRoleChange(member, e.target.value as MemberRole)}
                              disabled={isSelf}
                              placeholder="Select role"
                              className="w-32"
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r} value={r}>
                                  {roleLabel(r)}
                                </option>
                              ))}
                            </StyledSelect>
                          </div>
                          <button
                            onClick={() => handleRemove(member)}
                            disabled={isSelf || removingId === member.id}
                            title={isSelf ? "Can't remove yourself" : "Remove member"}
                            className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-30 p-1.5"
                          >
                            {removingId === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {ConfirmDialogElement}
    </Panel>
  )
}
