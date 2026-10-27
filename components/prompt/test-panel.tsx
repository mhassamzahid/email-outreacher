"use client"

import { useState } from "react"
import { Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatUsd, fullName } from "@/lib/format"
import { renderPrompt, runPromptTest, type PromptTestResult } from "@/lib/mock-actions"
import { chooseHookItem } from "@/lib/mock-data"
import { generationByLead, icpsUsingTemplate } from "@/lib/selectors"
import { useStore, type VersionDraft } from "@/lib/store"
import type { HookContext } from "@/lib/templating"
import type { PromptKind, PromptTemplate } from "@/lib/types"

export function TestPanel({ template, draft }: { template: PromptTemplate; draft: VersionDraft }) {
  const { icps, leads, items, generations } = useStore()
  const genMap = generationByLead(generations)
  const kind: PromptKind = template.kind
  const [icpId, setIcpId] = useState(() => (icpsUsingTemplate(icps, template)[0] ?? icps[0])?.id ?? "")
  const icp = icps.find((i) => i.id === icpId)
  const icpLeads = leads.filter((l) => l.icpId === icpId)
  // Scoring needs a drafted email, so prefer leads that have one.
  const leadsWithItems = icpLeads.filter((l) =>
    kind === "score" ? genMap.has(l.id) : items.some((it) => it.leadId === l.id),
  )
  const [leadId, setLeadId] = useState(() => leadsWithItems[0]?.id ?? icpLeads[0]?.id ?? "")
  const lead = icpLeads.find((l) => l.id === leadId)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PromptTestResult | null>(null)

  if (!icp) return <p className="text-sm text-muted-foreground">Create an ICP to test prompts against.</p>

  const leadItems = lead ? items.filter((it) => it.leadId === lead.id) : []
  const choice = lead ? chooseHookItem(icp.id, leadItems) : null
  const hook: HookContext | null =
    (kind === "email" || kind === "score") && choice
      ? {
          text: choice.seed.hook,
          summary: choice.seed.summary,
          source: choice.item.source,
          url: choice.item.url,
          date: choice.item.postedAt.slice(0, 10),
        }
      : null

  const generation = kind === "score" && lead ? (genMap.get(lead.id) ?? null) : null
  const rendered = lead ? renderPrompt({ kind, version: draft, icp, lead, items: leadItems, hook, generation }) : null

  const run = async () => {
    if (!lead) return
    setRunning(true)
    setResult(null)
    try {
      setResult(await runPromptTest({ kind, version: draft, icp, lead, items: leadItems, hook, generation }))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Rendered prompt</CardTitle>
          <CardDescription>Uses your unsaved edits. Variables are filled in for real.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>ICP</Label>
              <Select
                value={icpId}
                onValueChange={(v) => {
                  setIcpId(v)
                  const next = leads.filter((l) => l.icpId === v)
                  setLeadId((next.find((l) => items.some((it) => it.leadId === l.id)) ?? next[0])?.id ?? "")
                  setResult(null)
                }}
              >
                <SelectTrigger className="w-full!" aria-label="Test ICP">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {icps.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lead</Label>
              <Select
                value={leadId}
                onValueChange={(v) => {
                  setLeadId(v)
                  setResult(null)
                }}
              >
                <SelectTrigger className="w-full!" aria-label="Test lead">
                  <SelectValue placeholder="No leads in this ICP" />
                </SelectTrigger>
                <SelectContent>
                  {icpLeads.map((l) => {
                    const n = items.filter((it) => it.leadId === l.id).length
                    return (
                      <SelectItem key={l.id} value={l.id}>
                        {fullName(l)}, {l.company} ({n} item{n === 1 ? "" : "s"})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          {kind === "email" && (
            <p className="text-xs text-muted-foreground">
              Hook for this test: {hook ? `"${hook.text}"` : "none (the lead has no usable content)"}
            </p>
          )}
          {kind === "score" && (
            <p className="text-xs text-muted-foreground">
              {generation
                ? `Scoring this lead's current draft: "${generation.subject}"`
                : "This lead has no draft yet, so the email variables render empty. Pick a lead that has one."}
            </p>
          )}
          {rendered ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">System</p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs whitespace-pre-wrap">
                {rendered.renderedSystem}
              </pre>
              <p className="text-xs font-medium text-muted-foreground">User</p>
              <pre className="max-h-96 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs whitespace-pre-wrap">
                {rendered.renderedUser}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a lead to render the prompt.</p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Output</CardTitle>
          <CardDescription>Mock model response. Real calls arrive with the backend.</CardDescription>
          <CardAction>
            <Button onClick={run} disabled={!lead || running}>
              {running ? <Loader2 className="animate-spin" /> : <Play />} Run test
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {running ? (
            <div className="space-y-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : result ? (
            <>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {(
                  [
                    ["Input tokens", result.inputTokens.toLocaleString("en-US")],
                    ["Output tokens", result.outputTokens.toLocaleString("en-US")],
                    ["Cost", formatUsd(result.costUsd)],
                    ["Latency", `${(result.latencyMs / 1000).toFixed(1)}s`],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border px-2.5 py-1.5">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs font-medium text-muted-foreground">Parsed</p>
              {result.parsed ? (
                <dl className="divide-y rounded-lg border text-sm">
                  {Object.entries(result.parsed).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[120px_1fr] gap-2 px-3 py-2">
                      <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
                      <dd className="whitespace-pre-wrap">
                        {Array.isArray(v) ? v.join(", ") || "[]" : v === null ? "null" : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-destructive">The output wasn&apos;t valid JSON.</p>
              )}
              <p className="text-xs font-medium text-muted-foreground">Raw</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs whitespace-pre-wrap">
                {result.rawOutput}
              </pre>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Run a test to see the output here.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
