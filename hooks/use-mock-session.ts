"use client"

// Mock replacement for next-auth's useSession, matching the same
// return shape so swapping back to the real hook later is a one-line change.
// Delete this file and restore `import { useSession } from "next-auth/react"`
// once auth is wired back up.

const MOCK_USER_ID = "mock-user-id"
const MOCK_USER_EMAIL = "user@example.com"

export interface MockSession {
  user: {
    id: string
    email: string
    name: string
  }
}

export function useSession(): { data: MockSession | null; status: "authenticated" | "unauthenticated" | "loading" } {
  return {
    data: {
      user: {
        id: MOCK_USER_ID,
        email: MOCK_USER_EMAIL,
        name: "User",
      },
    },
    status: "authenticated",
  }
}