"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface AccountSettingsProps {
  userId: string
  email: string
}

export default function AccountSettings({ userId, email }: AccountSettingsProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState("")

  const handleDeleteAccount = async () => {
    if (confirmDelete !== "DELETE") {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("Account deletion requested for user ID:", userId)
      setError("Account deletion is not available at this time.")
      setIsLoading(false)
    } catch (err: any) {
      console.error("Account deletion error:", err)
      setError(err.message || "Failed to delete account")
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive" className="bg-red-900/20 border-red-900 text-red-300">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-900/20 border-green-900 text-green-300">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" value={email} disabled className="bg-black/50 border-wardens-gold/30 text-white" />
        <p className="text-xs text-gray-400">To change your email, please contact support</p>
      </div>

      <div className="space-y-2">
        <Label>Password</Label>
        <Button
          variant="outline"
          className="w-full border-wardens-gold/30 text-wardens-gold hover:bg-wardens-gold/10 bg-transparent"
          onClick={() => router.push("/auth/reset-password")}
        >
          Change Password
        </Button>
      </div>

      <div className="border-t border-wardens-gold/20 pt-6 mt-6">
        <h3 className="text-xl font-bold text-white mb-4 font-cinzel">Danger Zone</h3>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              Delete Account
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border border-red-500/50">
            <DialogHeader>
              <DialogTitle className="text-red-500">Delete Account</DialogTitle>
              <DialogDescription className="text-gray-400">
                This action cannot be undone. This will permanently delete your account and remove your data from our
                servers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-white">
                To confirm, type <span className="font-bold">DELETE</span> in the field below:
              </p>
              <Input
                value={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.value)}
                className="bg-black/50 border-red-500/30 text-white"
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="text-gray-300">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={confirmDelete !== "DELETE" || isLoading}
              >
                {isLoading ? "Deleting..." : "Delete Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
