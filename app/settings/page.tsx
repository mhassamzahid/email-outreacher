"use client"

import { useState } from "react"
import { AlertTriangle, Plug } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MODELS, formatUsd } from "@/lib/format"
import { useStore } from "@/lib/store"

const CONNECTIONS = [
  { name: "Anthropic", purpose: "Hook selection and email writing" },
  { name: "Apify", purpose: "LinkedIn, Instagram and Facebook posts" },
  { name: "Jina", purpose: "Company website content" },
]

const WARN_AT = 0.8

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
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      />
      <p className={errors[key] ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{errors[key] || hint}</p>
    </div>
  )

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-5xl gap-4 p-4 md:p-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spend this month</CardTitle>
            <CardDescription>Enrichment and generation costs, reset on the 1st.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{formatUsd(settings.spentThisMonthUsd)}</span>
              <span className="text-sm text-muted-foreground">of {formatUsd(settings.monthlyBudgetUsd)}</span>
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">{Math.round(ratio * 100)}%</span>
            </div>
            <Progress
              value={Math.min(100, ratio * 100)}
              className={over ? "[&>*]:bg-destructive" : near ? "[&>*]:bg-amber-500" : ""}
            />
            {near && (
              <p className={over ? "flex items-center gap-2 text-sm text-destructive" : "flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"}>
                <AlertTriangle className="size-4" />
                {over
                  ? "You're over this month's budget. Runs still show their cost before starting."
                  : `You've used over ${WARN_AT * 100}% of this month's budget. ${formatUsd(settings.monthlyBudgetUsd - settings.spentThisMonthUsd)} left.`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Defaults</CardTitle>
            <CardDescription>Used by new prompts and every enrichment run.</CardDescription>
          </CardHeader>
          <CardContent>
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
              {numberField("postsPerLead", "Posts per lead", "Fetched per source. Drives enrichment cost.")}
              {numberField("maxPostAgeDays", "Max post age (days)", "Older posts are ignored during enrichment.")}
              {numberField("monthlyBudgetUsd", "Monthly budget (USD)", "You'll see a warning past 80%.")}
              <Button type="submit" disabled={!valid || !dirty}>
                Save settings
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>API connections</CardTitle>
            <CardDescription>Connecting providers comes with the backend. Everything runs on mock data for now.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {CONNECTIONS.map((c) => (
              <div key={c.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                  <Plug className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.purpose}</p>
                </div>
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  Not connected
                </Badge>
                <Button size="sm" variant="outline" disabled>
                  Connect
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
