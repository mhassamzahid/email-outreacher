"use client"

import { Fragment, useState } from "react"
import { ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  type CostBasis,
  type CostEstimate,
  type CostItem,
  type CostReference,
  fetchCostEstimate,
  fetchCostReference,
  fetchUsage,
  saveCostEstimate,
  useApi,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { BASIS_LABEL, byCategory, claudePrice, monthlyCost, sendsPerMonth, totals, usesPerMonth } from "@/lib/cost-estimate"
import { formatUsd } from "@/lib/format"
import { cn } from "@/lib/utils"

const money = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : formatUsd(n))
const count = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10).toLocaleString("en-US")
const newId = () => `item-${Math.random().toString(36).slice(2, 10)}`
const DEFAULT_MODEL = "claude-haiku-5-5"
const blank = (patch: Partial<CostItem>): CostItem => ({
  id: newId(),
  name: "",
  category: "Other",
  unitLabel: "per use",
  priceUsd: 0,
  quantity: 0,
  basis: "month",
  model: null,
  tokensIn: null,
  tokensOut: null,
  action: null,
  note: "",
  enabled: true,
  ...patch,
})

/** What Coldbrew costs a month, built from one line per operation that costs money (an email written, a
 * post fetched, a company verified…) plus subscriptions. Every line can be edited, switched off or removed. */
export function CostEstimator() {
  return <WorkspaceGate>{(wsId) => <Estimator key={wsId} wsId={wsId} />}</WorkspaceGate>
}

function Estimator({ wsId }: { wsId: string }) {
  const saved = useApi(() => fetchCostEstimate(wsId), [wsId])
  if (saved.error && !saved.data) return <BackendError message={saved.error} onRetry={saved.reload} />
  if (!saved.data) return <TableSkeleton rows={10} />
  return <Editor key={JSON.stringify(saved.data)} wsId={wsId} saved={saved.data} onSaved={saved.reload} />
}

