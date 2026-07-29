"use client"

import { useState } from "react"
import { Save, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateOrganization, type OrgSummary } from "@/lib/organization/organization"

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
        // Reset form to new values after successful save
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
      <div className="bg-black/50 border border-gold/20 rounded-lg p-8">
        <h3 className="text-xl font-cinzel font-bold text-white mb-6">Organization Details</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
              Organization Name
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Valiant League"
              className="bg-black/50 border-gold/20"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
              Slug (URL-friendly ID)
            </label>
            <Input
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g., valiant-league"
              className="bg-black/50 border-gold/20"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used in registration links and public URLs. Must be unique.
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description of your organization"
              className="bg-black/50 border-gold/20"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
              Logo URL
            </label>
            <Input
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="bg-black/50 border-gold/20"
            />
            <p className="text-xs text-gray-500 mt-1">
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
                <span className="text-xs text-gray-500">Preview (if available)</span>
              </div>
            )}
          </div>
        </div>

        {result && (
          <div
            className={`mt-6 p-3 rounded-md flex items-start gap-2 ${
              result.ok
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-red-500/10 border border-red-500/30"
            }`}
          >
            {result.ok ? (
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${result.ok ? "text-green-400" : "text-red-400"}`}>
              {result.message}
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          {hasChanges && (
            <p className="text-xs text-gold/60 flex items-center">
              You have unsaved changes
            </p>
          )}
        </div>
      </div>

      <div className="bg-black/50 border border-gold/20 rounded-lg p-8">
        <h3 className="text-xl font-cinzel font-bold text-white mb-4">Organization Info</h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Organization ID</p>
            <p className="text-white font-mono">{org.id}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Created</p>
            <p className="text-white">
              {org.createdAt
                ? new Date(org.createdAt).toLocaleDateString()
                : "Unknown"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}