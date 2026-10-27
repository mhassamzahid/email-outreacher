"use client"

import Link from "next/link"
import { useState } from "react"
import { ExternalLink, MailCheck, Newspaper, Search, UserPlus, UserSearch } from "lucide-react"
import { toast } from "sonner"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { IcpSearchDialog } from "@/components/people/icp-search-dialog"
import { PostsSheet } from "@/components/people/posts-sheet"
import { Pill, type PillTone } from "@/components/status"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  type ApiPost,
  type Stakeholder,
  addAsLeads,
  fetchAllStakeholders,
  fetchCompanies,
  fetchIcps,
  fetchLeadPosts,
  fetchPosts,
  revealStakeholders,
  useApi,
} from "@/lib/api"
import { formatUsd, shortDate } from "@/lib/format"
import { useStore } from "@/lib/store"

const MAX_REVEAL = 25
const MAX_FETCH = 25
// Apify: about $2 per 1,000 LinkedIn posts and up to $2.70 per 1,000 Instagram posts.
const COST_PER_POST = 0.0027

function emailCell(s: Stakeholder): { text: string; tone: PillTone } {
  if (!s.revealedAt) {
    if (s.source === "apify_linkedin") return { text: "Not looked up", tone: "neutral" }
    return s.hasEmail ? { text: "Has email", tone: "info" } : { text: "No email on file", tone: "neutral" }
  }
  if (s.emailStatus === "no_match") return { text: "No match", tone: "neutral" }
  if (!s.email) return { text: "No email found", tone: "neutral" }
  return { text: s.emailStatus ?? "Email", tone: s.emailStatus === "verified" ? "positive" : "warning" }
}

/** Unrevealed Apollo people only have a masked name and no contact, so they need revealing first. */
const canBeLead = (s: Stakeholder) => !s.leadId && !!(s.linkedinUrl || s.email) && !(s.source === "apollo" && !s.revealedAt)

