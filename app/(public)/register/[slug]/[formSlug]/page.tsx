// app/(public)/register/[slug]/[formSlug]/page.tsx
"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"
import { getRegistrationFormBySlug, type RegistrationForm } from "@/lib/organization/registrations"
import RegistrationFormView from "@/components/organization/Registrationformview"
import { pageStyles } from "@/data/site-data"

function GlobalStyle() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `${pageStyles}\nhtml, body { overflow-x: hidden; max-width: 100%; }`,
      }}
    />
  )
}

type PageState = "checking" | "missing" | "found"

/* ────────────────────────────────────────────────────────────────── */
/*  The counterpart to /register/[slug]/page.tsx for orgs with multiple   */
/*  active forms: resolves one specific form by org slug + form slug,     */
/*  via getRegistrationFormBySlug (which already requires is_active =     */
/*  true), and renders it with the same RegistrationFormView used          */
/*  everywhere else — so behavior (open/closed, caps, banner, ?type=       */
/*  locking, etc.) stays identical to the single-form path.                */
/*                                                                          */
/*  RegistrationFormView reads the ?type= query param via                  */
/*  useSearchParams(), which Next.js requires to sit inside a <Suspense>   */
/*  boundary — otherwise `next build` fails. That's the only reason for    */
/*  the wrapper below.                                                     */
/* ────────────────────────────────────────────────────────────────── */

export default function RegisterFormPage() {
  const params = useParams<{ slug: string; formSlug: string }>()
  const [state, setState] = useState<PageState>("checking")
  const [org, setOrg] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [form, setForm] = useState<RegistrationForm | null>(null)

  useEffect(() => {
    if (!params?.slug || !params?.formSlug) return
    getRegistrationFormBySlug(params.slug, params.formSlug).then((result) => {
      if (!result) {
        setState("missing")
        return
      }
      setOrg(result.org)
      setForm(result.form)
      setState("found")
    })
  }, [params?.slug, params?.formSlug])

  if (state === "checking") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <p className="text-gray-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      </main>
    )
  }

  if (state === "missing" || !org || !form) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <div className="bg-black/50 border border-gold/20 rounded-lg p-8 max-w-xl w-full mx-auto text-center">
          <AlertCircle className="h-6 w-6 text-gold mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white font-cinzel mb-2">Registration link not found</h1>
          <p className="text-gray-400 text-sm">
            This link may have been deactivated, or double-check it with the organizer.
          </p>
        </div>
      </main>
    )
  }

  return (
    <Suspense fallback={null}>
      <RegistrationFormView org={org} form={form} />
    </Suspense>
  )
}