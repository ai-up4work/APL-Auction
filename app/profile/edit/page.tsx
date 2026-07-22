"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import EditProfileForm from "@/components/profile/edit-profile-form"
import AccountSettings from "@/components/profile/account-settings"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { useAuth } from "@/context/AuthContext"
import { getOrCreateProfile } from "@/lib/profile"
import { Loading } from "@/components/ui/loading"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import SectionDivider from "@/components/section-divider"
import { pageStyles } from "@/data/site-data"
import type { Profile } from "@/types/user"

export default function EditProfileClientPage() {
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

  if (authLoading || profileLoading) {
    return <Loading label="Loading your profile…" variant="full" />
  }

  if (!user || !profile) {
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
                  <EditProfileForm profile={profile} userId={user.id} />
                </TabsContent>

                <TabsContent value="account" className="space-y-6">
                  <AccountSettings userId={user.id} email={user.email ?? ""} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}