"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, Download, Inbox, RefreshCw, Search, Send } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { ReviewPanel } from "@/components/review-panel"
import { GenerationProgress } from "@/components/run-dialogs"
import { SourceIcon } from "@/components/source-icon"
import { FlagBadges, GenerationStatusBadge, NoHookBadge, ScoreBadge } from "@/components/status"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMockLoading } from "@/hooks/use-mock-loading"
import { downloadCsv, toCsv } from "@/lib/csv"
import { firstLine, formatUsd, fullName, shortDate } from "@/lib/format"
import { estimateGenerationCost } from "@/lib/mock-actions"
import { generationByLead } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Generation, Lead } from "@/lib/types"

type Row = { lead: Lead; gen: Generation }

const LOW_CONFIDENCE = 60

type View = "review" | "approved" | "sent" | "skipped" | "all"

const VIEWS: { key: View; label: string }[] = [
  { key: "review", label: "To review" },
  { key: "approved", label: "Approved" },
  { key: "sent", label: "Sent" },
  { key: "skipped", label: "Skipped" },
  { key: "all", label: "All drafts" },
]

const pending = (g: Generation) => g.status === "draft" || g.status === "edited"
const inView = (g: Generation, v: View) => v === "all" || (v === "review" ? pending(g) : g.status === v)

function FilterToggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-7 rounded-full border px-3 text-[13px] transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        pressed ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

/**
 * Every generated email waiting on a decision. With an icpId it is that ICP's Review tab;
 * without one it is the global queue across ICPs, with an ICP filter.
 */
