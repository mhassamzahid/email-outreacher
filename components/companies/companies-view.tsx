"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Building2, DatabaseZap, MoreHorizontal, PanelRightOpen, Search, Trash2, UserSearch } from "lucide-react"
import { toast } from "sonner"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { CompanyName, IcpPill, InstagramCell, Location, TierPill } from "@/components/companies/company-cells"
import { CompanySheet } from "@/components/companies/company-sheet"
import { FindStakeholdersDialog } from "@/components/companies/find-stakeholders-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { type ApiCompany, fetchCompanies, fetchIcps, fetchStakeholders, removeCompanies, useApi } from "@/lib/api"
import { shortDate } from "@/lib/format"
import { useStore } from "@/lib/store"

const NO_ICP = "__none__"

/** The companies in the current workspace, read from the backend (Lead Intel, read-only). */
export function CompaniesView({ initialIcp }: { initialIcp: string }) {
  const { currentWorkspaceId, workspaces } = useStore()
  const workspace = workspaces.find((w) => w.id === currentWorkspaceId)

  return (
    <>
      <PageHeader
        title="Companies"
        description={`Companies in ${workspace?.name ?? "this workspace"}, from Lead Intel. Their website and Instagram data come with them.`}
        actions={
          workspace && (
            <Button asChild>
              <Link href={initialIcp !== "all" && initialIcp !== NO_ICP ? `/companies/import?icp=${initialIcp}` : "/companies/import"}>
                <DatabaseZap /> Import from Lead Intel
              </Link>
            </Button>
          )
        }
      />
      <div className="space-y-4 px-4 pb-10 md:px-8">
        <WorkspaceGate>{(wsId) => <CompaniesList key={wsId} wsId={wsId} initialIcp={initialIcp} />}</WorkspaceGate>
      </div>
    </>
  )
}

