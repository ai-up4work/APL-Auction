import { Suspense } from "react"
import PublicMatchesClient from "@/components/landing/PublicMatchesClient"

export default function MatchesPage() {
  return (
    <Suspense fallback={null}>
      <PublicMatchesClient />
    </Suspense>
  )
}