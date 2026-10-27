"use client"

import Link from "next/link"
import { ArrowRight, Plus, Target } from "lucide-react"
import { BackendError } from "@/components/companies/backend-state"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { ConfidenceBadge, Pill, PipelineStrip } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FLAG_LABEL, fullName } from "@/lib/format"
import { estimateEnrichmentCost, estimateGenerationCost } from "@/lib/mock-actions"
import { generationByLead, pipeline } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import type { Generation, Lead } from "@/lib/types"

const LOW_CONFIDENCE = 60

export default function IcpsPage() {
  const { icps, icpsStatus, icpsError, reloadIcps, workspacesStatus, leads, generations, settings } = useStore()
  const loading = icpsStatus === "loading" || workspacesStatus === "loading"

  const rows = icps.map((icp) => {
    const icpLeads = leads.filter((l) => l.icpId === icp.id)
    return { icp, leads: icpLeads, counts: pipeline(icpLeads) }
  })
  const toReview = rows.reduce((sum, r) => sum + r.counts.review, 0)
  const waiting = rows.filter((r) => r.counts.review > 0).length
  const notEnriched = rows.reduce((sum, r) => sum + r.counts.pending, 0)

  const genMap = generationByLead(generations)
  const attention = leads
    .map((lead) => ({ lead, gen: genMap.get(lead.id), icpName: icps.find((i) => i.id === lead.icpId)?.name ?? "" }))
    .filter(
      (r): r is { lead: Lead; gen: Generation; icpName: string } =>
        !!r.gen &&
        (r.gen.status === "draft" || r.gen.status === "edited") &&
        (r.gen.flags.length > 0 || r.gen.confidence < LOW_CONFIDENCE),
    )
    .sort((a, b) => a.gen.confidence - b.gen.confidence)

  const nextRuns = rows.map(({ icp, leads: icpLeads }) => {
    const toEnrich = icpLeads.filter((l) => l.status === "imported" || l.status === "failed")
    const toDraft = icpLeads.filter((l) => l.status === "enriched" || l.status === "no_content")
    return {
      icp,
      enrich: toEnrich.length,
      enrichCost: estimateEnrichmentCost(toEnrich, icp.enabledSources, settings.postsPerLead).total,
      draft: toDraft.length,
      draftCost: estimateGenerationCost(toDraft.length),
    }
  })

  const newButton = (
    <Button asChild>
      <Link href="/icps/new">
        <Plus /> New ICP
      </Link>
    </Button>
  )

  return (
    <>
      <PageHeader
        title="ICPs"
        description={
          toReview > 0
            ? `${toReview} drafts waiting for review in ${waiting} ICP${waiting === 1 ? "" : "s"} · ${notEnriched} leads not enriched yet`
            : "ICPs are shared with Lead Intel. Outreach settings for each are kept per workspace."
        }
        actions={newButton}
      />
      <div className="px-4 pb-8 md:px-8">
        {icpsStatus === "error" ? (
          <BackendError message={icpsError ?? ""} onRetry={reloadIcps} />
        ) : loading ? (
          <div className="space-y-px overflow-hidden rounded-lg border">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[104px] rounded-none" />
            ))}
          </div>
        ) : icps.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No ICPs yet"
            description="Add one here or in Lead Intel. Either way, both projects share it."
            action={newButton}
          />
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
            {rows.map(({ icp, leads: icpLeads, counts }) => (
              <li
                key={icp.id}
                className="grid gap-x-8 gap-y-4 px-5 py-5 transition-colors hover:bg-muted/60 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <Link
                    href={`/icps/${icp.id}`}
                    className="block truncate text-[15px] font-semibold hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {icp.name}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill>{icp.industry}</Pill>
                    {!icp.enabled && <Pill tone="warning">Off in Lead Intel</Pill>}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {icp.companyCount.toLocaleString()} {icp.companyCount === 1 ? "business" : "businesses"}
                      {icp.places.length ? ` · ${icp.places.slice(0, 2).join(", ")}` : ""}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    {icp.titles.length ? `Reach: ${icp.titles.slice(0, 3).join(", ")}` : "Who to reach isn't set yet"}
                  </p>
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
                    <span>Pipeline</span>
                    <span className="tabular-nums">
                      <span className="text-foreground">{icpLeads.length}</span> leads
                    </span>
                  </div>
                  <PipelineStrip leads={icpLeads} />
                </div>
                <div className="flex items-center justify-between gap-5 lg:justify-end">
                  <div className="text-right">
                    <div className="text-[28px] leading-8 font-normal tabular-nums">{counts.review}</div>
                    <div className="text-xs text-muted-foreground">to review</div>
                  </div>
                  <Button asChild variant={counts.review > 0 ? "default" : "outline"} size="sm">
                    <Link href={counts.review > 0 ? `/icps/${icp.id}/review` : `/icps/${icp.id}/leads`}>
                      {counts.review > 0 ? "Review" : "Open"} <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && icpsStatus !== "error" && icps.length > 0 && (
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <section className="flex flex-col rounded-lg border">
              <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-5 pt-4 pb-2">
                <h2 className="text-[15px] font-semibold">Needs a closer look</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {attention.length} draft{attention.length === 1 ? "" : "s"} flagged or under {LOW_CONFIDENCE}
                </span>
              </header>
              {attention.length === 0 ? (
                <p className="px-5 pb-4 text-sm text-muted-foreground">Every draft waiting for review is unflagged and confident.</p>
              ) : (
                <ul className="divide-y divide-rule pb-1">
                  {attention.slice(0, 3).map(({ lead, gen, icpName }) => (
                    <li key={gen.id}>
                      <Link
                        href={`/icps/${lead.icpId}/review`}
                        className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{fullName(lead)}</div>
                          <div className="truncate text-[13px] text-muted-foreground">
                            {lead.company} · {icpName}
                          </div>
                        </div>
                        {gen.flags[0] ? (
                          <Pill tone={gen.flags[0] === "sensitive_topic" ? "negative" : "warning"}>{FLAG_LABEL[gen.flags[0]]}</Pill>
                        ) : (
                          <Pill tone="warning">Low confidence</Pill>
                        )}
                        <ConfidenceBadge value={gen.confidence} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {attention.length > 3 && (
                <p className="mt-auto border-t border-rule px-5 py-2.5 text-[13px] text-muted-foreground">
                  {attention.length - 3} more in the ICPs&apos; Review tabs, under Show only &gt; Flagged or Low confidence.
                </p>
              )}
            </section>

            <section className="flex flex-col rounded-lg border">
              <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-5 pt-4 pb-2">
                <h2 className="text-[15px] font-semibold">Ready to run</h2>
                <span className="text-xs text-muted-foreground">Estimated cost at {settings.postsPerLead} posts per source</span>
              </header>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-5 pb-2 font-normal">ICP</th>
                    <th className="px-3 pb-2 text-right font-normal">To enrich</th>
                    <th className="px-5 pb-2 text-right font-normal">To draft</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule border-t border-rule">
                  {nextRuns.map(({ icp, enrich, enrichCost, draft, draftCost }) => (
                    <tr key={icp.id}>
                      <td className="w-full max-w-0 px-5 py-3.5">
                        <Link href={`/icps/${icp.id}/leads`} className="block truncate font-medium hover:underline">
                          {icp.name}
                        </Link>
                      </td>
                      <RunCell count={enrich} cost={enrichCost} className="px-3" />
                      <RunCell count={draft} cost={draftCost} className="px-5" />
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t">
                  <tr>
                    <td className="px-5 py-2.5 text-muted-foreground">Total</td>
                    <RunCell count={sum(nextRuns, "enrich")} cost={sum(nextRuns, "enrichCost")} className="px-3" />
                    <RunCell count={sum(nextRuns, "draft")} cost={sum(nextRuns, "draftCost")} className="px-5" />
                  </tr>
                </tfoot>
              </table>
              <p className="mt-auto border-t border-rule px-5 py-2.5 text-[13px] text-muted-foreground">
                Runs start from each ICP&apos;s Leads tab and confirm the cost first.
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  )
}

/** Estimates are shown in cents; totals are summed from the rounded figures on screen. */
const cents = (n: number) => Math.round(n * 100) / 100

function sum<T extends Record<K, number>, K extends keyof T>(rows: T[], key: K): number {
  return rows.reduce((total, r) => total + (key.toString().endsWith("Cost") ? cents(r[key]) : r[key]), 0)
}

function RunCell({ count, cost, className }: { count: number; cost: number; className?: string }) {
  return (
    <td className={`py-3.5 text-right whitespace-nowrap tabular-nums ${className ?? ""}`}>
      {count ? (
        <>
          {count} <span className="text-muted-foreground">· ${cents(cost).toFixed(2)}</span>
        </>
      ) : (
        <span className="text-muted-foreground">–</span>
      )}
    </td>
  )
}