function Editor({ wsId, saved, onSaved }: { wsId: string; saved: CostEstimate; onSaved: () => void }) {
  const { me } = useAuth()
  const canEdit = me?.role === "admin" || me?.role === "management"
  const [draft, setDraft] = useState<CostEstimate>(saved)
  const [busy, setBusy] = useState(false)
  const reference = useApi(() => fetchCostReference(wsId), [wsId])
  const usage = useApi(() => fetchUsage(wsId, 30), [wsId])
  const ref = reference.data ?? undefined
  const t = totals(draft)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const invalid = draft.items.some((i) => !i.name.trim() || !(i.priceUsd >= 0) || !(i.quantity >= 0))
  const actual = usage.data?.providers.reduce((sum, p) => sum + p.costUsd, 0)

  const setItem = (id: string, patch: Partial<CostItem>) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => {
        if (i.id !== id) return i
        const next = { ...i, ...patch }
        // A Claude line's price follows its model and tokens.
        if (next.model && next.tokensIn !== null && next.tokensOut !== null) {
          const price = claudePrice(ref, next.model, next.tokensIn, next.tokensOut)
          if (price !== null) next.priceUsd = price
        }
        return next
      }),
    }))
  const addItem = (item: CostItem) => setDraft((d) => ({ ...d, items: [...d.items, item] }))
  const removeItem = (id: string) => setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }))

  const save = async () => {
    setBusy(true)
    try {
      await saveCostEstimate(wsId, {
        ...draft,
        items: draft.items.map((i) => ({ ...i, name: i.name.trim(), category: i.category.trim() || "Other" })),
      })
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
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value === "" ? 0 : Number(e.target.value) }))}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Monthly total" value={money(t.monthly)} sub={`${draft.items.filter((i) => i.enabled).length} lines on`} strong />
        <Tile label="Per lead" value={t.perLead === null ? "–" : formatUsd(t.perLead)} sub={`${count(draft.leadsPerMonth)} leads a month`} />
        <Tile label="Per email sent" value={t.perEmail === null ? "–" : formatUsd(t.perEmail)} sub={`${count(Math.round(sendsPerMonth(draft)))} emails a month`} />
        <Tile
          label="Per reply"
          value={t.perReply === null ? "–" : money(t.perReply)}
          sub={t.perReply === null ? "Set a reply rate below" : `${count(Math.round(t.replies))} replies a month`}
        />
      </div>

      <section className="grid gap-4 rounded-lg border p-5 md:grid-cols-3">
        {number("leadsPerMonth", "Leads per month", "New leads contacted each month. Lines counted per lead use this.")}
        {number("emailsPerLead", "Emails sent per lead", "3 when nobody replies; replies lower it.", 0.1)}
        {number("replyRatePct", "Reply rate (%)", "Replies per 100 leads. Only used for the cost per reply.", 0.1)}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold">What costs money</h2>
            <p className="text-xs text-muted-foreground">
              Each line: a price per use, times how many uses (per lead, a month, or per email sent).
            </p>
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus /> Add line <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => addItem(blank({ unitLabel: "per use", quantity: 1, basis: "lead" }))}>
                  An operation (price per use)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    addItem(
                      blank({
                        category: "AI (Claude)", unitLabel: "per use", quantity: 1, basis: "lead",
                        model: DEFAULT_MODEL, tokensIn: 0, tokensOut: 0,
                      }),
                    )
                  }
                >
                  A Claude operation (priced by tokens)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => addItem(blank({ category: "Subscriptions", unitLabel: "per month", quantity: 1 }))}>
                  A subscription (a month)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">On</TableHead>
                <TableHead className="min-w-64">Line</TableHead>
                <TableHead className="min-w-56">Price per use</TableHead>
                <TableHead className="min-w-52">How many</TableHead>
                <TableHead className="min-w-28 text-right">A month</TableHead>
                {canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCategory(draft).map((group) => (
                <Fragment key={group.category}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={4} className="py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {group.category}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs font-medium tabular-nums">{money(group.monthly)}</TableCell>
                    {canEdit && <TableCell className="py-1.5" />}
                  </TableRow>
                  {group.items.map((item) => (
                    <Line
                      key={item.id}
                      item={item}
                      estimate={draft}
                      reference={ref}
                      canEdit={canEdit}
                      onChange={(patch) => setItem(item.id, patch)}
                      onRemove={() => removeItem(item.id)}
                    />
                  ))}
                </Fragment>
              ))}
              {draft.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Nothing yet. Add a line to start the estimate.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-lg border px-4 py-3">
        <h2 className="text-[13px] text-muted-foreground">Actual spend, last 30 days (Usage log)</h2>
        {usage.error ? (
          <p className="mt-2 text-sm text-muted-foreground">Couldn&apos;t load it: {usage.error}</p>
        ) : (
          <ul className="mt-2 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {(usage.data?.providers ?? []).map((p) => (
              <li key={p.provider} className="flex items-center gap-2 text-sm">
                <span className="flex-1 capitalize">{p.provider.replaceAll("_", " ")}</span>
                <span className="tabular-nums">{formatUsd(p.costUsd)}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
              <span className="flex-1">Total</span>
              <span className="tabular-nums">{actual === undefined ? "–" : formatUsd(actual)}</span>
            </li>
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Only what Coldbrew calls itself (Claude, Apollo, Apify, Google). Subscriptions aren&apos;t in it.
        </p>
      </section>

      {canEdit && dirty && (
        <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
          <span className="mr-auto text-sm text-muted-foreground">
            {invalid ? "Every line needs a name, and a price and quantity of 0 or more." : "Unsaved changes"}
          </span>
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

function Line({
  item,
  estimate,
  reference,
  canEdit,
  onChange,
  onRemove,
}: {
  item: CostItem
  estimate: CostEstimate
  reference: CostReference | undefined
  canEdit: boolean
  onChange: (patch: Partial<CostItem>) => void
  onRemove: () => void
}) {
  const claude = item.model !== null
  const measured = item.action ? reference?.measured.find((m) => m.action === item.action) : undefined
  const tokens = (key: "tokensIn" | "tokensOut", label: string) => (
    <Input
      aria-label={label}
      title={label}
      type="number"
      min={0}
      step={1}
      className="h-7 px-2 text-right text-xs tabular-nums"
      disabled={!canEdit}
      value={item[key] ?? 0}
      onChange={(e) => onChange({ [key]: e.target.value === "" ? 0 : Math.max(0, Math.round(Number(e.target.value))) })}
    />
  )

  return (
    <TableRow className={cn(!item.enabled && "opacity-60")}>
      <TableCell className="align-top">
        <Checkbox
          className="mt-2"
          checked={item.enabled}
          disabled={!canEdit}
          aria-label={`Count ${item.name || "this line"}`}
          onCheckedChange={(v) => onChange({ enabled: v === true })}
        />
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1.5">
          <Input
            aria-label="Line name"
            placeholder="e.g. Clay enrichment"
            value={item.name}
            disabled={!canEdit}
            aria-invalid={!item.name.trim() || undefined}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <div className="flex gap-1.5">
            <Input
              aria-label="Category"
              title="Category"
              className="h-7 w-36! flex-none px-2 text-xs"
              value={item.category}
              disabled={!canEdit}
              onChange={(e) => onChange({ category: e.target.value })}
            />
            <Input
              aria-label="Note"
              placeholder="Where the number comes from"
              title={item.note}
              className="h-7 min-w-0 flex-1 border-transparent px-2 text-xs text-muted-foreground shadow-none hover:border-input focus-visible:border-input"
              value={item.note}
              disabled={!canEdit}
              onChange={(e) => onChange({ note: e.target.value })}
            />
          </div>
        </div>
      </TableCell>
      <TableCell className="align-top">
        {claude ? (
          <div className="space-y-1.5">
            <Select value={item.model ?? DEFAULT_MODEL} disabled={!canEdit} onValueChange={(v) => onChange({ model: v })}>
              <SelectTrigger className="w-full!" aria-label="Claude model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(reference?.claudePrices ?? [{ model: item.model ?? DEFAULT_MODEL }]).map((p) => (
                  <SelectItem key={p.model} value={p.model}>
                    {p.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-1.5">
              {tokens("tokensIn", "Input tokens per use")}
              {tokens("tokensOut", "Output tokens per use")}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{formatUsd(item.priceUsd)}</span> {item.unitLabel} · tokens in / out
            </p>
            {measured && (
              <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                Your average: {count(measured.tokensIn)} / {count(measured.tokensOut)} ({measured.uses} {measured.uses === 1 ? "use" : "uses"})
                {canEdit && (measured.tokensIn !== item.tokensIn || measured.tokensOut !== item.tokensOut) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-xs"
                    onClick={() => onChange({ tokensIn: measured.tokensIn, tokensOut: measured.tokensOut })}
                  >
                    <Sparkles className="size-3" /> Use
                  </Button>
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Input
              aria-label="Price per use in US dollars"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              className="w-28! flex-none text-right tabular-nums"
              disabled={!canEdit}
              value={item.priceUsd}
              onChange={(e) => onChange({ priceUsd: e.target.value === "" ? 0 : Number(e.target.value) })}
            />
            <Input
              aria-label="What one use is"
              title="What one use is"
              className="h-9 min-w-0 flex-1 text-xs"
              value={item.unitLabel}
              disabled={!canEdit}
              onChange={(e) => onChange({ unitLabel: e.target.value })}
            />
          </div>
        )}
      </TableCell>
      <TableCell className="align-top">
        <div className="flex items-center gap-1.5">
          <Input
            aria-label="How many"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            className="w-20! flex-none text-right tabular-nums"
            disabled={!canEdit}
            value={item.quantity}
            onChange={(e) => onChange({ quantity: e.target.value === "" ? 0 : Number(e.target.value) })}
          />
          <Select value={item.basis} disabled={!canEdit} onValueChange={(v) => onChange({ basis: v as CostBasis })}>
            <SelectTrigger className="min-w-0 flex-1" aria-label="Counted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BASIS_LABEL) as CostBasis[]).map((b) => (
                <SelectItem key={b} value={b}>
                  {BASIS_LABEL[b]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {item.basis !== "month" && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">= {count(Math.round(usesPerMonth(item, estimate)))} a month</p>
        )}
      </TableCell>
      <TableCell className="pt-4 text-right align-top tabular-nums">{money(monthlyCost(item, estimate))}</TableCell>
      {canEdit && (
        <TableCell className="align-top">
          <Button size="icon" variant="ghost" aria-label={`Remove ${item.name || "this line"}`} onClick={onRemove}>
            <Trash2 />
          </Button>
        </TableCell>
      )}
    </TableRow>
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
