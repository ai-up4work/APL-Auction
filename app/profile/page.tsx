// app/profile/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import SectionDivider from "@/components/section-divider"
import ProfileHeader from "@/components/profile/profile-header"
import ProfileBio from "@/components/profile/profile-bio"
import { pageStyles } from "@/data/site-data"
import type { Profile } from "@/types/user"

// Hardcoded profile data — swap this out for the real server action
// (getOrCreateProfile) and useSession() once they're wired back up.
const MOCK_USER_ID = "mock-user-id"

const MOCK_PROFILE: Profile = {
  id: MOCK_USER_ID,
  userId: MOCK_USER_ID,
  username: "User",
  displayName: "User",
  bio: "This is my bio.",
  profileImage: "/default-avatar.png",
  profileBanner: '/images/website-background.png',
  updatedAt: new Date().toISOString(),
}

export default function ProfileClientPage() {
  useScrollTop()
  const router = useRouter()
  const [isNavOpen, setIsNavOpen] = useState(false)
  const profile = MOCK_PROFILE

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const refreshProfile = async () => {
    // No-op: profile data is hardcoded, nothing to refresh.
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

      <section className="pt-32 sm:pt-40 pb-16 relative section-pattern">
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

      <SectionDivider />
    </main>
  )
}