/** Everyone found for this workspace, by company, ICP or LinkedIn, and turning them into leads with posts. */
export function PeopleView() {
  const { currentWorkspaceId, workspaces } = useStore()
  const workspace = workspaces.find((w) => w.id === currentWorkspaceId)
  return (
    <>
      <PageHeader
        title="People"
        description={`Stakeholders found for ${workspace?.name ?? "this workspace"}. Make them leads, fetch their posts, and reveal emails.`}
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
  // Names for people found through a company search; the rest carry their employer's name as found.
  const companies = useApi(() => fetchCompanies(wsId, "inWorkspace"), [wsId])
  const posts = useApi(() => fetchPosts(wsId), [wsId])
  const [query, setQuery] = useState("")
  const [foundBy, setFoundBy] = useState("all")
  const [status, setStatus] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [confirmingReveal, setConfirmingReveal] = useState(false)
  const [fetchingPosts, setFetchingPosts] = useState(false)
  const [busy, setBusy] = useState("")
  const [reading, setReading] = useState<Stakeholder | null>(null)

  const list = people.data ?? []
  const icpName = new Map((icps.data ?? []).map((i) => [i.id, i.name]))
  const companyName = new Map((companies.data ?? []).map((c) => [c.id, c.name]))
  const company = (s: Stakeholder) => (s.companyId && companyName.get(s.companyId)) || s.organizationName || "—"
  const postsByLead = new Map<string, ApiPost[]>()
  for (const p of posts.data ?? []) postsByLead.set(p.leadId, [...(postsByLead.get(p.leadId) ?? []), p])

  const q = query.trim().toLowerCase()
  const visible = list.filter(
    (s) =>
      (foundBy === "all" ||
        (foundBy === "company" ? s.source === "apollo" && !s.icpId : foundBy === "linkedin" ? s.source === "apify_linkedin" : s.icpId === foundBy)) &&
      (status === "all" ||
        (status === "lead" ? !!s.leadId : status === "revealed" ? !!s.revealedAt : !s.revealedAt)) &&
      (!q || `${s.firstName} ${s.lastName} ${s.title} ${company(s)} ${s.email ?? ""}`.toLowerCase().includes(q)),
  )
  const picked = list.filter((s) => selected.has(s.id))
  const toReveal = picked.filter((s) => !s.revealedAt)
  const toAdd = picked.filter(canBeLead)
  const withLead = picked.filter((s) => s.leadId)
  const allChecked = visible.length > 0 && visible.every((s) => selected.has(s.id))

  const toggle = (id: string, on: boolean) =>
    setSelected((set) => {
      const next = new Set(set)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const reveal = async () => {
    setBusy("reveal")
    try {
      const r = await revealStakeholders(wsId, toReveal.map((s) => s.id))
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
      setBusy("")
    }
  }

  const addLeads = async () => {
    setBusy("add")
    try {
      const r = await addAsLeads(wsId, toAdd.map((s) => s.id))
      toast.success(`${r.added} added as ${r.added === 1 ? "a lead" : "leads"}`, {
        description: r.linkedExisting ? `${r.linkedExisting} were already leads and are now linked.` : undefined,
      })
      setSelected(new Set())
      people.reload()
    } catch (e) {
      toast.error("Couldn't add them", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy("")
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
        <Select value={foundBy} onValueChange={setFoundBy}>
          <SelectTrigger aria-label="Filter by how they were found" className="w-52!">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Found any way</SelectItem>
            <SelectItem value="company">Apollo company search</SelectItem>
            <SelectItem value="linkedin">LinkedIn (Apify)</SelectItem>
            {(icps.data ?? []).map((i) => (
              <SelectItem key={i.id} value={i.id}>
                ICP: {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by status" className="w-44!">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="hidden">Email not revealed</SelectItem>
            <SelectItem value="revealed">Email revealed</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="ml-auto" disabled={!icps.data?.length} onClick={() => setSearching(true)}>
          <UserSearch /> Search Apollo by ICP
        </Button>
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm tabular-nums">{picked.length} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!toAdd.length || !!busy} onClick={() => void addLeads()}>
              <UserPlus /> {busy === "add" ? "Adding…" : `Add ${toAdd.length} as leads`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!withLead.length || withLead.length > MAX_FETCH || !!busy}
              title={withLead.length > MAX_FETCH ? `Fetch posts for up to ${MAX_FETCH} leads at a time` : undefined}
              onClick={() => setFetchingPosts(true)}
            >
              <Newspaper /> Fetch posts for {withLead.length}
            </Button>
            <Button
              size="sm"
              disabled={!toReveal.length || toReveal.length > MAX_REVEAL || !!busy}
              title={toReveal.length > MAX_REVEAL ? `Reveal up to ${MAX_REVEAL} at a time` : undefined}
              onClick={() => setConfirmingReveal(true)}
            >
              <MailCheck /> {busy === "reveal" ? "Revealing…" : `Reveal ${toReveal.length} ${toReveal.length === 1 ? "email" : "emails"}`}
            </Button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title="Nobody found yet"
          description="Search Apollo by one of your ICPs, or find people at a company (Apollo or LinkedIn) on the Companies page."
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
                    aria-label="Select all shown"
                    checked={allChecked}
                    onCheckedChange={(v) =>
                      setSelected((set) => {
                        const next = new Set(set)
                        visible.forEach((s) => (v === true ? next.add(s.id) : next.delete(s.id)))
                        return next
                      })
                    }
                  />
                </TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Found by</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Found</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => {
                const cell = emailCell(s)
                const leadPosts = s.leadId ? (postsByLead.get(s.leadId) ?? []) : []
                return (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => toggle(s.id, !selected.has(s.id))}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`Select ${s.firstName}`}
                        checked={selected.has(s.id)}
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
                      {s.source === "apify_linkedin" ? (
                        <Pill tone="info">LinkedIn</Pill>
                      ) : s.icpId ? (
                        <Pill>ICP: {icpName.get(s.icpId) ?? "deleted ICP"}</Pill>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">Apollo, by company</span>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {s.leadId ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <Pill tone="positive">Lead</Pill>
                          <button
                            type="button"
                            className="text-xs text-data hover:underline tabular-nums"
                            onClick={() => setReading(s)}
                          >
                            {leadPosts.length ? `${leadPosts.length} ${leadPosts.length === 1 ? "post" : "posts"}` : "No posts yet"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">—</span>
                      )}
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
          initialIcpId={icps.data.some((i) => i.id === foundBy) ? foundBy : undefined}
          onClose={() => setSearching(false)}
          onFound={people.reload}
        />
      )}
      {fetchingPosts && (
        <FetchPostsDialog
          wsId={wsId}
          people={withLead}
          onClose={() => setFetchingPosts(false)}
          onDone={() => {
            setSelected(new Set())
            posts.reload()
          }}
        />
      )}
      {reading && (
        <PostsSheet
          name={`${reading.firstName} ${reading.lastName}`.trim()}
          posts={reading.leadId ? (postsByLead.get(reading.leadId) ?? []) : []}
          loading={posts.loading && !posts.data}
          onClose={() => setReading(null)}
        />
      )}
      <ConfirmDialog
        open={confirmingReveal}
        onOpenChange={setConfirmingReveal}
        title={`Reveal ${toReveal.length} ${toReveal.length === 1 ? "email" : "emails"}?`}
        description="This uses Apollo credits: about 1 per person whose email comes back, and none when Apollo has no match. Revealed people are added as leads, and are never charged for twice."
        confirmLabel={`Reveal ${toReveal.length}`}
        onConfirm={() => void reveal()}
      />
    </>
  )
}

/** Choose how many posts and how far back, see the most it can cost, then fetch. */
function FetchPostsDialog({
  wsId,
  people,
  onClose,
  onDone,
}: {
  wsId: string
  people: Stakeholder[]
  onClose: () => void
  onDone: () => void
}) {
  const [maxPosts, setMaxPosts] = useState("5")
  const [days, setDays] = useState("60")
  const [running, setRunning] = useState(false)
  const n = Number(maxPosts)
  const d = Number(days)
  const bad = !(Number.isInteger(n) && n >= 1 && n <= 20) || !(Number.isInteger(d) && d >= 1 && d <= 365)
  // Each lead can have a LinkedIn and an Instagram source.
  const ceiling = people.length * n * 2 * COST_PER_POST

  const run = async () => {
    setRunning(true)
    try {
      const r = await fetchLeadPosts(wsId, { leadIds: people.map((s) => s.leadId!), maxPosts: n, maxAgeDays: d })
      const found = r.results.reduce((sum, x) => sum + (x.linkedin ?? 0) + (x.instagram ?? 0), 0)
      const fresh = r.results.reduce((sum, x) => sum + x.new, 0)
      const noSource = r.results.filter((x) => x.linkedin === null && x.instagram === null).length
      if (r.error) toast.error("Apify refused", { description: r.error })
      else
        toast.success(`${found} ${found === 1 ? "post" : "posts"} found, ${fresh} new`, {
          description:
            [r.costUsd ? `Apify charged ${formatUsd(r.costUsd)}.` : "", noSource ? `${noSource} had no LinkedIn or Instagram to read.` : ""]
              .filter(Boolean)
              .join(" ") || undefined,
        })
      onDone()
      onClose()
    } catch (e) {
      toast.error("Couldn't fetch posts", { description: e instanceof Error ? e.message : undefined })
      setRunning(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="sm:max-w-md!">
        <DialogHeader>
          <DialogTitle>
            Fetch posts for {people.length} {people.length === 1 ? "lead" : "leads"}
          </DialogTitle>
          <DialogDescription>
            Their LinkedIn posts, and Instagram posts from their own account or their company&apos;s (already found by
            Lead Intel). Fetched through Apify, paid per post.
          </DialogDescription>
        </DialogHeader>
        <form
          id="fetch-posts"
          className="grid grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!bad) void run()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="posts-max">Posts per source</Label>
            <Input id="posts-max" type="number" inputMode="numeric" value={maxPosts} onChange={(e) => setMaxPosts(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="posts-days">From the last (days)</Label>
            <Input id="posts-days" type="number" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <p className={bad ? "col-span-2 text-xs text-destructive" : "col-span-2 text-xs text-muted-foreground tabular-nums"}>
            {bad ? "Posts: 1 to 20. Days: 1 to 365." : `At most about ${formatUsd(ceiling)}, if every lead has both sources and that many posts.`}
          </p>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={running}>
            Cancel
          </Button>
          <Button type="submit" form="fetch-posts" disabled={running || bad}>
            <Newspaper /> {running ? "Fetching… this can take a minute" : "Fetch posts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
