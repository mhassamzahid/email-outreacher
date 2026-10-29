"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Centered } from "@/components/auth-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { EMAIL_PATTERN } from "@/lib/format"

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  )
}

/** Email and password. There's no sign-up: accounts are made in the Supabase dashboard. */
function Login() {
  const { session, signIn, sendReset } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/icps"
  const [mode, setMode] = useState<"sign-in" | "forgot">("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (session) router.replace(next)
  }, [session, next, router])

  const emailOk = EMAIL_PATTERN.test(email.trim())

  const submit = async () => {
    setError("")
    if (!emailOk) return setError("Enter your email, like name@company.com.")
    if (mode === "sign-in" && !password) return setError("Enter your password.")
    setBusy(true)
    try {
      if (mode === "sign-in") await signIn(email, password)
      else {
        await sendReset(email)
        setSent(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

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
          <h1 className="text-lg font-semibold">{mode === "sign-in" ? "Sign in to Outreacher" : "Reset your password"}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "sign-in"
              ? "Use the account an admin made for you."
              : "We'll email you a link to set a new password."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        {mode === "sign-in" && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setMode("forgot")
                  setError("")
                  setSent(false)
                }}
              >
                Forgot password?
              </button>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {sent && <p className="text-sm">If that email has an account, a reset link is on its way. Check your inbox.</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "One moment…" : mode === "sign-in" ? "Sign in" : "Email me a reset link"}
        </Button>
        {mode === "forgot" && (
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              setMode("sign-in")
              setError("")
            }}
          >
            Back to sign in
          </button>
        )}
      </form>
    </Centered>
  )
}
