import type { Session } from "@supabase/supabase-js"

// The accounts signed in on this browser, so you can switch between them without a password, the way
// Gmail does. Each keeps its own Supabase session (the same tokens Supabase already keeps in this
// browser for the current account). Signing out of one forgets it.

const KEY = "coldbrew.accounts"

export interface SavedAccount {
  userId: string
  email: string
  name: string
  accessToken: string
  refreshToken: string
  /** When it was last the current account; the most recent comes first. */
  lastUsed: number
}

function read(): SavedAccount[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(parsed) ? (parsed as SavedAccount[]).filter((a) => a?.userId && a.refreshToken) : []
  } catch {
    return []
  }
}

function write(accounts: SavedAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts))
  } catch {
    // Private windows can refuse storage; switching then just isn't remembered.
  }
}

/** The saved accounts, most recently used first. */
export function savedAccounts(): SavedAccount[] {
  return read().sort((a, b) => b.lastUsed - a.lastUsed)
}

/** Save or refresh the current account's session (called on every sign-in and token refresh). */
export function rememberSession(session: Session) {
  const others = read().filter((a) => a.userId !== session.user.id)
  const before = read().find((a) => a.userId === session.user.id)
  write([
    ...others,
    {
      userId: session.user.id,
      email: session.user.email ?? before?.email ?? "",
      name: before?.name ?? "",
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      lastUsed: Date.now(),
    },
  ])
}

/** Keep the account's display name once the backend has said who they are. */
export function rememberName(userId: string, name: string) {
  write(read().map((a) => (a.userId === userId ? { ...a, name } : a)))
}

export function forgetAccount(userId: string) {
  write(read().filter((a) => a.userId !== userId))
}
