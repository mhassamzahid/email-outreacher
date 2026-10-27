"use client"

import { Loader2, X } from "lucide-react"
import { SourceIcon } from "@/components/source-icon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SOURCE_LABEL, formatUsd } from "@/lib/format"
import { estimateEnrichmentCost, estimateGenerationCost } from "@/lib/mock-actions"
import { autoSentToday } from "@/lib/scoring"
import { currentVersion, resolveScoringTemplate, resolveTemplate } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import type { ICP } from "@/lib/types"
import { SOURCES } from "@/lib/types"

function BudgetLine({ cost }: { cost: number }) {
  const { settings } = useStore()
  const remaining = settings.monthlyBudgetUsd - settings.spentThisMonthUsd
  const over = cost > remaining
  return (
    <p className={over ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
      {formatUsd(Math.max(0, remaining))} left of your {formatUsd(settings.monthlyBudgetUsd)} monthly budget.
      {over && " This run would go over budget."}
    </p>
  )
}

export function EnrichDialog({
  icp,
  leadIds,
  open,
  onOpenChange,
}: {
  icp: ICP
  leadIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { leads, settings, startEnrichment } = useStore()
  const targets = leads.filter((l) => leadIds.includes(l.id))
  const estimate = estimateEnrichmentCost(targets, icp.enabledSources, settings.postsPerLead)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg!">
        <DialogHeader>
          <DialogTitle>Enrich {targets.length} lead{targets.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            Fetches up to {settings.postsPerLead} recent posts per source, no older than {settings.maxPostAgeDays} days.
            Existing content for these leads will be replaced.
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Leads with source</TableHead>
              <TableHead className="text-right">Est. cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SOURCES.map((s) => {
              const enabled = icp.enabledSources.includes(s)
              return (
                <TableRow key={s} className={enabled ? "" : "text-muted-foreground"}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <SourceIcon source={s} />
                      {SOURCE_LABEL[s]}
                      {!enabled && <span className="text-xs">(disabled)</span>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{enabled ? estimate.bySource[s].leads : "–"}</TableCell>
                  <TableCell className="text-right tabular-nums">{enabled ? formatUsd(estimate.bySource[s].cost) : "–"}</TableCell>
                </TableRow>
              )
            })}
            <TableRow className="font-medium">
              <TableCell>Total</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">{formatUsd(estimate.total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <BudgetLine cost={estimate.total} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={targets.length === 0}
            onClick={() => {
              onOpenChange(false)
              void startEnrichment(icp.id, leadIds)
            }}
          >
            Start enrichment ({formatUsd(estimate.total)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GenerateDialog({
  icp,
  leadIds,
  open,
  onOpenChange,
  title,
}: {
  icp: ICP
  leadIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
}) {
  const { templates, versions, settings, generations, startGeneration } = useStore()
  const scoreTpl = resolveScoringTemplate(templates, settings.scoring)
  const scoreV = currentVersion(versions, scoreTpl)
  const { autoSend, threshold, dailyAutoSendCap } = settings.scoring
  const capLeft = Math.max(0, dailyAutoSendCap - autoSentToday(generations))
  const hookTpl = resolveTemplate(templates, icp, "hook")
  const emailTpl = resolveTemplate(templates, icp, "email")
  const hookV = currentVersion(versions, hookTpl)
  const emailV = currentVersion(versions, emailTpl)
  const cost = estimateGenerationCost(leadIds.length)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md!">
        <DialogHeader>
          <DialogTitle>{title ?? `Generate ${leadIds.length} email${leadIds.length === 1 ? "" : "s"}`}</DialogTitle>
          <DialogDescription>
            Each lead runs through hook selection, email writing, then scoring. Existing drafts for these leads are
            replaced.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Hook prompt</dt>
          <dd>
            {hookTpl?.name} <span className="text-muted-foreground">v{hookV?.version}</span>
          </dd>
          <dt className="text-muted-foreground">Email prompt</dt>
          <dd>
            {emailTpl?.name} <span className="text-muted-foreground">v{emailV?.version}</span>
          </dd>
          <dt className="text-muted-foreground">Scoring prompt</dt>
          <dd>
            {scoreTpl?.name} <span className="text-muted-foreground">v{scoreV?.version}</span>
          </dd>
          <dt className="text-muted-foreground">Estimated cost</dt>
          <dd className="font-medium tabular-nums">{formatUsd(cost)} <span className="font-normal text-muted-foreground">incl. scoring</span></dd>
        </dl>
        <p
          className={
            autoSend && !title
              ? "rounded-lg bg-pill-info px-3 py-2 text-sm text-pill-info-ink"
              : "rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
          }
        >
          {title
            ? "Regenerated drafts stay in review and are never sent automatically."
            : autoSend
              ? `Auto-send is on: drafts scoring ${threshold} or more with no flags are sent right away (${capLeft} left today). The rest wait for review.`
              : `Auto-send is off: every draft waits for review. Drafts scoring ${threshold} or more are marked so you can approve them in bulk.`}
        </p>
        <BudgetLine cost={cost} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={leadIds.length === 0}
            onClick={() => {
              onOpenChange(false)
              void startGeneration(icp.id, leadIds)
            }}
          >
            Generate ({formatUsd(cost)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EnrichmentProgress({ icpId }: { icpId: string }) {
  const { enrichJobs, dismissEnrichJob } = useStore()
  const job = enrichJobs[icpId]
  if (!job) return null
  const pct = job.total ? Math.round((job.completed / job.total) * 100) : 0
  const sources = SOURCES.filter((s) => job.bySource[s].done > 0)

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm">
        {job.running && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <span className="font-medium">{job.running ? "Enriching leads" : "Enrichment complete"}</span>
        <span className="text-muted-foreground tabular-nums">
          {job.completed} of {job.total}
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">Spent {formatUsd(job.costUsd)}</span>
        {!job.running && (
          <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={() => dismissEnrichJob(icpId)}>
            <X />
          </Button>
        )}
      </div>
      <Progress value={pct} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Enriched <b className="text-foreground tabular-nums">{job.outcomes.enriched}</b>
        </span>
        <span>
          No content <b className="text-foreground tabular-nums">{job.outcomes.no_content}</b>
        </span>
        <span>
          Failed <b className="text-foreground tabular-nums">{job.outcomes.failed}</b>
        </span>
      </div>
      {sources.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Done</TableHead>
              <TableHead className="text-right">Found content</TableHead>
              <TableHead className="text-right">No content</TableHead>
              <TableHead className="text-right">Failed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => {
              const p = job.bySource[s]
              return (
                <TableRow key={s}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <SourceIcon source={s} />
                      {SOURCE_LABEL[s]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.done}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.found}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.empty}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.failed}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export function GenerationProgress({ icpId }: { icpId: string }) {
  const { genJobs } = useStore()
  const job = genJobs[icpId]
  if (!job?.running) return null
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="font-medium">Generating emails</span>
        <span className="text-muted-foreground tabular-nums">
          {job.completed} of {job.total}
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">Spent {formatUsd(job.costUsd)}</span>
      </div>
      <Progress value={job.total ? (job.completed / job.total) * 100 : 0} />
    </div>
  )
}
