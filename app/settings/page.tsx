"use client"

import { useState, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { AutoSendSettings } from "@/components/auto-send-settings"
import { PageHeader } from "@/components/page-header"
import { ScoringPromptEditor } from "@/components/prompt/scoring-prompt-editor"
import { Pill } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MODELS, formatUsd } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const CONNECTIONS = [
  { name: "OpenAI", purpose: "Hook selection and email writing" },
  { name: "Apify", purpose: "LinkedIn, Instagram and Facebook posts" },
  { name: "Jina", purpose: "Company website content" },
]

const WARN_AT = 0.8

/** One settings card: a header with what it controls, then its controls. */
function Panel({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-lg border">
      <header className="border-b border-rule px-5 py-4">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const { settings, setSettings } = useStore()
  const [draft, setDraft] = useState({
    defaultModel: settings.defaultModel,
    postsPerLead: String(settings.postsPerLead),
    maxPostAgeDays: String(settings.maxPostAgeDays),
    monthlyBudgetUsd: String(settings.monthlyBudgetUsd),
  })

  const parsed = {
    postsPerLead: Number(draft.postsPerLead),
    maxPostAgeDays: Number(draft.maxPostAgeDays),
    monthlyBudgetUsd: Number(draft.monthlyBudgetUsd),
  }
  const errors = {
    postsPerLead: !Number.isInteger(parsed.postsPerLead) || parsed.postsPerLead < 1 || parsed.postsPerLead > 20 ? "Use a whole number from 1 to 20" : "",
    maxPostAgeDays: !Number.isInteger(parsed.maxPostAgeDays) || parsed.maxPostAgeDays < 1 ? "Use a whole number of days, 1 or more" : "",
    monthlyBudgetUsd: !(parsed.monthlyBudgetUsd > 0) ? "Enter a budget above $0" : "",
  }
  const valid = !Object.values(errors).some(Boolean)
  const dirty =
    draft.defaultModel !== settings.defaultModel ||
    parsed.postsPerLead !== settings.postsPerLead ||
    parsed.maxPostAgeDays !== settings.maxPostAgeDays ||
    parsed.monthlyBudgetUsd !== settings.monthlyBudgetUsd

  const ratio = settings.spentThisMonthUsd / settings.monthlyBudgetUsd
  const over = ratio >= 1
  const near = ratio >= WARN_AT
  const remaining = settings.monthlyBudgetUsd - settings.spentThisMonthUsd

  const save = () => {
    setSettings((s) => ({ ...s, defaultModel: draft.defaultModel, ...parsed }))
    toast.success("Settings saved")
  }

  const numberField = (key: "postsPerLead" | "maxPostAgeDays" | "monthlyBudgetUsd", label: string, hint: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        inputMode="decimal"
        value={draft[key]}
        aria-invalid={!!errors[key] || undefined}
        aria-describedby={`${key}-hint`}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      />
      <p id={`${key}-hint`} className={errors[key] ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {errors[key] || hint}
      </p>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Settings"
        description={`Auto-send threshold ${settings.scoring.threshold} · auto-send ${settings.scoring.autoSend ? "on" : "off"} · ${formatUsd(settings.spentThisMonthUsd)} of ${formatUsd(settings.monthlyBudgetUsd)} spent this month`}
      />
      {/* Two columns of different weight: scoring and sending, which change often, get the wide one. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 px-4 pb-10 md:px-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="min-w-0 space-y-6">
          <Panel
            id="scoring"
            title="Review and auto-send"
            description="Every drafted email gets an AI lead score. Below the threshold a person reviews it; at or above it, with auto-send on, it goes out on its own."
          >
            <AutoSendSettings />
          </Panel>
          <Panel
            id="scoring-prompt"
            title="Lead scoring prompt"
            description="Reads the ICP, the lead, their content and the drafted email, and returns a score from 0 to 100 with reasons."
          >
            <ScoringPromptEditor />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Spend this month" description="Enrichment, drafting and scoring. Resets on the 1st.">
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] leading-9 tabular-nums">{formatUsd(settings.spentThisMonthUsd)}</span>
            <span className="text-sm text-muted-foreground tabular-nums">of {formatUsd(settings.monthlyBudgetUsd)}</span>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">{Math.round(ratio * 100)}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", over ? "bg-negative" : near ? "bg-warning" : "bg-data")}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>$0</span>
            <span>{formatUsd(settings.monthlyBudgetUsd)}</span>
          </div>
          {near && (
            <p className={cn("mt-4 flex items-center gap-2 text-sm", over ? "text-negative" : "text-warning")}>
              <AlertTriangle className="size-4 flex-none" />
              {over
                ? "You're over this month's budget. Runs still show their cost before starting."
                : `You've used over ${WARN_AT * 100}% of this month's budget. ${formatUsd(remaining)} left.`}
            </p>
          )}
          </Panel>
          <Panel title="Defaults" description="Used by new prompts and every enrichment run.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (valid && dirty) save()
            }}
          >
            <div className="space-y-1.5">
              <Label>Default model</Label>
              <Select value={draft.defaultModel} onValueChange={(v) => setDraft((d) => ({ ...d, defaultModel: v }))}>
                <SelectTrigger className="w-full!" aria-label="Default model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {numberField("postsPerLead", "Posts per lead", "Fetched per source.")}
              {numberField("maxPostAgeDays", "Max post age (days)", "Older posts are ignored.")}
            </div>
            {numberField("monthlyBudgetUsd", "Monthly budget (USD)", "You'll see a warning past 80%.")}
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={!valid || !dirty}>
                Save settings
              </Button>
            </div>
          </form>
          </Panel>
          <Panel title="API connections" description="Providers connect once the backend exists. Until then everything runs on sample data.">
          <ul className="-my-3 divide-y divide-rule">
            {CONNECTIONS.map((c) => (
              <li key={c.name} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{c.purpose}</p>
                </div>
                <Pill>Not connected</Pill>
                <Button size="sm" variant="outline" disabled title="Available once the backend is connected">
                  Connect
                </Button>
              </li>
            ))}
          </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}
