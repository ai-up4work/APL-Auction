// app/(protected)/organization/page.tsx
import type { Metadata } from "next"
import OrganizationClient from "@/components/organization/OrganizationClient"

export const metadata: Metadata = {
  title: "Organization | Valiant League",
  robots: { index: false, follow: false },
}

// Same reasoning as the match/tournament edit pages: reads happen through
// the Supabase JS client inside the client component (org id needs
// useAuth(), which only resolves in the browser), so this stays a thin
// server shell and everything meaningful is forced dynamic downstream.
export const dynamic = "force-dynamic"

export default function OrganizationPage() {
  return <OrganizationClient />
}