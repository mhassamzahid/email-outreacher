"use client"

import { Fragment, useState } from "react"
import { ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const invalid = draft.items.some((i) => !i.name.trim() || !(i.priceUsd >= 0) || !(i.quantity >= 0))
  const actual = usage.data?.providers.reduce((sum, p) => sum + p.costUsd, 0)

  const [advancedOpen, setAdvancedOpen] = useState(false)
  /** Change several lines at once, by id. A Claude line's price follows its model and tokens. */
  const updateLines = (patches: Record<string, Partial<CostItem>>) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => {
        if (!patches[i.id]) return i
        const next = { ...i, ...patches[i.id] }
        if (next.model && next.tokensIn !== null && next.tokensOut !== null) {
          const price = claudePrice(ref, next.model, next.tokensIn, next.tokensOut)
          if (price !== null) next.priceUsd = price
        }
        return next
      }),
    }))
  const setItem = (id: string, patch: Partial<CostItem>) => updateLines({ [id]: patch })
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
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <Setup draft={draft} canEdit={canEdit} update={updateLines} setDraft={setDraft} />
        <Summary draft={draft} />
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} />
            Edit prices and lines
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Every price, quantity and line behind the estimate, and your actual spend
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 border-t border-rule p-4">
          <section className="grid gap-4 md:grid-cols-3">
            {number("leadsPerMonth", "Leads per month", "Lines counted per lead use this.")}
            {number("emailsPerLead", "Emails sent per lead", "3 when nobody replies; replies lower it.", 0.1)}
            {number("replyRatePct", "Reply rate (%)", "Replies per 100 leads, for the cost per reply.", 0.1)}
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

        </CollapsibleContent>
      </Collapsible>

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

/** The lines the simple setup drives, by their id in the starting estimate. */
const LINE = {
  email: "email-generation",
  followUp: "follow-up",
  verification: "verification",
  instagramProfile: "instagram-profile",
  mapsSearch: "maps-search",
  reveal: "apollo-reveal",
  linkedinPosts: "linkedin-posts",
  instagramPosts: "instagram-posts",
} as const

const LEADS = [250, 500, 1000, 2000, 3000, 5000, 10000]
const SEARCHES = [0, 25, 50, 100, 250, 500]
const MODEL_LABEL: Record<string, string> = {
  "claude-haiku-5-5": "Claude Haiku (cheapest)",
  "claude-sonnet-5-5": "Claude Sonnet",
  "claude-opus-5-5": "Claude Opus (best)",
}
const MODEL_SHORT: Record<string, string> = {
  "claude-haiku-5-5": "Claude Haiku",
  "claude-sonnet-5-5": "Claude Sonnet",
  "claude-opus-5-5": "Claude Opus",
}

