"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Centered } from "@/components/auth-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

/** Where a password-reset email lands. Supabase signs the person in from the link; they pick a new password. */
export default function ResetPasswordPage() {
  const { session } = useAuth()
  const router = useRouter()
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
    if (failed) return setError(failed.message)
    router.replace("/icps")
  }

  if (session === undefined)
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Checking your link…</p>
      </Centered>
    )

  if (session === null)
    return (
      <Centered>
        <h1 className="text-lg font-semibold">This link has expired</h1>
        <p className="text-sm text-muted-foreground">Reset links work once and for a limited time. Ask for a new one from the sign-in page.</p>
        <Button variant="outline" onClick={() => router.replace("/login")}>
          Go to sign in
        </Button>
      </Centered>
    )

  return (
    <Centered>
      <form
        className="space-y-4 rounded-xl border bg-card p-6 text-left shadow-sm"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Set a new password</h1>
          <p className="text-sm text-muted-foreground">For {session.user.email}. It replaces the old one for Lead Intel too.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Type it again</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </Button>
      </form>
    </Centered>
  )
}
