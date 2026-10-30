"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { type CostEstimate, type CostItem, type CostUnit, fetchCostEstimate, fetchUsage, saveCostEstimate, useApi } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { UNIT_LABEL, monthlyCost, sendsPerMonth, totals } from "@/lib/cost-estimate"
import { formatUsd } from "@/lib/format"
import { cn } from "@/lib/utils"

const money = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : formatUsd(n))
const newId = () => `item-${Math.random().toString(36).slice(2, 10)}`

/** A monthly cost estimate built from line items you can add, edit, switch off and remove. Saved per workspace. */
export function CostEstimator() {
  return <WorkspaceGate>{(wsId) => <Estimator key={wsId} wsId={wsId} />}</WorkspaceGate>
}

function Estimator({ wsId }: { wsId: string }) {
  const saved = useApi(() => fetchCostEstimate(wsId), [wsId])
  if (saved.error && !saved.data) return <BackendError message={saved.error} onRetry={saved.reload} />
  if (!saved.data) return <TableSkeleton rows={8} />
  return <Editor key={JSON.stringify(saved.data)} wsId={wsId} saved={saved.data} onSaved={saved.reload} />
}

function Editor({ wsId, saved, onSaved }: { wsId: string; saved: CostEstimate; onSaved: () => void }) {
  const { me } = useAuth()
  const canEdit = me?.role === "admin" || me?.role === "management"
  const [draft, setDraft] = useState<CostEstimate>(saved)
  const [busy, setBusy] = useState(false)
  const usage = useApi(() => fetchUsage(wsId, 30), [wsId])
  const t = totals(draft)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const invalid = draft.items.some((i) => !i.name.trim() || !(i.amountUsd >= 0))
  const actual = usage.data?.providers.reduce((sum, p) => sum + p.costUsd, 0)

  const setItem = (id: string, patch: Partial<CostItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  const addItem = () =>
    setDraft((d) => ({
      ...d,
      items: [...d.items, { id: newId(), name: "", category: "Other", unit: "month", amountUsd: 0, note: "", enabled: true }],
    }))
  const removeItem = (id: string) => setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }))

  const save = async () => {
    setBusy(true)
    try {
      await saveCostEstimate(wsId, { ...draft, items: draft.items.map((i) => ({ ...i, name: i.name.trim(), category: i.category.trim() || "Other" })) })
      toast.success("Estimate saved")
      onSaved()
    } catch (e) {
      toast.error("Couldn't save the estimate", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const number = (key: "leadsPerMonth" | "emailsPerLead" | "replyRatePct", label: string, hint: string, step = 1) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        disabled={!canEdit}
        value={Number.isFinite(draft[key]) ? draft[key] : ""}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value === "" ? 0 : Number(e.target.value) }))}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Monthly total" value={money(t.monthly)} sub={`${draft.items.filter((i) => i.enabled).length} items on`} strong />
        <Tile label="Per lead" value={t.perLead === null ? "–" : formatUsd(t.perLead)} sub={`${draft.leadsPerMonth.toLocaleString("en-US")} leads a month`} />
        <Tile label="Per email sent" value={t.perEmail === null ? "–" : formatUsd(t.perEmail)} sub={`${Math.round(sendsPerMonth(draft)).toLocaleString("en-US")} emails a month`} />
        <Tile
          label="Per reply"
          value={t.perReply === null ? "–" : money(t.perReply)}
          sub={t.perReply === null ? "Set a reply rate below" : `${Math.round(t.replies).toLocaleString("en-US")} replies a month`}
        />
      </div>

      <section className="grid gap-4 rounded-lg border p-5 md:grid-cols-3">
        {number("leadsPerMonth", "Leads per month", "New leads contacted each month.")}
        {number("emailsPerLead", "Emails sent per lead", "3 when nobody replies; replies lower it.", 0.1)}
        {number("replyRatePct", "Reply rate (%)", "Replies per 100 leads. Only used for the cost per reply.", 0.1)}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-[15px] font-semibold">Cost items</h2>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={addItem}>
              <Plus /> Add item
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">On</TableHead>
                <TableHead className="min-w-64">Item</TableHead>
                <TableHead className="min-w-32">Category</TableHead>
                <TableHead className="min-w-40">Unit</TableHead>
                <TableHead className="min-w-32 text-right">Amount (USD)</TableHead>
                <TableHead className="min-w-28 text-right">A month</TableHead>
                {canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.items.map((item) => (
                <TableRow key={item.id} className={cn(!item.enabled && "opacity-60")}>
                  <TableCell className="align-top">
                    <Checkbox
                      className="mt-2"
                      checked={item.enabled}
                      disabled={!canEdit}
                      aria-label={`Count ${item.name || "this item"}`}
                      onCheckedChange={(v) => setItem(item.id, { enabled: v === true })}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1.5">
                      <Input
                        aria-label="Item name"
                        placeholder="e.g. Clay credits"
                        value={item.name}
                        disabled={!canEdit}
                        aria-invalid={!item.name.trim() || undefined}
                        onChange={(e) => setItem(item.id, { name: e.target.value })}
                      />
                      <Input
                        aria-label="Note"
                        placeholder="Where the number comes from"
                        className="h-7 border-transparent px-2 text-xs text-muted-foreground shadow-none hover:border-input focus-visible:border-input"
                        value={item.note}
                        title={item.note}
                        disabled={!canEdit}
                        onChange={(e) => setItem(item.id, { note: e.target.value })}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Input aria-label="Category" value={item.category} disabled={!canEdit} onChange={(e) => setItem(item.id, { category: e.target.value })} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Select value={item.unit} disabled={!canEdit} onValueChange={(v) => setItem(item.id, { unit: v as CostUnit })}>
                      <SelectTrigger className="w-full!" aria-label="Unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(UNIT_LABEL) as CostUnit[]).map((u) => (
                          <SelectItem key={u} value={u}>
                            {UNIT_LABEL[u]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      aria-label="Amount in US dollars"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      className="text-right tabular-nums"
                      disabled={!canEdit}
                      value={item.amountUsd}
                      onChange={(e) => setItem(item.id, { amountUsd: e.target.value === "" ? 0 : Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell className="pt-4 text-right align-top tabular-nums">{money(monthlyCost(item, draft))}</TableCell>
                  {canEdit && (
                    <TableCell className="align-top">
                      <Button size="icon" variant="ghost" aria-label={`Remove ${item.name || "this item"}`} onClick={() => removeItem(item.id)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {draft.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No cost items. Add one to start the estimate.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border px-4 py-3">
          <h2 className="text-[13px] text-muted-foreground">By category, a month</h2>
          <ul className="mt-2 space-y-1.5">
            {t.byCategory.map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{c.category}</span>
                <span className="tabular-nums">{money(c.monthly)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border px-4 py-3">
          <h2 className="text-[13px] text-muted-foreground">Actual spend, last 30 days (Usage log)</h2>
          {usage.error ? (
            <p className="mt-2 text-sm text-muted-foreground">Couldn&apos;t load it: {usage.error}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {(usage.data?.providers ?? []).map((p) => (
                <li key={p.provider} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 capitalize">{p.provider.replaceAll("_", " ")}</span>
                  <span className="tabular-nums">{formatUsd(p.costUsd)}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 border-t border-rule pt-1.5 text-sm font-medium">
                <span className="flex-1">Total</span>
                <span className="tabular-nums">{actual === undefined ? "–" : formatUsd(actual)}</span>
              </li>
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Only what Coldbrew calls itself (Claude, Apollo, Apify, Google). Subscriptions aren&apos;t in it.</p>
        </section>
      </div>

      {canEdit && dirty && (
        <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
          <span className="mr-auto text-sm text-muted-foreground">{invalid ? "Every item needs a name and an amount of $0 or more." : "Unsaved changes"}</span>
          <Button variant="ghost" disabled={busy} onClick={() => setDraft(saved)}>
            Discard
          </Button>
          <Button disabled={busy || invalid} onClick={() => void save()}>
            {busy ? "Saving…" : "Save estimate"}
          </Button>
        </div>
      )}
      {!canEdit && <p className="text-xs text-muted-foreground">Management and admins can change the estimate.</p>}
    </div>
  )
}

function Tile({ label, value, sub, strong }: { label: string; value: string; sub: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-4 py-3", strong && "border-data/40 bg-data/5")}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[26px] leading-8 tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}
