import type { Settings, User } from "./types"

// Starting values for what isn't stored in the backend yet: the browser-side settings and the user.

/** The AheadTech360 row in outreach.eo_workspaces. */
export const SEED_WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID ?? ""

export const DEFAULT_SETTINGS: Settings = {
  defaultModel: "claude-haiku-5-5",
  postsPerLead: 5,
  maxPostAgeDays: 60,
  monthlyBudgetUsd: 150,
  scoring: { promptId: null, threshold: 80, autoSend: false, dailyAutoSendCap: 50 },
}

export const CURRENT_USER_ID = "usr_me"

/** Until login exists, the person using the app is the one admin. */
export const DEFAULT_USERS: User[] = [
  {
    id: CURRENT_USER_ID,
    name: "You",
    email: "",
    role: "admin",
    workspaceIds: [SEED_WORKSPACE_ID],
    status: "active",
    lastActiveAt: null,
    createdAt: new Date().toISOString(),
  },
]
