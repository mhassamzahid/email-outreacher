"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ChevronRight, DatabaseZap, Search } from "lucide-react"
import { toast } from "sonner"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { CompanyName, InstagramCell, Location, TierPill } from "@/components/companies/company-cells"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Pill } from "@/components/status"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchCompanies, fetchIcps, importCompanies, useApi } from "@/lib/api"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const NO_ICP = "__none__"

/** Pick Lead Intel companies, filtered by Lead Intel's ICPs, and pull them into the current workspace. */
export function ImportView({ initialIcp }: { initialIcp: string }) {
  const router = useRouter()
  const { currentWorkspaceId, workspaces } = useStore()
  const workspace = workspaces.find((w) => w.id === currentWorkspaceId)
  const wsId = currentWorkspaceId || null

  const icps = useApi(fetchIcps, [])
  const companies = useApi(() => (wsId ? fetchCompanies(wsId) : Promise.resolve([])), [wsId])
  const [icp, setIcp] = useState(initialIcp)
  const [query, setQuery] = useState("")
  const [hideImported, setHideImported] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const all = companies.data ?? []
  const knownIcp = icp === "all" || icp === NO_ICP || !icps.data || icps.data.some((i) => i.id === icp)
  const activeIcp = knownIcp ? icp : "all"
  const inIcp = (id: string) => all.filter((c) => (id === "all" ? true : id === NO_ICP ? c.icpId === null : c.icpId === id))

  const q = query.trim().toLowerCase()
  const visible = inIcp(activeIcp).filter(
    (c) =>
      (!hideImported || !c.importedAt) && (!q || `${c.name} ${c.domain ?? ""} ${c.city ?? ""}`.toLowerCase().includes(q)),
  )
  const importable = visible.filter((c) => !c.importedAt)
  const allChecked = importable.length > 0 && importable.every((c) => selected.has(c.id))

  const chips = [
    { id: "all", label: "All ICPs" },
    ...(icps.data ?? []).map((i) => ({ id: i.id, label: i.name })),
    { id: NO_ICP, label: "No ICP matched" },
  ]

  const run = async () => {
    if (!wsId) return
    setBusy(true)
    try {
      const result = await importCompanies(wsId, [...selected])
      toast.success(`Imported ${result.imported} ${result.imported === 1 ? "company" : "companies"} into ${workspace?.name}`, {
        description:
          [
            result.alreadyInWorkspace ? `${result.alreadyInWorkspace} were already there.` : "",
            result.notFound.length ? `${result.notFound.length} are no longer contactable in Lead Intel and were skipped.` : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      })
      router.push(activeIcp !== "all" && activeIcp !== NO_ICP ? `/companies?icp=${activeIcp}` : "/companies")
    } catch (e) {
      toast.error("Couldn't import", { description: e instanceof Error ? e.message : undefined })
      setBusy(false)
    }
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1.5">
            <Link href="/companies" className="text-muted-foreground hover:text-foreground">
              Companies
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            Import from Lead Intel
          </span>
        }
        description="Companies Lead Intel has already found and checked. Excluded and do-not-contact businesses are never listed, and Lead Intel itself is only read, never changed."
        actions={
          wsId && (
            <>
              <Button variant="outline" asChild>
                <Link href="/companies">Cancel</Link>
              </Button>
              <Button disabled={selected.size === 0 || busy} onClick={() => void run()}>
                <DatabaseZap /> {busy ? "Importing…" : `Import ${selected.size || ""} ${selected.size === 1 ? "company" : "companies"}`}
              </Button>
            </>
          )
        }
      />
      <div className="space-y-4 px-4 pb-10 md:px-8">
        {!wsId ? (
          <WorkspaceGate>{() => null}</WorkspaceGate>
        ) : companies.error && !companies.data ? (
          <BackendError message={companies.error} onRetry={companies.reload} />
        ) : companies.loading && !companies.data ? (
          <TableSkeleton rows={6} />
        ) : (
          <>
            <div role="group" aria-label="Filter by Lead Intel ICP" className="flex flex-wrap gap-1.5">
              {chips.map((chip) => {
                const total = inIcp(chip.id).length
                const fresh = inIcp(chip.id).filter((c) => !c.importedAt).length
                const active = activeIcp === chip.id
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setIcp(chip.id)
                      setSelected(new Set())
                    }}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      active
                        ? "border-data bg-data/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                    title={`${total} in Lead Intel, ${fresh} not in this workspace yet`}
                  >
                    {chip.label}
                    <span className="tabular-nums opacity-70">{fresh}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search Lead Intel companies"
                  placeholder="Search name, domain or city"
                  className="pl-8"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                <Checkbox checked={hideImported} onCheckedChange={(v) => setHideImported(v === true)} />
                Hide companies already in {workspace?.name}
              </Label>
              <div className="flex items-center gap-1 sm:ml-auto">
                <p className="text-sm text-muted-foreground tabular-nums">
                  {selected.size ? `${selected.size} of ${importable.length} selected` : `${importable.length} can be imported`}
                </p>
                {selected.size < importable.length && importable.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected((s) => new Set([...s, ...importable.map((c) => c.id)]))}
                  >
                    Select all {importable.length}
                  </Button>
                )}
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={DatabaseZap}
                title={inIcp(activeIcp).length && hideImported ? "Everything here is already imported" : "No companies match"}
                description={
                  inIcp(activeIcp).length && hideImported
                    ? `Every company in this ICP is already in ${workspace?.name}.`
                    : "Try another ICP or search."
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
                          disabled={importable.length === 0}
                          onCheckedChange={(v) =>
                            setSelected((s) => {
                              const next = new Set(s)
                              importable.forEach((c) => (v === true ? next.add(c.id) : next.delete(c.id)))
                              return next
                            })
                          }
                        />
                      </TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Lead Intel ICP</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Instagram</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((c) => {
                      const already = !!c.importedAt
                      const checked = selected.has(c.id)
                      return (
                        <TableRow
                          key={c.id}
                          data-state={checked ? "selected" : undefined}
                          className={cn(!already && "cursor-pointer", already && "text-muted-foreground")}
                          onClick={() => !already && toggle(c.id, !checked)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              aria-label={`Select ${c.name}`}
                              checked={already || checked}
                              disabled={already}
                              onCheckedChange={(v) => toggle(c.id, v === true)}
                            />
                          </TableCell>
                          <TableCell className="max-w-64">
                            <div className="flex items-center gap-2">
                              <CompanyName company={c} />
                              {already && <Pill tone="info">In workspace</Pill>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Location company={c} />
                          </TableCell>
                          <TableCell>
                            {c.icpName ? <Pill>{c.icpName}</Pill> : <span className="text-[13px] text-muted-foreground">None</span>}
                          </TableCell>
                          <TableCell>
                            <TierPill tier={c.tier} />
                          </TableCell>
                          <TableCell>
                            <InstagramCell company={c} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
