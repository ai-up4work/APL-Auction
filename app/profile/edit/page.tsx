"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import EditProfileForm from "@/components/profile/edit-profile-form"
import AccountSettings from "@/components/profile/account-settings"
import SectionDivider from "@/components/section-divider"
// import { getOrCreateProfile } from "@/app/actions/profile-actions"
import type { Profile } from "@/types/user"

// Hardcoded profile/user data — swap this out for the real server action
// (getOrCreateProfile) and useSession() once they're wired back up.
const MOCK_USER_ID = "mock-user-id"
const MOCK_USER_EMAIL = "user@example.com"

const MOCK_PROFILE: Profile = {
  id: MOCK_USER_ID,
  username: "User",
  displayName: "User",
  bio: "This is my bio.",
  avatarUrl: "/images/default-avatar.png",
  profileImage: null,
  profileBanner: null,
}

export default function EditProfileClientPage() {
  const profile = MOCK_PROFILE

  return (
    <main className="page-transition">
      <div className="fixed inset-0 z-[-1]">
        <Image
          src="/images/website-background.png"
          alt="The Wardens Background"
          fill
          className="object-cover object-center"
          priority
        />
      </div>
      <section className="py-32 relative">
        <div className="absolute inset-0 z-0 bg-black/80"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Link href="/profile">
                <Button variant="ghost" className="text-gray-300 hover:text-wardens-gold">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Profile
                </Button>
              </Link>
            </div>

            <div className="bg-black/50 border border-wardens-gold/20 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-wardens-gold/20">
                <h1 className="text-2xl font-bold text-white font-cinzel">
                  Edit <span className="text-wardens-gold">Profile</span>
                </h1>
              </div>

              <Tabs defaultValue="profile" className="p-6">
                <TabsList className="bg-black/50 border border-wardens-gold/20 p-1 rounded-lg mb-6">
                  <TabsTrigger
                    value="profile"
                    className="data-[state=active]:bg-wardens-gold data-[state=active]:text-black tab-header relative px-6 py-2 rounded-md transition-all duration-300"
                  >
                    Profile
                  </TabsTrigger>
                  <TabsTrigger
                    value="account"
                    className="data-[state=active]:bg-wardens-gold data-[state=active]:text-black tab-header relative px-6 py-2 rounded-md transition-all duration-300"
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