export function ReviewQueue({ icpId }: { icpId?: string }) {
  const { icps, leads, items, generations, settings, genJobs, setGenerationStatus, sendGenerations, startGeneration } = useStore()
  const loading = useMockLoading()
  const [view, setView] = useState<View>("review")
  const [icpFilter, setIcpFilter] = useState("all")
  const [lowConfidence, setLowConfidence] = useState(false)
  const [noHook, setNoHook] = useState(false)
  const [flagged, setFlagged] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [confirmThreshold, setConfirmThreshold] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [regenRows, setRegenRows] = useState<Row[] | null>(null)

  const global = !icpId
  const scope = icpId ?? (icpFilter === "all" ? null : icpFilter)
  const genMap = generationByLead(generations)
  const rows: Row[] = leads
    .filter((l) => (!scope || l.icpId === scope) && genMap.has(l.id))
    .map((lead) => ({ lead, gen: genMap.get(lead.id)! }))

  const visible = rows.filter(
    ({ gen }) =>
      inView(gen, view) &&
      (!lowConfidence || gen.confidence < LOW_CONFIDENCE) &&
      (!noHook || !gen.chosenItemId) &&
      (!flagged || gen.flags.length > 0),
  )

  const icpName = (id: string) => icps.find((i) => i.id === id)?.name ?? ""
  const itemById = new Map(items.map((it) => [it.id, it]))
  const selectedRows = rows.filter((r) => selected.has(r.lead.id))
  // One threshold for the whole workspace, set in Settings.
  const thresholdValue = settings.scoring.threshold
  const scoreOf = (r: Row) => r.lead.score?.value ?? -1
  // Bulk approval follows the auto-send rule: flagged drafts are always reviewed one by one.
  const aboveThreshold = rows.filter((r) => pending(r.gen) && scoreOf(r) >= thresholdValue && r.gen.flags.length === 0)
  const approved = rows.filter((r) => r.gen.status === "approved")
  const waiting = rows.filter((r) => pending(r.gen))
  const clearing = waiting.filter((r) => scoreOf(r) >= settings.scoring.threshold && r.gen.flags.length === 0)

  const openIndex = visible.findIndex((r) => r.lead.id === openLeadId)
  const openRow = rows.find((r) => r.lead.id === openLeadId)
  const openIcp = openRow && icps.find((i) => i.id === openRow.lead.icpId)

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.lead.id))
  const someVisibleSelected = visible.some((r) => selected.has(r.lead.id))
  const running = Object.values(genJobs).filter((j) => j.running && (!scope || j.icpId === scope))

  const approveRows = (target: Row[]) => {
    setGenerationStatus(target.map((r) => r.gen.id), "approved")
    setSelected(new Set())
    toast.success(`Approved ${target.length} email${target.length === 1 ? "" : "s"}`)
  }

  const exportApproved = () => {
    const csv = toCsv([
      ["email", "first_name", "company", "icp", "score", "subject", "body"],
      ...approved.map(({ lead, gen }) => [
        lead.email,
        lead.firstName,
        lead.company,
        icpName(lead.icpId),
        lead.score ? String(lead.score.value) : "",
        gen.subject,
        gen.editedBody ?? gen.body,
      ]),
    ])
    const name = scope ? icpName(scope).replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "all-icps"
    downloadCsv(`${name}-approved.csv`, csv)
    toast.success(`Exported ${approved.length} approved email${approved.length === 1 ? "" : "s"}`)
  }

  const regenerate = (target: Row[]) => {
    const byIcp = new Map<string, string[]>()
    for (const r of target) byIcp.set(r.lead.icpId, [...(byIcp.get(r.lead.icpId) ?? []), r.lead.id])
    for (const [id, leadIds] of byIcp) void startGeneration(id, leadIds, { reviewOnly: true })
    setSelected(new Set())
  }

  const move = (delta: number) => {
    if (visible.length === 0) return
    const from = openIndex === -1 ? (delta > 0 ? -1 : visible.length) : openIndex
    const next = Math.min(visible.length - 1, Math.max(0, from + delta))
    setOpenLeadId(visible[next].lead.id)
  }

  const clearFilters = () => {
    setView("all")
    setLowConfidence(false)
    setNoHook(false)
    setFlagged(false)
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        <span className="text-foreground tabular-nums">{waiting.length}</span> waiting for review ·{" "}
        <span className="text-foreground tabular-nums">{clearing.length}</span> score {settings.scoring.threshold} or more with no
        flags · auto-send is{" "}
        <span className={settings.scoring.autoSend ? "font-medium text-data" : "text-foreground"}>
          {settings.scoring.autoSend ? "on" : "off"}
        </span>{" "}
        ·{" "}
        <Link href="/settings#scoring" className="underline underline-offset-2 hover:text-foreground">
          Scoring settings
        </Link>
      </p>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:max-w-3xl sm:grid-cols-5" role="tablist" aria-label="Review views">
          {VIEWS.map((v) => {
            const count = rows.filter((r) => inView(r.gen, v.key)).length
            const active = view === v.key
            return (
              <button
                key={v.key}
                role="tab"
                aria-selected={active}
                onClick={() => setView(v.key)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                  active ? "border-data bg-data-soft/40 outline-1 -outline-offset-2 outline-data" : "hover:bg-muted/70",
                )}
              >
                <div className="text-[13px] text-muted-foreground">{v.label}</div>
                <div className="text-base font-semibold tabular-nums">{count}</div>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {approved.length > 0 && (
            <>
              <Button variant="outline" onClick={exportApproved}>
                <Download /> Export approved
              </Button>
              <Button variant="outline" onClick={() => setConfirmSend(true)}>
                <Send /> Send {approved.length} approved
              </Button>
            </>
          )}
          <Button
            disabled={aboveThreshold.length === 0}
            onClick={() => setConfirmThreshold(true)}
            title={`Threshold ${thresholdValue} is set in Settings`}
          >
            <Check /> Approve {aboveThreshold.length} at score ≥ {thresholdValue}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {global && (
          <Select value={icpFilter} onValueChange={setIcpFilter}>
            <SelectTrigger size="sm" aria-label="Filter by ICP" className="mr-2 w-52!">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ICPs</SelectItem>
              {icps.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="mr-1 text-[13px] text-muted-foreground">Show only</span>
        <FilterToggle pressed={lowConfidence} onClick={() => setLowConfidence(!lowConfidence)}>
          {`Low confidence (<${LOW_CONFIDENCE})`}
        </FilterToggle>
        <FilterToggle pressed={noHook} onClick={() => setNoHook(!noHook)}>
          No hook
        </FilterToggle>
        <FilterToggle pressed={flagged} onClick={() => setFlagged(!flagged)}>
          Flagged
        </FilterToggle>
        {selectedRows.length > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-lg bg-muted px-2 py-1">
            <span className="px-1 text-[13px] tabular-nums">{selectedRows.length} selected</span>
            <Button size="sm" onClick={() => approveRows(selectedRows.filter((r) => pending(r.gen)))}>
              Approve selected
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRegenRows(selectedRows)}>
              <RefreshCw /> Regenerate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {running.map((j) => (
        <GenerationProgress key={j.icpId} icpId={j.icpId} />
      ))}

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No generated emails yet"
          description="Enrich leads and generate emails from an ICP's Leads tab. Every draft is scored and lands here for review."
          action={
            <Button asChild variant="outline">
              <Link href={icpId ? `/icps/${icpId}/leads` : "/icps"}>{icpId ? "Go to leads" : "Go to ICPs"}</Link>
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title={view === "review" && !lowConfidence && !noHook && !flagged ? "Nothing waiting for review" : "No emails match these filters"}
          action={
            <Button variant="outline" onClick={clearFilters}>
              Show all drafts
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    aria-label="Select all"
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(visible.map((r) => r.lead.id)) : new Set())}
                  />
                </TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Hook</TableHead>
                <TableHead className="min-w-72">Draft</TableHead>
                <TableHead className="text-right" title={`Auto-send threshold: ${settings.scoring.threshold}`}>
                  Score
                </TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map(({ lead, gen }) => {
                const item = gen.chosenItemId ? itemById.get(gen.chosenItemId) : undefined
                return (
                  <TableRow
                    key={lead.id}
                    className={cn("cursor-pointer", openLeadId === lead.id && "bg-accent")}
                    data-state={selected.has(lead.id) ? "selected" : undefined}
                    onClick={() => setOpenLeadId(lead.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`Select ${fullName(lead)}`}
                        checked={selected.has(lead.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(selected)
                          if (v === true) next.add(lead.id)
                          else next.delete(lead.id)
                          setSelected(next)
                        }}
                      />
                    </TableCell>
                    <TableCell className="max-w-56">
                      <div className="truncate font-medium">{fullName(lead)}</div>
                      <div className="truncate text-[13px] text-muted-foreground">
                        {lead.company}
                        {global && ` · ${icpName(lead.icpId)}`}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item ? (
                        <span className="flex items-center gap-2 text-[13px] text-muted-foreground tabular-nums">
                          <SourceIcon source={item.source} />
                          {shortDate(item.postedAt)}
                        </span>
                      ) : (
                        <NoHookBadge />
                      )}
                    </TableCell>
                    <TableCell className="max-w-[26rem]">
                      <div className="truncate font-medium">{gen.subject}</div>
                      <div className="truncate text-[13px] text-muted-foreground">{firstLine(gen.editedBody ?? gen.body)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <ScoreBadge value={lead.score?.value} threshold={settings.scoring.threshold} />
                    </TableCell>
                    <TableCell>
                      <FlagBadges flags={gen.flags} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <GenerationStatusBadge status={gen.status} />
                      {gen.sentBy === "auto" && <span className="ml-1.5 text-xs text-muted-foreground">auto</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {openRow && openIcp && (
        <ReviewPanel
          key={openRow.gen.id}
          icp={openIcp}
          lead={openRow.lead}
          generation={openRow.gen}
          position={openIndex + 1 || 1}
          total={visible.length}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
          onClose={() => setOpenLeadId(null)}
        />
      )}

      <ConfirmDialog
        open={confirmThreshold}
        onOpenChange={setConfirmThreshold}
        title={`Approve ${aboveThreshold.length} emails?`}
        description={`Every draft scoring ${thresholdValue} or higher (your threshold in Settings) with no flags is marked approved. Flagged drafts stay in review. You can still change any of them afterwards.`}
        confirmLabel={`Approve ${aboveThreshold.length}`}
        onConfirm={() => approveRows(aboveThreshold)}
      />

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={`Send ${approved.length} approved email${approved.length === 1 ? "" : "s"}?`}
        description="They move to Sent. This prototype has no mail connection yet, so nothing actually leaves the app."
        confirmLabel={`Send ${approved.length}`}
        onConfirm={() => {
          sendGenerations(approved.map((r) => r.gen.id))
          toast.success(`Sent ${approved.length} email${approved.length === 1 ? "" : "s"}`)
        }}
      />

      <ConfirmDialog
        open={!!regenRows}
        onOpenChange={(o) => !o && setRegenRows(null)}
        title={`Regenerate ${regenRows?.length ?? 0} email${regenRows?.length === 1 ? "" : "s"}?`}
        description={`Each draft is rewritten and re-scored for about ${formatUsd(estimateGenerationCost(regenRows?.length ?? 0))} in total. Regenerated drafts stay in review and are never auto-sent.`}
        confirmLabel="Regenerate"
        onConfirm={() => {
          if (regenRows) regenerate(regenRows)
          setRegenRows(null)
        }}
      />
    </div>
  )
}
