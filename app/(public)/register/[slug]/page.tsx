// app/(public)/register/[slug]/page.tsx
"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Loader2, AlertCircle, Trophy, ArrowRight } from "lucide-react"
import {
  getOrgBySlugForRegistration,
  getActiveRegistrationFormsForOrg,
  type RegistrationForm,
} from "@/lib/organization/registrations"
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

type PageState = "checking" | "missing" | "empty" | "single" | "list"

/* ────────────────────────────────────────────────────────────────── */
/*  An org can have zero, one, or many active registration forms. This   */
/*  route adapts: zero → "not accepting registrations" message, one →    */
/*  render that form directly (no extra click), many → show a simple    */
/*  picker linking to /register/[slug]/[formSlug] for each one.          */
/*                                                                        */
/*  RegistrationFormView now reads the ?type= query param via             */
/*  useSearchParams(), which Next.js requires to sit inside a <Suspense>  */
/*  boundary — otherwise `next build` fails. That's the only reason for   */
/*  the wrapper below; nothing else about this page changed.              */
/* ────────────────────────────────────────────────────────────────── */

export default function RegisterOrgPage() {
  const params = useParams<{ slug: string }>()
  const [state, setState] = useState<PageState>("checking")
  const [org, setOrg] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [forms, setForms] = useState<RegistrationForm[]>([])

  useEffect(() => {
    if (!params?.slug) return
    getOrgBySlugForRegistration(params.slug).then(async (o) => {
      if (!o) {
        setState("missing")
        return
      }
      setOrg(o)
      const active = await getActiveRegistrationFormsForOrg(o.id)
      setForms(active)
      setState(active.length === 0 ? "empty" : active.length === 1 ? "single" : "list")
    })
  }, [params?.slug])

  if (state === "checking") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <p className="text-gray-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </p>
      </main>
    )
  }

  if (state === "missing" || !org) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <div className="bg-black/50 border border-gold/20 rounded-lg p-8 max-w-xl w-full mx-auto text-center">
          <AlertCircle className="h-6 w-6 text-gold mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white font-cinzel mb-2">Registration link not found</h1>
          <p className="text-gray-400 text-sm">Double-check the link with the organizer.</p>
        </div>
      </main>
    )
  }

  if (state === "empty") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <GlobalStyle />
        <div className="bg-black/50 border border-gold/20 rounded-lg p-8 max-w-xl w-full mx-auto text-center">
          <AlertCircle className="h-6 w-6 text-gold mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white font-cinzel mb-2">No open registration</h1>
          <p className="text-gray-400 text-sm">{org.name} isn't accepting registrations right now — check back later.</p>
        </div>
      </main>
    )
  }

  if (state === "single") {
    return (
      <Suspense fallback={null}>
        <RegistrationFormView org={org} form={forms[0]} />
      </Suspense>
    )
  }

  return (
    <main className="min-h-screen bg-black px-4 py-12">
      <GlobalStyle />
      <div className="max-w-xl mx-auto mb-8 text-center">
        <span className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
          <Trophy className="w-3.5 h-3.5" /> {org.name}
        </span>
        <h1 className="text-2xl font-bold text-white font-cinzel">Choose a registration</h1>
      </div>
      <div className="max-w-xl mx-auto space-y-3">
        {forms.map((f) => (
          <Link
            key={f.id}
            href={`/register/${org.slug}/${f.slug}`}
            className="flex items-center justify-between gap-3 bg-black/50 border border-gold/20 hover:border-gold/50 rounded-lg px-5 py-4 transition-colors"
          >
            <span className="text-white font-cinzel font-semibold">{f.name}</span>
            <ArrowRight className="h-4 w-4 text-gold shrink-0" />
          </Link>
        ))}
      </div>
    </main>
  )
}