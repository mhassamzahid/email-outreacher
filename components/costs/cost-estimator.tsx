"use client"

import { useState } from "react"
import { toast } from "sonner"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  type CostEstimate,
  type CostItem,
  type CostReference,
  fetchCostEstimate,
  fetchCostReference,
  saveCostEstimate,
  useApi,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { BASIS_LABEL, byCategory, claudePrice, monthlyCost, sendsPerMonth, totals, usesPerMonth } from "@/lib/cost-estimate"
import { formatUsd } from "@/lib/format"
import { cn } from "@/lib/utils"

const money = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : formatUsd(n))
const count = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10).toLocaleString("en-US")
const DEFAULT_MODEL = "claude-haiku-5-5"
const MODELS: [string, string][] = [
  ["claude-haiku-5-5", "Haiku"],
  ["claude-sonnet-5-5", "Sonnet"],
  ["claude-opus-5-5", "Opus"],
]
const MODEL_NAME = Object.fromEntries(MODELS.map(([id, name]) => [id, `Claude ${name}`]))
/** The lines that write emails: the model choice applies to both. */
const WRITING = ["email-generation", "follow-up"]
const FOLLOW_UP = "follow-up"
/** A subscription: one price a month, nothing to count. */
const isPlan = (i: CostItem) => i.basis === "month" && i.unitLabel === "per month"

/** Pick how you run Coldbrew and see what it costs a month, line by line. */
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
  const ref = reference.data ?? undefined
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const invalid = draft.items.some((i) => !(i.priceUsd >= 0) || !(i.quantity >= 0)) || !(draft.leadsPerMonth >= 0)

  /** Change several lines at once, by id. A Claude line's price follows its model and tokens. */
  const update = (patches: Record<string, Partial<CostItem>>) =>
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

  const save = async () => {
    setBusy(true)
    try {
      await saveCostEstimate(wsId, draft)
      toast.success("Estimate saved")
      onSaved()
    } catch (e) {
      toast.error("Couldn't save the estimate", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <Setup draft={draft} reference={ref} canEdit={canEdit} update={update} setDraft={setDraft} />
        <Summary draft={draft} />
      </div>

      {canEdit && dirty && (
        <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
          <span className="mr-auto text-sm text-muted-foreground">{invalid ? "Numbers can't be negative." : "Unsaved changes"}</span>
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

/** A number typed into a text field. Blank counts as 0; while you type "0." the text stays as typed. */
function NumberField({
  value,
  onChange,
  label,
  prefix,
  disabled,
}: {
  value: number
  onChange: (n: number) => void
  label: string
  prefix?: string
  disabled: boolean
}) {
  const [text, setText] = useState(String(value))
  // Follow the value when it changes from outside (Discard), keep the typed text otherwise.
  const shown = Number(text || 0) === value ? text : String(value)
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
      <Input
        aria-label={label}
        inputMode="decimal"
        className={cn("text-right tabular-nums", prefix && "pl-6")}
        value={shown}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "")
          setText(raw)
          const n = raw === "" ? 0 : Number(raw)
          if (Number.isFinite(n)) onChange(n)
        }}
      />
    </div>
  )
}

/** Every line behind the estimate, as text fields: how many, and the price each. */
function Setup({
  draft,
  reference,
  canEdit,
  update,
  setDraft,
}: {
  draft: CostEstimate
  reference: CostReference | undefined
  canEdit: boolean
  update: (patches: Record<string, Partial<CostItem>>) => void
  setDraft: (fn: (d: CostEstimate) => CostEstimate) => void
}) {
  const writingModel = draft.items.find((i) => i.id === "email-generation")?.model ?? DEFAULT_MODEL
  const setQuantity = (item: CostItem, n: number) => {
    update({ [item.id]: { quantity: n, enabled: true } })
    // Follow-ups decide how many emails each lead gets.
    if (item.id === FOLLOW_UP) setDraft((d) => ({ ...d, emailsPerLead: 1 + n }))
  }

  return (
    <section className="space-y-5 rounded-lg border p-5">
      <div>
        <h2 className="text-[15px] font-semibold">Your setup</h2>
        <p className="text-xs text-muted-foreground">Type how many of each, and its price. The estimate updates as you go.</p>
      </div>

      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
        <div>
          <p className="text-sm font-medium">Leads per month</p>
          <p className="text-xs text-muted-foreground">New people you email each month.</p>
        </div>
        <NumberField
          label="Leads per month"
          value={draft.leadsPerMonth}
          disabled={!canEdit}
          onChange={(n) => setDraft((d) => ({ ...d, leadsPerMonth: Math.round(n) }))}
        />
      </div>

      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <p className="text-sm font-medium">Model for writing emails</p>
          <p className="text-xs text-muted-foreground">Writes the first email and the follow-ups. Haiku is the cheapest.</p>
        </div>
        <div role="radiogroup" aria-label="Model for writing emails" className="inline-flex rounded-md border p-0.5">
          {MODELS.map(([id, name]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={writingModel === id}
              disabled={!canEdit}
              onClick={() => update(Object.fromEntries(WRITING.map((w) => [w, { model: id }])))}
              className={cn(
                "rounded px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
                writingModel === id ? "bg-data text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {byCategory(draft).map((group) => (
        <div key={group.category} className="space-y-2.5 border-t border-rule pt-4">
          <div className="grid gap-x-3 sm:grid-cols-[minmax(0,1fr)_7rem_9rem]">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.category}</h3>
            <span className="hidden text-right text-xs text-muted-foreground sm:block">How many</span>
            <span className="hidden text-right text-xs text-muted-foreground sm:block">Price each</span>
          </div>
          {group.items.map((item) => (
            <div key={item.id} className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_7rem_9rem] sm:items-start">
              <div className="min-w-0">
                <p className="text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground" title={item.note}>
                  {isPlan(item)
                    ? "Monthly plan"
                    : item.model
                      ? `${BASIS_LABEL[item.basis]}, ${item.unitLabel.replace(/^per /, "priced per ")} with ${MODEL_NAME[item.model] ?? item.model}`
                      : `${BASIS_LABEL[item.basis]}, price ${item.unitLabel}`}
                </p>
              </div>
              {isPlan(item) ? (
                <span className="hidden sm:block" />
              ) : (
                <NumberField
                  label={`${item.name}: how many ${BASIS_LABEL[item.basis]}`}
                  value={item.enabled ? item.quantity : 0}
                  disabled={!canEdit}
                  onChange={(n) => setQuantity(item, n)}
                />
              )}
              {item.model ? (
                <p className="pt-2 text-right text-sm text-muted-foreground tabular-nums">{reference ? formatUsd(item.priceUsd) : "…"}</p>
              ) : (
                <NumberField
                  label={`${item.name}: price ${item.unitLabel}`}
                  prefix="$"
                  value={item.priceUsd}
                  disabled={!canEdit}
                  onChange={(n) => update({ [item.id]: { priceUsd: n } })}
                />
              )}
            </div>
          ))}
        </div>
      ))}
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
                {i.model ? ` (${MODEL_NAME[i.model] ?? i.model})` : ""}
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {isPlan(i) ? "monthly plan" : `${count(Math.round(usesPerMonth(i, draft)))} × ${formatUsd(i.priceUsd)} ${i.unitLabel}`}
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
                {i.name}: {isPlan(i) ? "monthly plan" : `${count(Math.round(usesPerMonth(i, draft)))} a month`}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted-foreground">Type their prices in Your setup.</p>
        </div>
      )}
    </section>
  )
}
