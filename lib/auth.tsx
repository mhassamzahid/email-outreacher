"use client"

import type { Session } from "@supabase/supabase-js"
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { fetchMe } from "./api"
import { supabase } from "./supabase"
import type { User } from "./types"

interface Auth {
  /** undefined while the saved session is being read. */
  session: Session | null | undefined
  /** This app's record of the signed-in person: role and workspaces. null until loaded. */
  me: User | null
  meError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  reloadMe: () => void
}

const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  // Kept with the account they belong to, so a different (or no) account never shows a stale one.
  const [loaded, setLoaded] = useState<{ for: string; me: User | null; error: string | null } | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  // Who they are here follows the account, not each token refresh.
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let live = true
    fetchMe()
      .then((u) => live && setLoaded({ for: userId, me: u, error: null }))
      .catch(
        (e: unknown) =>
          live && setLoaded({ for: userId, me: null, error: e instanceof Error ? e.message : "Couldn't load your account." }),
      )
    return () => {
      live = false
    }
  }, [userId, tick])
  const current = loaded && loaded.for === userId ? loaded : null
  const me = current?.me ?? null
  const meError = current?.error ?? null

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const reloadMe = useCallback(() => setTick((t) => t + 1), [])

  return (
    <AuthContext.Provider value={{ session, me, meError, signIn, signOut, reloadMe }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
