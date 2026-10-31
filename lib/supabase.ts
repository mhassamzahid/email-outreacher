"use client"

import { createClient } from "@supabase/supabase-js"

// Supabase Auth, for signing in only. Accounts are made by admins on the Users page (there's no sign-up),
// and the session lives in this browser. The data itself always goes through our backend.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""

export const authConfigured = Boolean(url && key)

export const supabase = createClient(url || "http://localhost", key || "missing", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** The current session's access token, refreshed when it's close to expiring. */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
