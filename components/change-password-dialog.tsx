"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

// Supabase's reasons, in words a person can act on.
function reason(error: { code?: string; message: string }): string {
  if (error.code === "same_password") return "That's your current password. Choose a different one."
  if (error.code === "weak_password") return `That password is too weak. ${error.message}`
  return error.message
}

/** Set a new password while signed in. It's the Supabase account's password, so Lead Intel changes too. */
export function ChangePasswordDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    setError("")
    if (password.length < 8) return setError("Use at least 8 characters.")
    if (password !== confirm) return setError("The two passwords don't match.")
    setBusy(true)
    const { error: failed } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (failed) return setError(reason(failed))
    toast.success("Password changed", { description: "Use it next time you sign in, here and in Lead Intel." })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md!">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>For {email}. Lead Intel uses the same account, so it changes there too.</DialogDescription>
        </DialogHeader>
        <form
          id="change-password"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">New password</Label>
            <Input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Type it again</Label>
            <Input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="change-password" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
