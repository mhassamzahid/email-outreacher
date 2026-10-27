"use client"

import Link from "next/link"
import { useState } from "react"
import { ExternalLink, MailCheck, Search, UserSearch } from "lucide-react"
import { toast } from "sonner"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { IcpSearchDialog } from "@/components/people/icp-search-dialog"
import { Pill, type PillTone } from "@/components/status"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { type Stakeholder, fetchAllStakeholders, fetchCompanies, fetchIcps, revealStakeholders, useApi } from "@/lib/api"
import { shortDate } from "@/lib/format"
import { useStore } from "@/lib/store"

const MAX_REVEAL = 25

function emailCell(s: Stakeholder): { text: string; tone: PillTone } {
  if (!s.revealedAt) return s.hasEmail ? { text: "Has email", tone: "info" } : { text: "No email on file", tone: "neutral" }
  if (s.emailStatus === "no_match") return { text: "No match", tone: "neutral" }
  if (!s.email) return { text: "No email found", tone: "neutral" }
  return { text: s.emailStatus ?? "Email", tone: s.emailStatus === "verified" ? "positive" : "warning" }
}

/** Everyone Apollo found for this workspace, by company or by ICP, and revealing their emails. */
export function PeopleView() {
  const { currentWorkspaceId, workspaces } = useStore()
  const workspace = workspaces.find((w) => w.id === currentWorkspaceId)
  return (
    <>
      <PageHeader
        title="People"
        description={`Stakeholders found in Apollo for ${workspace?.name ?? "this workspace"}. Revealing someone's email adds them as a lead.`}
      />
      <div className="space-y-4 px-4 pb-10 md:px-8">
        <WorkspaceGate>{(wsId) => <PeopleList key={wsId} wsId={wsId} />}</WorkspaceGate>
      </div>
    </>
  )
}

