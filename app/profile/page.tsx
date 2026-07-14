"use client"

import Image from "next/image"
import ProfileHeader from "@/components/profile/profile-header"
import ProfileBio from "@/components/profile/profile-bio"
import SectionDivider from "@/components/section-divider"
import type { Profile } from "@/types/user"

// Hardcoded profile data — swap this out for the real server action
// (getOrCreateProfile) and useSession() once they're wired back up.
const MOCK_USER_ID = "mock-user-id"

const MOCK_PROFILE: Profile = {
  id: MOCK_USER_ID,
  username: "User",
  displayName: "User",
  bio: "This is my bio.",
  avatarUrl: "/images/default-avatar.png",
  profileImage: null,
  profileBanner: null,
}

export default function ProfileClientPage() {
  const profile = MOCK_PROFILE

  const refreshProfile = async () => {
    // No-op: profile data is hardcoded, nothing to refresh.
  }

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
            <ProfileHeader profile={profile} isOwnProfile={true} onRefresh={refreshProfile} />
            <div className="mt-8 grid grid-cols-1 gap-8">
              <ProfileBio profile={profile} />
            </div>
          </div>
        </div>
      </section>
      <SectionDivider />
    </main>
  )
}