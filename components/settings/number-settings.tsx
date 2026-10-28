"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useApi } from "@/lib/api"
import { useStore } from "@/lib/store"

export interface NumberField<K extends string> {
  key: K
  label: string
  hint: string
  min: number
  max: number
}

/** A card of whole-number workspace settings, loaded from and saved to the backend. */
export function NumberSettings<K extends string>({
  fields,
  load,
  save,
  note,
  savedMessage,
}: {
  fields: NumberField<K>[]
  load: (workspaceId: string) => Promise<Record<K, number>>
  save: (workspaceId: string, values: Record<K, number>) => Promise<Record<K, number>>
  note?: string
  savedMessage: string
}) {
  const { currentWorkspaceId } = useStore()
  const saved = useApi(() => (currentWorkspaceId ? load(currentWorkspaceId) : Promise.resolve(null)), [currentWorkspaceId])
  if (saved.error && !saved.data) return <p className="text-sm text-destructive">Couldn&apos;t load these settings: {saved.error}</p>
  if (!saved.data || !currentWorkspaceId) return <Skeleton className="h-40 w-full" />
  return (
    <Form
      key={currentWorkspaceId + JSON.stringify(saved.data)}
      wsId={currentWorkspaceId}
      fields={fields}
      saved={saved.data}
      save={save}
      note={note}
      savedMessage={savedMessage}
      onSaved={saved.reload}
    />
  )
}

function Form<K extends string>({
  wsId,
  fields,
  saved,
  save,
  note,
  savedMessage,
  onSaved,
}: {
  wsId: string
  fields: NumberField<K>[]
  saved: Record<K, number>
  save: (workspaceId: string, values: Record<K, number>) => Promise<Record<K, number>>
  note?: string
  savedMessage: string
  onSaved: () => void
}) {
  const [draft, setDraft] = useState(() => Object.fromEntries(fields.map((f) => [f.key, String(saved[f.key])])) as Record<K, string>)
  const [busy, setBusy] = useState(false)
  const parsed = Object.fromEntries(fields.map((f) => [f.key, Number(draft[f.key])])) as Record<K, number>
  const error = (f: NumberField<K>) => {
    const n = parsed[f.key]
    return Number.isInteger(n) && n >= f.min && n <= f.max ? "" : `Use a whole number from ${f.min} to ${f.max}`
  }
  const valid = fields.every((f) => !error(f))
  const dirty = fields.some((f) => parsed[f.key] !== saved[f.key])

  const submit = async () => {
    setBusy(true)
    try {
      await save(wsId, parsed)
      toast.success("Saved", { description: savedMessage })
      onSaved()
    } catch (e) {
      toast.error("Couldn't save them", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {fields.map((f) => (
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
            aria-invalid={!!error(f) || undefined}
            aria-describedby={`${f.key}-hint`}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
          />
          <p id={`${f.key}-hint`} className={error(f) ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {error(f) || f.hint}
          </p>
        </div>
      ))}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <Button disabled={!valid || !dirty || busy} onClick={() => void submit()}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </div>
  )
}
