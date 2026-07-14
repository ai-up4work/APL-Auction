export type UserRole = "user" | "admin"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: string
}

export interface Profile {
  id: string
  userId: string
  displayName: string
  bio: string
  profileImage: string | null
  profileBanner: string | null
  updatedAt: string
}
