"use client"

import { useState } from "react"
import { Gauge } from "lucide-react"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Pill } from "@/components/status"
import { TableSkeleton } from "@/components/table-skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { type ProviderCall, type UsageProvider, type UsageTotals, fetchUsage, useApi } from "@/lib/api"
import { compactCount, formatUsd, fullDate } from "@/lib/format"

const PROVIDERS: { id: UsageProvider; label: string; unit: string }[] = [
  { id: "claude", label: "Claude API", unit: "tokens" },
  { id: "apollo", label: "Apollo", unit: "credits" },
  { id: "apify", label: "Apify", unit: "dollars" },
]
const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
]
// Calls logged before actions were named carry only the endpoint.
const ENDPOINT_ACTION: Record<string, string> = {
  "mixed_people/api_search": "Find stakeholders",
  "people/match": "Reveal email",
  "mixed_companies/search": "Find companies",
}

const EMPTY: UsageTotals = { calls: 0, failed: 0, credits: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 }
const providerLabel = (p: string) => PROVIDERS.find((x) => x.id === p)?.label ?? p
const actionOf = (action: string) => ENDPOINT_ACTION[action] ?? action

/** What one row of usage cost, in the provider's own unit. */
function spend(provider: string, t: Pick<UsageTotals, "credits" | "costUsd" | "inputTokens" | "outputTokens">) {
  if (provider === "claude")
    return `${compactCount(t.inputTokens)} in · ${compactCount(t.outputTokens)} out · ~${formatUsd(t.costUsd)}`
  if (provider === "apollo") return `${t.credits.toLocaleString()} ${t.credits === 1 ? "credit" : "credits"}`
  return formatUsd(t.costUsd)
}

export function UsageView() {
  return (
    <>
      <PageHeader title="Usage" description="Tokens, credits and dollars spent with Claude, Apollo and Apify, and which action spent them." />
      <div className="space-y-6 px-4 pb-10 md:px-8">
        <WorkspaceGate>{(wsId) => <UsageReport key={wsId} wsId={wsId} />}</WorkspaceGate>
      </div>
    </>
  )
}

function UsageReport({ wsId }: { wsId: string }) {
  const [days, setDays] = useState("30")
  const usage = useApi(() => fetchUsage(wsId, Number(days)), [wsId, days])

  if (usage.error && !usage.data) return <BackendError message={usage.error} onRetry={usage.reload} />

  const data = usage.data
  const totals = (p: string) => data?.providers.find((x) => x.provider === p) ?? EMPTY
  // Old rows without an action are grouped under their endpoint; merge those that map to the same action.
  const actions = new Map<string, UsageTotals & { provider: string; action: string }>()
  for (const a of data?.actions ?? []) {
    const action = actionOf(a.action)
    const key = `${a.provider}:${action}`
    const had = actions.get(key)
    actions.set(
      key,
      had
        ? {
            ...had,
            calls: had.calls + a.calls,
            failed: had.failed + a.failed,
            credits: had.credits + a.credits,
            costUsd: had.costUsd + a.costUsd,
            inputTokens: had.inputTokens + a.inputTokens,
            outputTokens: had.outputTokens + a.outputTokens,
          }
        : { ...a, action },
    )
  }
  const byAction = [...actions.values()].sort((a, b) => b.costUsd - a.costUsd || b.credits - a.credits || b.calls - a.calls)

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger aria-label="Period" className="w-40!">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PROVIDERS.map((p) => {
          const t = totals(p.id)
          return (
            <section key={p.id} className="rounded-lg border px-4 py-3">
              <h2 className="text-[13px] text-muted-foreground">{p.label}</h2>
              {!data ? (
                <div className="mt-2 h-12 animate-pulse rounded bg-muted" />
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                    {p.id === "claude"
                      ? compactCount(t.inputTokens + t.outputTokens)
                      : p.id === "apollo"
                        ? t.credits.toLocaleString()
                        : formatUsd(t.costUsd)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">{p.unit}</span>
                  </p>
                  <p className="text-[13px] text-muted-foreground tabular-nums">
                    {t.calls.toLocaleString()} {t.calls === 1 ? "call" : "calls"}
                    {t.failed ? `, ${t.failed} failed` : ""}
                    {p.id === "claude" && t.calls
                      ? ` · ${compactCount(t.inputTokens)} in, ${compactCount(t.outputTokens)} out · ~${formatUsd(t.costUsd)}`
                      : ""}
                  </p>
                </>
              )}
            </section>
          )
        })}
      </div>

      {!data ? (
        <TableSkeleton rows={5} />
      ) : data.recent.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Nothing spent in this period"
          description="Finding companies, researching them, finding stakeholders, revealing emails and fetching posts are all logged here."
        />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-medium">By action</h2>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byAction.map((a) => (
                    <TableRow key={`${a.provider}:${a.action}`}>
                      <TableCell className="font-medium">{a.action}</TableCell>
                      <TableCell>{providerLabel(a.provider)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.calls.toLocaleString()}
                        {a.failed ? <span className="text-muted-foreground"> ({a.failed} failed)</span> : null}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">{spend(a.provider, a)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">
              Latest calls <span className="font-normal text-muted-foreground">· the {data.recent.length} most recent</span>
            </h2>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When (UTC)</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Call</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.map((c) => (
                    <CallRow key={c.id} call={c} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
          <p className="text-xs text-muted-foreground">
            Claude dollars are estimated from token counts at list price. Apify dollars are what Apify reported for each run.
          </p>
        </>
      )}
    </>
  )
}

function CallRow({ call: c }: { call: ProviderCall }) {
  const failed = c.status === "failed"
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-muted-foreground">{fullDate(c.calledAt)}</TableCell>
      <TableCell>{actionOf(c.action ?? c.endpoint ?? "Other")}</TableCell>
      <TableCell>{providerLabel(c.provider)}</TableCell>
      <TableCell className="max-w-64 truncate text-[13px] text-muted-foreground">{c.model ?? c.endpoint}</TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums">
        {failed ? (
          <Pill tone="negative">Failed</Pill>
        ) : (
          spend(c.provider, {
            credits: c.credits ?? 0,
            costUsd: c.costUsd,
            inputTokens: c.inputTokens ?? 0,
            outputTokens: c.outputTokens ?? 0,
          })
        )}
      </TableCell>
    </TableRow>
  )
}
