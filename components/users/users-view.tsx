"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  Check,
  FolderPlus,
  MoreHorizontal,
  PencilLine,
  Search,
  Send,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react"
import { toast } from "sonner"
import { BackendError } from "@/components/companies/backend-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Pill, type PillTone } from "@/components/status"
import { TableSkeleton } from "@/components/table-skeleton"
import { UserAvatar } from "@/components/users/user-avatar"
import { UserDialog } from "@/components/users/user-dialog"
import { WorkspaceDialog } from "@/components/users/workspace-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { daysSince, shortDate } from "@/lib/format"
import { PERMISSIONS, ROLE_ACCESS, ROLE_LABEL, USER_STATUS_LABEL, otherActiveAdmins } from "@/lib/roles"
import { useStore } from "@/lib/store"
import { ROLES, type Role, type User, type UserStatus, type Workspace } from "@/lib/types"
import { cn } from "@/lib/utils"

export type UsersTab = "users" | "workspaces" | "roles"

const STATUS_TONE: Record<UserStatus, PillTone> = { active: "positive", invited: "info", deactivated: "neutral" }

function lastActive(user: User): string {
  if (user.status === "invited") return "Hasn't signed in"
  if (!user.lastActiveAt) return "Never"
  const d = daysSince(user.lastActiveAt)
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`
}

export function UsersView({ initialTab }: { initialTab: UsersTab }) {
  const router = useRouter()
  const { users, workspaces, currentWorkspaceId } = useStore()
  const [tab, setTab] = useState<UsersTab>(initialTab)
  const [inviting, setInviting] = useState(false)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)

  const pending = users.filter((u) => u.status === "invited").length
  const current = workspaces.find((w) => w.id === currentWorkspaceId)

  const changeTab = (next: string) => {
    setTab(next as UsersTab)
    router.replace(next === "users" ? "/users" : `/users?tab=${next}`, { scroll: false })
  }

  return (
    <>
      <PageHeader
        title="Users"
        description={`${users.length} users across ${workspaces.length} workspaces${pending ? ` · ${pending} invite${pending === 1 ? "" : "s"} pending` : ""}. You're in ${current?.name}.`}
        actions={
          tab === "workspaces" ? (
            <Button onClick={() => setCreatingWorkspace(true)}>
              <FolderPlus /> Create workspace
            </Button>
          ) : (
            <Button onClick={() => setInviting(true)}>
              <UserPlus /> Invite user
            </Button>
          )
        }
      />
      <div className="px-4 pb-10 md:px-8">
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList>
            <TabsTrigger value="users">
              Users <span className="text-muted-foreground tabular-nums">{users.length}</span>
            </TabsTrigger>
            <TabsTrigger value="workspaces">
              Workspaces <span className="text-muted-foreground tabular-nums">{workspaces.length}</span>
            </TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="pt-3">
            <UsersTable onInvite={() => setInviting(true)} />
          </TabsContent>
          <TabsContent value="workspaces" className="pt-3">
            <WorkspacesTable onCreate={() => setCreatingWorkspace(true)} />
          </TabsContent>
          <TabsContent value="roles" className="pt-3">
            <RolesMatrix />
          </TabsContent>
        </Tabs>
      </div>

      {inviting && <UserDialog onClose={() => setInviting(false)} />}
      {creatingWorkspace && <WorkspaceDialog onClose={() => setCreatingWorkspace(false)} />}
    </>
  )
}

