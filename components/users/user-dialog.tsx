"use client"

import { useState } from "react"
import { toast } from "sonner"
import { RolePicker } from "@/components/users/role-picker"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EMAIL_PATTERN } from "@/lib/format"
import { ROLE_LABEL, otherActiveAdmins } from "@/lib/roles"
import { useStore } from "@/lib/store"
import type { Role, User } from "@/lib/types"

/** Add someone by email (their account is made in Supabase), or edit a user's name, role and workspaces. */
export function UserDialog({ user, initialRole, onClose }: { user?: User; initialRole?: Role; onClose: () => void }) {
  const { users, workspaces, currentUserId, currentWorkspaceId, inviteUser, updateUser } = useStore()
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [role, setRoleState] = useState<Role>(initialRole ?? user?.role ?? "sales")
  // An admin had every workspace by default, so moving them to Sales or Management starts from none
  // and the workspaces they keep are picked on purpose.
  const demoting = user?.role === "admin" && role !== "admin"
  const [workspaceIds, setWorkspaceIds] = useState<string[]>(
    user ? (user.role === "admin" && initialRole && initialRole !== "admin" ? [] : user.workspaceIds) : [currentWorkspaceId],
  )
  const setRole = (next: Role) => {
    if (user?.role === "admin" && role === "admin" && next !== "admin") setWorkspaceIds([])
    setRoleState(next)
  }
  const [touched, setTouched] = useState({ name: false, email: false })

  const isSelf = user?.id === currentUserId
  const lastAdmin = !!user && user.role === "admin" && otherActiveAdmins(users, user.id) === 0
  const emailTaken = !user && users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())

  const errors = {
    name: name.trim() ? "" : "Enter their name",
    email: !EMAIL_PATTERN.test(email.trim())
      ? "Enter a valid email, like name@company.com"
      : emailTaken
        ? "Someone with this email is already a user"
        : "",
    // Admins see every workspace, so there's nothing to choose.
    workspaces: role === "admin" || workspaceIds.length ? "" : "Pick at least one workspace",
  }
  const valid = !errors.name && !errors.email && !errors.workspaces
  const allWorkspaces = role === "admin"

  const submit = () => {
    if (!valid) {
      setTouched({ name: true, email: true })
      return
    }
    const ids = allWorkspaces ? workspaces.map((w) => w.id) : workspaceIds
    if (user) {
      updateUser(user.id, { name: name.trim(), role, workspaceIds: ids })
      toast.success(`Saved ${name.trim()}`)
    } else {
      inviteUser({ name, email, role, workspaceIds: ids })
      toast.success(`Added ${name.trim()}`, {
        description: "Now make their account in the Supabase dashboard (Authentication, Add user) with this email and a password.",
      })
    }
    onClose()
  }

  const toggleWorkspace = (id: string, on: boolean) =>
    setWorkspaceIds((ids) => (on ? [...ids, id] : ids.filter((w) => w !== id)))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg!">
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.name}` : "Add user"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Change their role and which workspaces they can open."
              : "Their role and workspaces are ready for their first sign-in. Make their account, with a password, in the Supabase dashboard."}
          </DialogDescription>
        </DialogHeader>
        <form
          id="user-form"
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={name}
                autoFocus
                aria-invalid={(touched.name && !!errors.name) || undefined}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                onChange={(e) => setName(e.target.value)}
              />
              {touched.name && errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Work email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                disabled={!!user}
                aria-invalid={(touched.email && !!errors.email) || undefined}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                onChange={(e) => setEmail(e.target.value)}
              />
              {touched.email && errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Role</p>
            <RolePicker
              value={role}
              onChange={setRole}
              disabled={(r) =>
                r === "admin"
                  ? undefined
                  : isSelf
                    ? "You can't remove your own admin access."
                    : lastAdmin
                      ? "They're the only active admin. Make someone else an admin first."
                      : undefined
              }
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Workspaces</legend>
            {!allWorkspaces && (
              <p className="text-[13px] text-muted-foreground">
                {demoting
                  ? `${user?.name} will only be able to open the workspaces you tick. Everything else is hidden from them.`
                  : `${ROLE_LABEL[role]} users only see the workspaces ticked here.`}
              </p>
            )}
            {allWorkspaces ? (
              <p className="text-[13px] text-muted-foreground">Admins can open every workspace, including ones created later.</p>
            ) : (
              <>
                <div className="divide-y divide-rule rounded-md border">
                  {workspaces.map((w) => (
                    <label key={w.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <Checkbox checked={workspaceIds.includes(w.id)} onCheckedChange={(v) => toggleWorkspace(w.id, v === true)} />
                      <span className="min-w-0">
                        <span className="block text-sm">{w.name}</span>
                        {w.description && <span className="block truncate text-xs text-muted-foreground">{w.description}</span>}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.workspaces && <p className="text-xs text-destructive">{errors.workspaces}</p>}
              </>
            )}
          </fieldset>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="user-form">
            {user ? "Save changes" : "Add user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