function PeopleList({ wsId }: { wsId: string }) {
  const people = useApi(() => fetchAllStakeholders(wsId), [wsId])
  const icps = useApi(() => fetchIcps(wsId), [wsId])
  // Names for people found through a company search; the rest carry Apollo's company name.
  const companies = useApi(() => fetchCompanies(wsId, "inWorkspace"), [wsId])
  const [query, setQuery] = useState("")
  const [icpFilter, setIcpFilter] = useState("all")
  const [status, setStatus] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const list = people.data ?? []
  const icpName = new Map((icps.data ?? []).map((i) => [i.id, i.name]))
  const companyName = new Map((companies.data ?? []).map((c) => [c.id, c.name]))
  const company = (s: Stakeholder) => (s.companyId && companyName.get(s.companyId)) || s.organizationName || "—"

  const q = query.trim().toLowerCase()
  const visible = list.filter(
    (s) =>
      (icpFilter === "all" || (icpFilter === "company" ? !s.icpId : s.icpId === icpFilter)) &&
      (status === "all" || (status === "revealed" ? !!s.revealedAt : !s.revealedAt)) &&
      (!q || `${s.firstName} ${s.lastName} ${s.title} ${company(s)} ${s.email ?? ""}`.toLowerCase().includes(q)),
  )
  const revealable = visible.filter((s) => !s.revealedAt)
  const picked = list.filter((s) => selected.has(s.id) && !s.revealedAt)
  const allChecked = revealable.length > 0 && revealable.every((s) => selected.has(s.id))

  const toggle = (id: string, on: boolean) =>
    setSelected((set) => {
      const next = new Set(set)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const reveal = async () => {
    setBusy(true)
    try {
      const r = await revealStakeholders(wsId, picked.map((s) => s.id))
      if (r.error) toast.error("Apollo refused", { description: r.error })
      const leads = r.outcomes.filter((o) => o.leadCreated).length
      const noMatch = r.outcomes.filter((o) => o.status === "no_match").length
      if (r.revealed || noMatch)
        toast.success(`Revealed ${r.revealed} ${r.revealed === 1 ? "person" : "people"}`, {
          description:
            [leads ? `${leads} added as leads.` : "", noMatch ? `${noMatch} had no match (no credits used).` : ""]
              .filter(Boolean)
              .join(" ") || undefined,
        })
      setSelected(new Set())
      people.reload()
    } catch (e) {
      toast.error("Couldn't reveal", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  if (people.error && !people.data) return <BackendError message={people.error} onRetry={people.reload} />
  if (people.loading && !people.data) return <TableSkeleton rows={6} />

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search people"
            placeholder="Search name, title or company"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={icpFilter} onValueChange={setIcpFilter}>
          <SelectTrigger aria-label="Filter by how they were found" className="w-52!">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Found any way</SelectItem>
            <SelectItem value="company">By company search</SelectItem>
            {(icps.data ?? []).map((i) => (
              <SelectItem key={i.id} value={i.id}>
                ICP: {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by email" className="w-44!">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any email status</SelectItem>
            <SelectItem value="hidden">Not revealed yet</SelectItem>
            <SelectItem value="revealed">Revealed</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {picked.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy || picked.length > MAX_REVEAL}
              title={picked.length > MAX_REVEAL ? `Reveal up to ${MAX_REVEAL} at a time` : undefined}
              onClick={() => setConfirming(true)}
            >
              <MailCheck /> {busy ? "Revealing…" : `Reveal ${picked.length} ${picked.length === 1 ? "email" : "emails"}`}
            </Button>
          )}
          <Button size="sm" disabled={!icps.data?.length} onClick={() => setSearching(true)}>
            <UserSearch /> Search Apollo by ICP
          </Button>
        </div>
      </div>
      {picked.length > MAX_REVEAL && (
        <p className="text-sm text-destructive">Reveal up to {MAX_REVEAL} people at a time; {picked.length} are ticked.</p>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title="Nobody found yet"
          description="Search Apollo by one of your ICPs, or find people at a company on the Companies page."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button disabled={!icps.data?.length} onClick={() => setSearching(true)}>
                <UserSearch /> Search Apollo by ICP
              </Button>
              <Button variant="outline" asChild>
                <Link href="/companies">Go to Companies</Link>
              </Button>
            </div>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title="Nobody matches" description="Try another filter or search." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all not yet revealed"
                    checked={allChecked}
                    disabled={revealable.length === 0}
                    onCheckedChange={(v) =>
                      setSelected((set) => {
                        const next = new Set(set)
                        revealable.forEach((s) => (v === true ? next.add(s.id) : next.delete(s.id)))
                        return next
                      })
                    }
                  />
                </TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Found by</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Found</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => {
                const cell = emailCell(s)
                return (
                  <TableRow key={s.id} className={s.revealedAt ? undefined : "cursor-pointer"} onClick={() => !s.revealedAt && toggle(s.id, !selected.has(s.id))}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`Select ${s.firstName}`}
                        checked={!!s.revealedAt || selected.has(s.id)}
                        disabled={!!s.revealedAt}
                        onCheckedChange={(v) => toggle(s.id, v === true)}
                      />
                    </TableCell>
                    <TableCell className="max-w-64">
                      <p className="truncate font-medium">
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="truncate text-[13px] text-muted-foreground">{s.title || "No title"}</p>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{company(s)}</TableCell>
                    <TableCell>
                      {s.icpId ? (
                        <Pill>ICP: {icpName.get(s.icpId) ?? "deleted ICP"}</Pill>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">Company search</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-start gap-0.5">
                        <Pill tone={cell.tone} className="capitalize">
                          {cell.text}
                        </Pill>
                        {s.email && <span className="text-[13px]">{s.email}</span>}
                        {s.linkedinUrl && (
                          <a
                            href={s.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-xs hover:underline"
                          >
                            LinkedIn <ExternalLink className="size-3" aria-hidden />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{shortDate(s.foundAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {searching && icps.data && (
        <IcpSearchDialog
          workspaceId={wsId}
          icps={icps.data}
          initialIcpId={icpFilter !== "all" && icpFilter !== "company" ? icpFilter : undefined}
          onClose={() => setSearching(false)}
          onFound={people.reload}
        />
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Reveal ${picked.length} ${picked.length === 1 ? "email" : "emails"}?`}
        description="This uses Apollo credits: about 1 per person whose email comes back, and none when Apollo has no match. Revealed people are added as leads, and are never charged for twice."
        confirmLabel={`Reveal ${picked.length}`}
        onConfirm={() => void reveal()}
      />
    </>
  )
}
