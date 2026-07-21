"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import EditProfileForm from "@/components/profile/edit-profile-form"
import AccountSettings from "@/components/profile/account-settings"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import SectionDivider from "@/components/section-divider"
import { pageStyles } from "@/data/site-data"
// import { getOrCreateProfile } from "@/app/actions/profile-actions"
import type { Profile } from "@/types/user"

// Hardcoded profile/user data — swap this out for the real server action
// (getOrCreateProfile) and useSession() once they're wired back up.
const MOCK_USER_ID = "mock-user-id"
const MOCK_USER_EMAIL = "user@example.com"

const MOCK_PROFILE: Profile = {
  id: MOCK_USER_ID,
  userId: MOCK_USER_ID,
  username: "Safnas-Kaldeen",
  displayName: "Safnas-K",
  bio: "This is my bio.",
  profileImage: "/default-avatar.png",
  profileBanner: '/images/website-background.png',
  updatedAt: new Date().toISOString(),
}

export default function EditProfileClientPage() {
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
            <div className="mb-6">
              <Link href="/profile">
                <Button variant="ghost" className="text-gray-300 hover:text-gold">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Profile
                </Button>
              </Link>
            </div>

            <div className="bg-black/50 border border-gold/20 rounded-lg overflow-hidden glow-effect fade-in-up">
              <div className="p-6 border-b border-gold/20">
                <h1 className="text-2xl font-bold text-white font-cinzel">
                  Edit <span className="text-gold">Profile</span>
                </h1>
              </div>

              <Tabs defaultValue="profile" className="p-6">
                <TabsList className="bg-black/50 border border-gold/20 p-1 rounded-lg mb-6">
                  <TabsTrigger
                    value="profile"
                    className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-6 py-2 rounded-md transition-all duration-300"
                  >
                    Profile
                  </TabsTrigger>
                  <TabsTrigger
                    value="account"
                    className="data-[state=active]:bg-gold data-[state=active]:text-black font-cinzel relative px-6 py-2 rounded-md transition-all duration-300"
                  >
                    Account Settings
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6">
                  <EditProfileForm profile={profile} userId={MOCK_USER_ID} />
                </TabsContent>

                <TabsContent value="account" className="space-y-6">
                  <AccountSettings userId={MOCK_USER_ID} email={MOCK_USER_EMAIL} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />
    </main>
  )
}