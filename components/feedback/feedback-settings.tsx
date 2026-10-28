"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { type FeedbackSettings as Counts, fetchFeedbackSettings, saveFeedbackSettings, useApi } from "@/lib/api"
import { useStore } from "@/lib/store"

const FIELDS: { key: keyof Counts; label: string; hint: string; min: number; max: number }[] = [
  {
    key: "goodExamples",
    label: "Good examples per email",
    hint: "The ICP's latest emails rated good, shown to Claude to write like. 0 turns them off.",
    min: 0,
    max: 10,
  },
  {
    key: "badExamples",
    label: "Bad examples per email",
    hint: "The ICP's latest emails rated bad, with your tags and notes, for Claude to avoid. 0 turns them off.",
    min: 0,
    max: 10,
  },
  {
    key: "improveExamples",
    label: "Rated emails per prompt suggestion",
    hint: "How many of the ICP's rated emails Claude reads when you ask it to improve the email prompt.",
    min: 3,
    max: 50,
  },
]

/** How many rated emails Claude learns from. Saved per workspace in the backend. */
export function FeedbackSettings() {
  const { currentWorkspaceId } = useStore()
  const saved = useApi(
    () => (currentWorkspaceId ? fetchFeedbackSettings(currentWorkspaceId) : Promise.resolve(null)),
    [currentWorkspaceId],
  )
  if (saved.error && !saved.data) return <p className="text-sm text-destructive">Couldn&apos;t load these settings: {saved.error}</p>
  if (!saved.data || !currentWorkspaceId) return <Skeleton className="h-40 w-full" />
  return <Form key={currentWorkspaceId + JSON.stringify(saved.data)} wsId={currentWorkspaceId} saved={saved.data} onSaved={saved.reload} />
}

function Form({ wsId, saved, onSaved }: { wsId: string; saved: Counts; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<keyof Counts, string>>({
    goodExamples: String(saved.goodExamples),
    badExamples: String(saved.badExamples),
    improveExamples: String(saved.improveExamples),
  })
  const [busy, setBusy] = useState(false)
  const parsed: Counts = {
    goodExamples: Number(draft.goodExamples),
    badExamples: Number(draft.badExamples),
    improveExamples: Number(draft.improveExamples),
  }
  const errors = Object.fromEntries(
    FIELDS.map((f) => {
      const n = parsed[f.key]
      return [f.key, Number.isInteger(n) && n >= f.min && n <= f.max ? "" : `Use a whole number from ${f.min} to ${f.max}`]
    }),
  ) as Record<keyof Counts, string>
  const valid = !Object.values(errors).some(Boolean)
  const dirty = FIELDS.some((f) => parsed[f.key] !== saved[f.key])

  const save = async () => {
    setBusy(true)
    try {
      await saveFeedbackSettings(wsId, parsed)
      toast.success("Saved", { description: "New emails use these counts from now on." })
      onSaved()
    } catch (e) {
      toast.error("Couldn't save them", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key}>{f.label}</Label>
          <Input
            id={f.key}
            type="number"
            inputMode="numeric"
            min={f.min}
            max={f.max}
            className="w-28"
            value={draft[f.key]}
            aria-invalid={!!errors[f.key] || undefined}
            aria-describedby={`${f.key}-hint`}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
          />
          <p id={`${f.key}-hint`} className={errors[f.key] ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {errors[f.key] || f.hint}
          </p>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        More examples give Claude more to go on, but make each email cost more to write: every example adds a few hundred tokens.
      </p>
      <Button disabled={!valid || !dirty || busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </div>
  )
}
