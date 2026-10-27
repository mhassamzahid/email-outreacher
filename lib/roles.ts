import type { Role, User, UserStatus } from "./types"

export const ROLE_LABEL: Record<Role, string> = {
  sales: "Sales",
  management: "Management",
  admin: "Admin",
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  sales: "Reviews, approves and sends drafts, and adds leads, in the workspaces you pick.",
  management: "Everything Sales can do plus ICPs, prompts and paid runs, in the workspaces you pick.",
  admin: "Everything in every workspace, including users, budget and API connections.",
}

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  active: "Active",
  invited: "Invited",
  deactivated: "Deactivated",
}

/** Which workspaces each role can open. */
export const ROLE_ACCESS: Record<Role, string> = {
  sales: "Assigned only",
  management: "Assigned only",
  admin: "All workspaces",
}

/** What each role can do. Shown on the Roles tab; enforced by the backend once it exists. */
export const PERMISSIONS: { group: string; items: { label: string; roles: Role[] }[] }[] = [
  {
    group: "Outreach",
    items: [
      { label: "View ICPs, leads and drafts", roles: ["sales", "management", "admin"] },
      { label: "Edit, approve and skip drafts", roles: ["sales", "management", "admin"] },
      { label: "Send approved emails", roles: ["sales", "management", "admin"] },
      { label: "Add leads manually or from CSV", roles: ["sales", "management", "admin"] },
    ],
  },
  {
    group: "Campaign setup",
    items: [
      { label: "Create and edit ICPs", roles: ["management", "admin"] },
      { label: "Create and edit prompts", roles: ["management", "admin"] },
      { label: "Run enrichment and drafting (spends budget)", roles: ["management", "admin"] },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Change auto-send threshold and scoring", roles: ["admin"] },
      { label: "Set monthly budget and API connections", roles: ["admin"] },
      { label: "Invite users and change roles", roles: ["admin"] },
      { label: "Create and delete workspaces", roles: ["admin"] },
    ],
  },
]

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

/** Active admins other than this user. Used to stop the last admin being demoted or removed. */
export function otherActiveAdmins(users: User[], userId: string): number {
  return users.filter((u) => u.id !== userId && u.role === "admin" && u.status === "active").length
}
