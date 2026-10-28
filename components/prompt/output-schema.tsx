"use client"

import { Lock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchOutputSchemas, useApi } from "@/lib/api"
import type { PromptKind } from "@/lib/types"

/**
 * The JSON shape a prompt of this kind answers in. Read-only: it's fixed by the app and sent to Claude
 * as the required output format every time the prompt runs, whatever the prompt itself says.
 */
export function OutputSchemaView({ kind }: { kind: PromptKind }) {
  const schemas = useApi(fetchOutputSchemas, [])
  if (schemas.error && !schemas.data) return <p className="text-sm text-destructive">Couldn&apos;t load the output schema: {schemas.error}</p>
  if (!schemas.data) return <Skeleton className="h-48 w-full" />
  const entries = schemas.data[kind] ?? []

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Read-only. Every time this prompt runs, Claude is required to answer in exactly this JSON shape (structured outputs),
          whatever the prompt says. The field descriptions are sent with it, so the prompt doesn&apos;t need to describe the JSON.
        </span>
      </p>
      {entries.map((s) => (
        <section key={s.name} className="space-y-1.5" aria-label={s.name}>
          <h3 className="text-sm font-medium">{s.name}</h3>
          <p className="text-xs text-muted-foreground">{s.note}</p>
          <pre className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-5">
            {JSON.stringify(s.jsonSchema, null, 2)}
          </pre>
        </section>
      ))}
    </div>
  )
}