function UsersTable({ onInvite }: { onInvite: () => void }) {
  const { users, workspaces, currentUserId, updateUser, removeUser } = useStore()
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all")
  const [editing, setEditing] = useState<{ user: User; role?: Role } | null>(null)
  const [removing, setRemoving] = useState<User | null>(null)

  const q = query.trim().toLowerCase()
  const shown = users.filter(
    (u) =>
      (roleFilter === "all" || u.role === roleFilter) &&
      (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
  )
  const wsName = (id: string) => workspaces.find((w) => w.id === id)?.name

  /** Why this user's role or access can't be reduced, or "" when it can. */
  const protectedReason = (u: User) =>
    u.id === currentUserId
      ? "This is you."
      : u.role === "admin" && otherActiveAdmins(users, u.id) === 0
        ? "They're the only active admin."
        : ""

  const changeRole = (u: User, role: Role) => {
    // An admin had every workspace; moving them to Sales or Management means choosing which they keep.
    if (u.role === "admin" && role !== "admin") return setEditing({ user: u, role })
    // Admins open every workspace, so promoting someone gives them all of them.
    updateUser(u.id, role === "admin" ? { role, workspaceIds: workspaces.map((w) => w.id) } : { role })
    toast.success(`${u.name} is now ${ROLE_LABEL[role]}`)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
            className="pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | "all")}>
          <SelectTrigger className="w-40" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]} ({users.filter((u) => u.role === r).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={users.length ? "No users match" : "No users yet"}
          description={users.length ? "Try another name, email or role." : "Invite your team to review and send drafts."}
          action={
            users.length ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("")
                  setRoleFilter("all")
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={onInvite}>
                <UserPlus /> Invite user
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="w-44">Role</TableHead>
                <TableHead>Workspaces</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((u) => {
                const locked = protectedReason(u)
                const isSelf = u.id === currentUserId
                return (
                  <TableRow key={u.id} className={cn(u.status === "deactivated" && "text-muted-foreground")}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar name={u.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {u.name}
                            {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                          </p>
                          <p className="truncate text-[13px] text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(r) => changeRole(u, r as Role)}>
                        <SelectTrigger
                          size="sm"
                          className="w-36"
                          aria-label={`Role for ${u.name}`}
                          disabled={!!locked}
                          title={locked ? `${locked} Role can't be lowered.` : undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.role === "admin" ? (
                        <span className="text-[13px] text-muted-foreground">All workspaces</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.workspaceIds.slice(0, 2).map((id) => (
                            <Pill key={id}>{wsName(id)}</Pill>
                          ))}
                          {u.workspaceIds.length > 2 && (
                            <span title={u.workspaceIds.slice(2).map(wsName).join(", ")}>
                              <Pill>+{u.workspaceIds.length - 2}</Pill>
                            </span>
                          )}
                          {u.workspaceIds.length === 0 && (
                            <span title="They can sign in but can't open anything. Edit them to add a workspace.">
                              <Pill tone="warning">No workspaces</Pill>
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Pill tone={STATUS_TONE[u.status]}>{USER_STATUS_LABEL[u.status]}</Pill>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{lastActive(u)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onSelect={() => setEditing({ user: u })}>
                            <PencilLine /> Edit role and workspaces
                          </DropdownMenuItem>
                          {u.status === "invited" && (
                            <DropdownMenuItem onSelect={() => toast.success(`Invite sent again to ${u.email}`)}>
                              <Send /> Resend invite
                            </DropdownMenuItem>
                          )}
                          {u.status === "deactivated" ? (
                            <DropdownMenuItem
                              onSelect={() => {
                                updateUser(u.id, { status: "active" })
                                toast.success(`Reactivated ${u.name}`)
                              }}
                            >
                              <UserCheck /> Reactivate
                            </DropdownMenuItem>
                          ) : (
                            u.status === "active" && (
                              <DropdownMenuItem
                                disabled={!!locked}
                                onSelect={() => {
                                  updateUser(u.id, { status: "deactivated" })
                                  toast.success(`Deactivated ${u.name}`, { description: "They can't sign in until reactivated." })
                                }}
                              >
                                <UserMinus /> Deactivate
                              </DropdownMenuItem>
                            )
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" disabled={!!locked} onSelect={() => setRemoving(u)}>
                            <Trash2 /> {u.status === "invited" ? "Cancel invite" : "Remove user"}
                          </DropdownMenuItem>
                          {locked && <p className="px-2 pb-1.5 text-xs text-muted-foreground">{locked}</p>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && <UserDialog user={editing.user} initialRole={editing.role} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        destructive
        title={removing ? (removing.status === "invited" ? `Cancel ${removing.name}'s invite?` : `Remove ${removing.name}?`) : ""}
        description={
          removing?.status === "invited"
            ? "The invite link stops working. You can invite them again later."
            : "They lose access to every workspace. Drafts they edited and emails they sent are kept. To keep them on file, deactivate instead."
        }
        confirmLabel={removing?.status === "invited" ? "Cancel invite" : "Remove user"}
        onConfirm={() => {
          if (!removing) return
          removeUser(removing.id)
          toast.success(removing.status === "invited" ? `Cancelled ${removing.name}'s invite` : `Removed ${removing.name}`)
          setRemoving(null)
        }}
      />
    </div>
  )
}

function WorkspacesTable({ onCreate }: { onCreate: () => void }) {
  const {
    users,
    workspaces,
    workspacesStatus,
    workspacesError,
    reloadWorkspaces,
    currentWorkspaceId,
    setCurrentWorkspace,
    deleteWorkspace,
  } = useStore()
  const [editing, setEditing] = useState<Workspace | null>(null)
  const [deleting, setDeleting] = useState<Workspace | null>(null)

  const members = (id: string) => users.filter((u) => u.status !== "deactivated" && u.workspaceIds.includes(id))
  // Sales and Management users for whom this is their only workspace: deleting it leaves them with none.
  const stranded = (id: string) =>
    users.filter((u) => u.role !== "admin" && u.status !== "deactivated" && u.workspaceIds.length === 1 && u.workspaceIds[0] === id)
  const lockReason = (w: Workspace) =>
    w.id === currentWorkspaceId ? "You're in it. Switch to another workspace first." : workspaces.length === 1 ? "It's the only workspace." : ""

  if (workspacesStatus === "error") return <BackendError message={workspacesError ?? ""} onRetry={reloadWorkspaces} />
  if (workspacesStatus === "loading") return <TableSkeleton rows={3} />
  if (!workspaces.length)
    return (
      <EmptyState
        icon={FolderPlus}
        title="No workspaces"
        action={
          <Button onClick={onCreate}>
            <FolderPlus /> Create workspace
          </Button>
        }
      />
    )

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaces.map((w) => {
              const list = members(w.id)
              const isCurrent = w.id === currentWorkspaceId
              const locked = lockReason(w)
              return (
                <TableRow key={w.id}>
                  <TableCell className="max-w-md">
                    <p className="font-medium">
                      {w.name}
                      {isCurrent && (
                        <Badge variant="secondary" className="ml-2">
                          Current
                        </Badge>
                      )}
                    </p>
                    {w.description && <p className="truncate text-[13px] text-muted-foreground">{w.description}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex -space-x-1.5">
                        {list.slice(0, 4).map((u) => (
                          <UserAvatar key={u.id} name={u.name} className="size-6 text-[10px] ring-2 ring-background" />
                        ))}
                      </div>
                      <span className="text-[13px] text-muted-foreground tabular-nums" title={list.map((u) => u.name).join(", ")}>
                        {list.length} {list.length === 1 ? "member" : "members"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{shortDate(w.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${w.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        {!isCurrent && (
                          <DropdownMenuItem
                            onSelect={() => {
                              setCurrentWorkspace(w.id)
                              toast.success(`Switched to ${w.name}`)
                            }}
                          >
                            <Check /> Switch to this workspace
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setEditing(w)}>
                          <PencilLine /> Edit name and members
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" disabled={!!locked} onSelect={() => setDeleting(w)}>
                          <Trash2 /> Delete workspace
                        </DropdownMenuItem>
                        {locked && <p className="px-2 pb-1.5 text-xs text-muted-foreground">Can&apos;t delete: {locked}</p>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {editing && <WorkspaceDialog workspace={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title={deleting ? `Delete ${deleting.name}?` : ""}
        description={
          <>
            Its ICPs, leads, drafts and prompts are deleted for everyone, and members lose access. This can&apos;t be undone.
            {deleting && stranded(deleting.id).length > 0 && (
              <span className="mt-2 block text-warning">
                {stranded(deleting.id).map((u) => u.name).join(", ")}{" "}
                {stranded(deleting.id).length === 1 ? "has" : "have"} no other workspace and won&apos;t be able to open anything
                until you give them one.
              </span>
            )}
          </>
        }
        confirmLabel="Delete workspace"
        onConfirm={() => {
          if (!deleting) return
          const target = deleting
          setDeleting(null)
          deleteWorkspace(target.id).then(
            () => toast.success(`Deleted ${target.name}`),
            (e: unknown) => toast.error(`Couldn't delete ${target.name}`, { description: e instanceof Error ? e.message : undefined }),
          )
        }}
      />
    </>
  )
}

function RolesMatrix() {
  const { users } = useStore()
  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-sm text-muted-foreground">
        What each role can do in the workspaces they belong to. Roles apply across every workspace a person can open.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-64">Permission</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="w-32 text-center">
                  {ROLE_LABEL[r]}
                  <span className="ml-1 font-normal text-muted-foreground tabular-nums">
                    {users.filter((u) => u.role === r && u.status !== "deactivated").length}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                Workspace access
                <p className="text-xs text-muted-foreground">Sales and Management only see workspaces an admin gives them.</p>
              </TableCell>
              {ROLES.map((r) => (
                <TableCell key={r} className="text-center text-[13px] text-muted-foreground">
                  {ROLE_ACCESS[r]}
                </TableCell>
              ))}
            </TableRow>
            {PERMISSIONS.map(({ group, items }) => (
              <PermissionGroup key={group} group={group} items={items} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function PermissionGroup({ group, items }: (typeof PERMISSIONS)[number]) {
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={ROLES.length + 1} className="py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {group}
        </TableCell>
      </TableRow>
      {items.map(({ label, roles }) => (
        <TableRow key={label}>
          <TableCell>{label}</TableCell>
          {ROLES.map((r) => (
            <TableCell key={r} className="text-center">
              {roles.includes(r) ? (
                <Check className="mx-auto size-4 text-data" aria-label="Allowed" />
              ) : (
                <span className="text-muted-foreground/60" aria-label="Not allowed">
                  –
                </span>
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