function CompaniesList({ wsId, initialIcp }: { wsId: string; initialIcp: string }) {
  const router = useRouter()
  const icps = useApi(fetchIcps, [])
  const companies = useApi(() => fetchCompanies(wsId, "inWorkspace"), [wsId])
  const [query, setQuery] = useState("")
  const [icp, setIcp] = useState(initialIcp)
  const [instagram, setInstagram] = useState("any")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<ApiCompany | null>(null)
  const [removing, setRemoving] = useState<ApiCompany[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [finding, setFinding] = useState<ApiCompany[] | null>(null)
  // Bumped after a stakeholder search so the People column and the open panel reload.
  const [peopleVersion, setPeopleVersion] = useState(0)
  const people = useApi(() => fetchStakeholders(wsId), [wsId, peopleVersion])
  const peopleBy = new Map<string, { found: number; revealed: number }>()
  for (const p of people.data ?? []) {
    if (!p.companyId) continue
    const n = peopleBy.get(p.companyId) ?? { found: 0, revealed: 0 }
    n.found++
    if (p.revealedAt && p.email) n.revealed++
    peopleBy.set(p.companyId, n)
  }

  const mine = companies.data ?? []
  // An ICP id in the URL that Lead Intel doesn't have falls back to all ICPs.
  const knownIcp = icp === "all" || icp === NO_ICP || !icps.data || icps.data.some((i) => i.id === icp)
  const activeIcp = knownIcp ? icp : "all"

  const q = query.trim().toLowerCase()
  const visible = mine.filter(
    (c) =>
      (activeIcp === "all" || (activeIcp === NO_ICP ? c.icpId === null : c.icpId === activeIcp)) &&
      (instagram === "any" || (instagram === "yes") === !!c.instagram.handle) &&
      (!q || `${c.name} ${c.domain ?? ""} ${c.city ?? ""} ${c.instagram.handle ?? ""}`.toLowerCase().includes(q)),
  )
  const allChecked = visible.length > 0 && visible.every((c) => selected.has(c.id))

  const changeIcp = (value: string) => {
    setIcp(value)
    setSelected(new Set())
    router.replace(value === "all" ? "/companies" : `/companies?icp=${value}`, { scroll: false })
  }
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const remove = async (list: ApiCompany[]) => {
    setBusy(true)
    try {
      const { removed } = await removeCompanies(wsId, list.map((c) => c.id))
      toast.success(removed === 1 ? `Removed ${list[0].name}` : `${removed} companies removed`)
      setSelected(new Set())
      setRemoving(null)
      companies.reload()
    } catch (e) {
      toast.error("Couldn't remove", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  if (companies.error && !companies.data) return <BackendError message={companies.error} onRetry={companies.reload} />
  if (companies.loading && !companies.data) return <TableSkeleton rows={6} />

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search companies"
            placeholder="Search name, domain or city"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={activeIcp} onValueChange={changeIcp}>
          <SelectTrigger aria-label="Filter by Lead Intel ICP" className="w-52!">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ICPs ({mine.length})</SelectItem>
            {(icps.data ?? []).map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name} ({mine.filter((c) => c.icpId === i.id).length})
              </SelectItem>
            ))}
            <SelectItem value={NO_ICP}>No ICP matched ({mine.filter((c) => c.icpId === null).length})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={instagram} onValueChange={setInstagram}>
          <SelectTrigger aria-label="Filter by Instagram" className="w-40!">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Instagram</SelectItem>
            <SelectItem value="yes">Has Instagram</SelectItem>
            <SelectItem value="no">No Instagram</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground tabular-nums">
          {visible.length === mine.length ? `${mine.length} companies` : `${visible.length} of ${mine.length}`}
        </p>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground tabular-nums">{selected.size} selected</span>
            <Button size="sm" onClick={() => setFinding(mine.filter((c) => selected.has(c.id)))}>
              <UserSearch /> Find stakeholders
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRemoving(mine.filter((c) => selected.has(c.id)))}>
              <Trash2 /> Remove
            </Button>
          </div>
        )}
      </div>

      {mine.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies in this workspace yet"
          description="Pull them in from Lead Intel. They're already found and checked, so nothing is scraped again."
          action={
            <Button asChild>
              <Link href="/companies/import">
                <DatabaseZap /> Import from Lead Intel
              </Link>
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No companies match"
          description="Try another ICP or search."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setInstagram("any")
                changeIcp("all")
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all shown"
                    checked={allChecked}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(visible.map((c) => c.id)) : new Set())}
                  />
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Lead Intel ICP</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Instagram</TableHead>
                <TableHead>People</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpen(c)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${c.name}`}
                      checked={selected.has(c.id)}
                      onCheckedChange={(v) => toggle(c.id, v === true)}
                    />
                  </TableCell>
                  <TableCell className="max-w-64">
                    <CompanyName company={c} />
                  </TableCell>
                  <TableCell>
                    <Location company={c} />
                  </TableCell>
                  <TableCell>
                    <IcpPill name={c.icpName} />
                  </TableCell>
                  <TableCell>
                    <TierPill tier={c.tier} />
                  </TableCell>
                  <TableCell>
                    <InstagramCell company={c} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[13px] tabular-nums">
                    {peopleBy.get(c.id) ? (
                      <>
                        {peopleBy.get(c.id)!.found} found
                        {peopleBy.get(c.id)!.revealed > 0 && (
                          <span className="text-muted-foreground"> · {peopleBy.get(c.id)!.revealed} with email</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {c.importedAt ? shortDate(c.importedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={() => setOpen(c)}>
                          <PanelRightOpen /> View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setFinding([c])}>
                          <UserSearch /> Find stakeholders
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setRemoving([c])}>
                          <Trash2 /> Remove from workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {open && (
        <CompanySheet
          company={open}
          workspaceId={wsId}
          stakeholdersVersion={peopleVersion}
          onFindStakeholders={() => setFinding([open])}
          onClose={() => setOpen(null)}
          onRemove={() => {
            setRemoving([open])
            setOpen(null)
          }}
        />
      )}
      {finding && (
        <FindStakeholdersDialog
          workspaceId={wsId}
          companies={finding}
          onClose={() => setFinding(null)}
          onDone={() => setPeopleVersion((v) => v + 1)}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && !busy && setRemoving(null)}
        title={removing?.length === 1 ? `Remove ${removing[0].name}?` : `Remove ${removing?.length} companies?`}
        description="They leave this workspace only. Lead Intel keeps them, and you can import them again any time."
        confirmLabel={busy ? "Removing…" : removing?.length === 1 ? "Remove company" : `Remove ${removing?.length} companies`}
        onConfirm={() => removing && void remove(removing)}
      />
    </>
  )
}
