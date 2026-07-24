// app/profile/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { useAuth } from "@/context/AuthContext"
import { getOrCreateProfile } from "@/lib/profile"
import { Loading } from "@/components/ui/loading"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import SectionDivider from "@/components/section-divider"
import ProfileHeader from "@/components/profile/profile-header"
import ProfileBio from "@/components/profile/profile-bio"
import { pageStyles } from "@/data/site-data"
import type { Profile } from "@/types/user"

export default function ProfileClientPage() {
  useScrollTop()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/auth/login")
      return
    }

    let cancelled = false
    setProfileLoading(true)
    getOrCreateProfile(user.id, user.email ?? "").then((p) => {
      if (!cancelled) {
        setProfile(p)
        setProfileLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, user, router])

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const refreshProfile = async () => {
    if (!user) return
    const updated = await getOrCreateProfile(user.id, user.email ?? "")
    setProfile(updated)
  }

  if (authLoading || profileLoading) {
    return <Loading label="Loading your profile…" variant="full" />
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-foreground/70">
          We couldn't load your profile. Check the browser console for details, or try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full border border-foreground/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/80 hover:border-primary hover:text-primary"
        >
          Retry
        </button>
      </main>
    )
  }

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="profile"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-20 sm:pt-40 pb-12 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto fade-in">
            <ProfileHeader profile={profile} isOwnProfile={true} onRefresh={refreshProfile} />
            <div className="mt-8 grid grid-cols-1 gap-8 fade-in-up">
              <ProfileBio profile={profile} />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}