function Choice({
  label,
  help,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  help: string
  value: string
  options: [string, string][]
  onChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:items-center sm:gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger className="w-full!" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** A handful of choices about how you run Coldbrew; each one sets the lines behind it. */
function Setup({
  draft,
  canEdit,
  update,
  setDraft,
}: {
  draft: CostEstimate
  canEdit: boolean
  update: (patches: Record<string, Partial<CostItem>>) => void
  setDraft: (fn: (d: CostEstimate) => CostEstimate) => void
}) {
  const line = (id: string) => draft.items.find((i) => i.id === id)
  const on = (id: string) => !!line(id)?.enabled && (line(id)?.quantity ?? 0) > 0
  const gone = "Its line was removed under Edit prices and lines."
  const email = line(LINE.email)
  const followUps = line(LINE.followUp)?.enabled ? (line(LINE.followUp)?.quantity ?? 0) : 0
  const linkedin = on(LINE.linkedinPosts)
  const instagram = on(LINE.instagramPosts)
  const posts = linkedin && instagram ? "both" : linkedin ? "linkedin" : instagram ? "instagram" : "none"
  const searches = line(LINE.mapsSearch)?.enabled ? (line(LINE.mapsSearch)?.quantity ?? 0) : 0
  const leadOptions = [...new Set([...LEADS, draft.leadsPerMonth])].sort((a, b) => a - b)
  const searchOptions = [...new Set([...SEARCHES, searches])].sort((a, b) => a - b)
  const postsPerLead = (id: string) => Math.max(line(id)?.quantity ?? 0, 5)

  return (
    <section className="space-y-5 rounded-lg border p-5">
      <div>
        <h2 className="text-[15px] font-semibold">Your setup</h2>
        <p className="text-xs text-muted-foreground">Pick how you run Coldbrew. The estimate updates as you go.</p>
      </div>
      <Choice
        label="Leads per month"
        help="New people you email each month."
        value={String(draft.leadsPerMonth)}
        options={leadOptions.map((n) => [String(n), n.toLocaleString("en-US")])}
        onChange={(v) => setDraft((d) => ({ ...d, leadsPerMonth: Number(v) }))}
        disabled={!canEdit}
      />
      <Choice
        label="Model for writing emails"
        help={email ? "Writes the first email and the follow-ups." : gone}
        value={email?.model ?? DEFAULT_MODEL}
        options={Object.entries(MODEL_LABEL)}
        onChange={(v) => update({ [LINE.email]: { model: v }, [LINE.followUp]: { model: v } })}
        disabled={!canEdit || !email}
      />
      <Choice
        label="Follow-ups"
        help={line(LINE.followUp) ? "Sent in the same thread when they don't reply." : gone}
        value={String(followUps)}
        options={[["0", "None (1 email per lead)"], ["1", "1 follow-up (2 emails)"], ["2", "2 follow-ups (3 emails)"]]}
        onChange={(v) => {
          update({ [LINE.followUp]: { quantity: Number(v), basis: "lead", enabled: Number(v) > 0 } })
          setDraft((d) => ({ ...d, emailsPerLead: 1 + Number(v) }))
        }}
        disabled={!canEdit || !line(LINE.followUp)}
      />
      <Choice
        label="Posts to personalise with"
        help={line(LINE.linkedinPosts) || line(LINE.instagramPosts) ? "Recent posts the opening line can refer to." : gone}
        value={posts}
        options={[["none", "None"], ["linkedin", "LinkedIn"], ["instagram", "Instagram"], ["both", "LinkedIn and Instagram"]]}
        onChange={(v) =>
          update({
            [LINE.linkedinPosts]: { enabled: v === "linkedin" || v === "both", quantity: postsPerLead(LINE.linkedinPosts), basis: "lead" },
            [LINE.instagramPosts]: { enabled: v === "instagram" || v === "both", quantity: postsPerLead(LINE.instagramPosts), basis: "lead" },
          })
        }
        disabled={!canEdit || (!line(LINE.linkedinPosts) && !line(LINE.instagramPosts))}
      />
      <Choice
        label="Finding emails"
        help={line(LINE.reveal) ? "How each lead's email address is found." : gone}
        value={on(LINE.reveal) ? "apollo" : "own"}
        options={[["apollo", "Reveal with Apollo"], ["own", "I bring my own (CSV or Lead Intel)"]]}
        onChange={(v) => update({ [LINE.reveal]: { enabled: v === "apollo", quantity: 1, basis: "lead" } })}
        disabled={!canEdit || !line(LINE.reveal)}
      />
      <Choice
        label="Company verification"
        help={line(LINE.verification) ? "Claude reads each company's website and Instagram before you contact them." : gone}
        value={on(LINE.verification) ? "on" : "off"}
        options={[["on", "On (one company per lead)"], ["off", "Off"]]}
        onChange={(v) =>
          update({
            [LINE.verification]: { enabled: v === "on", quantity: v === "on" ? 1 : 0, basis: "lead" },
            [LINE.instagramProfile]: { enabled: v === "on", quantity: v === "on" ? 1 : 0, basis: "lead" },
          })
        }
        disabled={!canEdit || !line(LINE.verification)}
      />
      <Choice
        label="Google Maps searches per month"
        help={line(LINE.mapsSearch) ? "Finding new companies on Google Maps." : gone}
        value={String(searches)}
        options={searchOptions.map((n) => [String(n), n === 0 ? "None" : n.toLocaleString("en-US")])}
        onChange={(v) => update({ [LINE.mapsSearch]: { enabled: Number(v) > 0, quantity: Number(v), basis: "month" } })}
        disabled={!canEdit || !line(LINE.mapsSearch)}
      />
    </section>
  )
}

/** The estimate, and every line in it in plain words: what it is, how many, at what price. */
function Summary({ draft }: { draft: CostEstimate }) {
  const t = totals(draft)
  const counted = draft.items.filter((i) => i.enabled && usesPerMonth(i, draft) > 0)
  const priced = counted.filter((i) => i.priceUsd > 0).sort((a, b) => monthlyCost(b, draft) - monthlyCost(a, draft))
  const unpriced = counted.filter((i) => i.priceUsd === 0)

  return (
    <section className="space-y-4 rounded-lg border border-data/40 bg-data/5 p-5 lg:sticky lg:top-4">
      <div>
        <p className="text-[13px] text-muted-foreground">Estimated cost a month</p>
        <p className="text-[34px] leading-10 font-semibold tabular-nums">{money(t.monthly)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {t.perLead === null ? "–" : formatUsd(t.perLead)} per lead · {t.perEmail === null ? "–" : formatUsd(t.perEmail)} per email ·{" "}
          {count(Math.round(sendsPerMonth(draft)))} emails a month
        </p>
      </div>
      <div>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Details</h3>
        <ul className="mt-2 divide-y divide-rule text-sm">
          {priced.map((i) => (
            <li key={i.id} className="flex items-baseline gap-3 py-1.5">
              <span className="min-w-0 flex-1">
                {i.name}
                {i.model ? ` (${MODEL_SHORT[i.model] ?? i.model})` : ""}
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {i.basis === "month" && i.unitLabel === "per month"
                    ? "monthly plan"
                    : `${count(Math.round(usesPerMonth(i, draft)))} × ${formatUsd(i.priceUsd)} ${i.unitLabel}`}
                </span>
              </span>
              <span className="tabular-nums">{money(monthlyCost(i, draft))}</span>
            </li>
          ))}
          {priced.length === 0 && <li className="py-1.5 text-muted-foreground">Nothing priced yet.</li>}
        </ul>
      </div>
      {unpriced.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
          <p className="text-xs font-medium">Not in the total yet: no price set</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground tabular-nums">
            {unpriced.map((i) => (
              <li key={i.id}>
                {i.name}:{" "}
                {i.basis === "month" && i.unitLabel === "per month" ? "monthly plan" : `${count(Math.round(usesPerMonth(i, draft)))} a month`}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted-foreground">Add their prices under Edit prices and lines.</p>
        </div>
      )}
    </section>
  )
}
