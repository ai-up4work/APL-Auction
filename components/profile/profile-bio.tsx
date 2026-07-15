import type { Profile } from "@/types/user"

interface ProfileBioProps {
  profile: Profile
}

export default function ProfileBio({ profile }: ProfileBioProps) {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4 font-cinzel">ABOUT</h2>
      <div className="text-gray-300 whitespace-pre-line leading-relaxed">
        {profile.bio ? profile.bio : <span className="text-gray-500 italic">No bio provided</span>}
      </div>
    </div>
  )
}