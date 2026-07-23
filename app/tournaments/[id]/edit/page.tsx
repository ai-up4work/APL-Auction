// app/tournaments/[id]/edit/page.tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import TournamentEditClient from "@/components/tournament/tournament-edit-client"
import { getTournamentForEdit } from "@/lib/tournament/tournament"

interface EditTournamentPageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Edit Tournament | Valiant League",
  robots: { index: false, follow: false }, // editing surface, not for search engines
}

// Same reasoning as the public detail page: reads go through the Supabase
// JS client, not `fetch`, so this must be forced dynamic or a stale copy
// of the form could get served after a previous save.
export const dynamic = "force-dynamic"

export default async function EditTournamentPage({ params }: EditTournamentPageProps) {
  const { id } = await params
  const tournament = await getTournamentForEdit(id)

  if (!tournament) {
    notFound()
  }

  // Auth + org-membership check happens client-side in TournamentEditClient
  // (it needs useAuth(), which only resolves in the browser) — this server
  // fetch only confirms the tournament itself exists. RLS on `tournaments`
  // is still the actual security boundary; this page-level check just
  // avoids showing an editable form to someone who can't save it.
  return <TournamentEditClient tournament={tournament} />
}