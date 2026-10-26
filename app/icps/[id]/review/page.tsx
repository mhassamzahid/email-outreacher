"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, Download, Inbox, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { ReviewPanel } from "@/components/review-panel"
import { GenerateDialog, GenerationProgress } from "@/components/run-dialogs"
import { SourceIcon } from "@/components/source-icon"
import { ConfidenceBadge, FlagBadges, GenerationStatusBadge, NoHookBadge, RelevanceDots } from "@/components/status"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIcpParam } from "@/hooks/use-icp"
import { useMockLoading } from "@/hooks/use-mock-loading"
import { downloadCsv, toCsv } from "@/lib/csv"
import { GENERATION_STATUS_LABEL, firstLine, fullName, shortDate } from "@/lib/format"
import { generationByLead } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Generation, GenerationStatus, Lead } from "@/lib/types"

type Row = { lead: Lead; gen: Generation }

const LOW_CONFIDENCE = 60

function FilterToggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(pressed && "border-foreground/40 bg-muted")}
    >
      {children}
    </Button>
  )
}

export default function ReviewPage() {
  const icp = useIcpParam()
  const { leads, items, generations, setGenerationStatus } = useStore()
  const loading = useMockLoading()
  const [status, setStatus] = useState<"all" | GenerationStatus>("all")
  const [lowConfidence, setLowConfidence] = useState(false)
  const [noHook, setNoHook] = useState(false)
  const [flagged, setFlagged] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [threshold, setThreshold] = useState("75")
  const [confirmThreshold, setConfirmThreshold] = useState(false)
  const [regenIds, setRegenIds] = useState<string[] | null>(null)
  if (!icp) return null

  const genMap = generationByLead(generations)
  const rows: Row[] = leads
    .filter((l) => l.icpId === icp.id && genMap.has(l.id))
    .map((lead) => ({ lead, gen: genMap.get(lead.id)! }))

  const visible = rows.filter(
    ({ gen }) =>
      (status === "all" || gen.status === status) &&
      (!lowConfidence || gen.confidence < LOW_CONFIDENCE) &&
      (!noHook || !gen.chosenItemId) &&
      (!flagged || gen.flags.length > 0),
  )

  const itemById = new Map(items.map((it) => [it.id, it]))
  const selectedRows = rows.filter((r) => selected.has(r.lead.id))
  const pending = (g: Generation) => g.status === "draft" || g.status === "edited"
  const thresholdValue = Math.min(100, Math.max(0, Number(threshold) || 0))
  const aboveThreshold = rows.filter((r) => pending(r.gen) && r.gen.confidence >= thresholdValue)
  const approved = rows.filter((r) => r.gen.status === "approved")

  const openIndex = visible.findIndex((r) => r.lead.id === openLeadId)
  const openRow = rows.find((r) => r.lead.id === openLeadId)

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.lead.id))
  const someVisibleSelected = visible.some((r) => selected.has(r.lead.id))

  const approveRows = (target: Row[]) => {
    setGenerationStatus(target.map((r) => r.gen.id), "approved")
    setSelected(new Set())
    toast.success(`Approved ${target.length} email${target.length === 1 ? "" : "s"}`)
  }

  const exportApproved = () => {
    const csv = toCsv([
      ["email", "first_name", "company", "subject", "body"],
      ...approved.map(({ lead, gen }) => [lead.email, lead.firstName, lead.company, gen.subject, gen.editedBody ?? gen.body]),
    ])
    downloadCsv(`${icp.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-approved.csv`, csv)
    toast.success(`Exported ${approved.length} approved email${approved.length === 1 ? "" : "s"}`)
  }

  const move = (delta: number) => {
    if (visible.length === 0) return
    const from = openIndex === -1 ? (delta > 0 ? -1 : visible.length) : openIndex
    const next = Math.min(visible.length - 1, Math.max(0, from + delta))
    setOpenLeadId(visible[next].lead.id)
  }

  const clearFilters = () => {
    setStatus("all")
    setLowConfidence(false)
    setNoHook(false)
    setFlagged(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger aria-label="Filter by status" className="w-36!" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(GENERATION_STATUS_LABEL) as GenerationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {GENERATION_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterToggle pressed={lowConfidence} onClick={() => setLowConfidence(!lowConfidence)}>
          {`Low confidence (<${LOW_CONFIDENCE})`}
        </FilterToggle>
        <FilterToggle pressed={noHook} onClick={() => setNoHook(!noHook)}>
          No hook
        </FilterToggle>
        <FilterToggle pressed={flagged} onClick={() => setFlagged(!flagged)}>
          Flagged
        </FilterToggle>
        <Button variant="outline" size="sm" className="ml-auto" disabled={approved.length === 0} onClick={exportApproved}>
          <Download /> Export approved ({approved.length})
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <Button size="sm" disabled={selectedRows.length === 0} onClick={() => approveRows(selectedRows)}>
          <Check /> Approve selected ({selectedRows.length})
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={selectedRows.length === 0}
          onClick={() => setRegenIds(selectedRows.map((r) => r.lead.id))}
        >
          <RefreshCw /> Regenerate selected
        </Button>
        <div className="flex items-center gap-1.5 sm:ml-auto">
          <label htmlFor="threshold" className="text-sm whitespace-nowrap text-muted-foreground">
            Approve all with confidence ≥
          </label>
          <Input
            id="threshold"
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="h-7! w-16!"
          />
          <Button size="sm" variant="outline" disabled={aboveThreshold.length === 0} onClick={() => setConfirmThreshold(true)}>
            Approve {aboveThreshold.length}
          </Button>
        </div>
      </div>

      <GenerationProgress icpId={icp.id} />

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing to review yet"
          description="Enrich leads and generate emails from the Leads tab. Drafts show up here for review."
          action={
            <Button asChild variant="outline">
              <Link href={`/icps/${icp.id}/leads`}>Go to leads</Link>
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No emails match these filters"
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
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
                    onCheckedChange={(v) =>
                      setSelected(v === true ? new Set(visible.map((r) => r.lead.id)) : new Set())
                    }
                  />
                </TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Hook</TableHead>
                <TableHead className="min-w-64">First line</TableHead>
                <TableHead>Relevance</TableHead>
                <TableHead className="text-right">Conf.</TableHead>
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
                    className="cursor-pointer"
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
                    <TableCell>
                      <div className="font-medium">{fullName(lead)}</div>
                      <div className="text-xs text-muted-foreground">{lead.company}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <SourceIcon source={item.source} />
                          {shortDate(item.postedAt)}
                        </span>
                      ) : (
                        <NoHookBadge />
                      )}
                    </TableCell>
                    <TableCell className="max-w-96 truncate text-muted-foreground">
                      {firstLine(gen.editedBody ?? gen.body)}
                    </TableCell>
                    <TableCell>
                      <RelevanceDots value={gen.relevance} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ConfidenceBadge value={gen.confidence} />
                    </TableCell>
                    <TableCell>
                      <FlagBadges flags={gen.flags} />
                    </TableCell>
                    <TableCell>
                      <GenerationStatusBadge status={gen.status} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {openRow && (
        <ReviewPanel
          key={openRow.gen.id}
          icp={icp}
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
        description={`Every draft or edited email with confidence ${thresholdValue} or higher will be marked approved. You can still change them individually afterwards.`}
        confirmLabel={`Approve ${aboveThreshold.length}`}
        onConfirm={() => approveRows(aboveThreshold)}
      />

      {regenIds && (
        <GenerateDialog
          icp={icp}
          leadIds={regenIds}
          open
          title={`Regenerate ${regenIds.length} email${regenIds.length === 1 ? "" : "s"}`}
          onOpenChange={(o) => {
            if (!o) {
              setRegenIds(null)
              setSelected(new Set())
            }
          }}
        />
      )}
    </div>
  )
}
