"use client"

import { useState } from "react"
import { History } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sideBySideDiff, type DiffCell } from "@/lib/diff"
import { fullDate } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { PromptTemplate, PromptVersion } from "@/lib/types"

const CELL: Record<DiffCell["kind"], string> = {
  same: "",
  removed: "bg-red-500/10 text-red-800 dark:text-red-200",
  added: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  empty: "bg-muted/40",
}

function DiffBlock({ title, before, after }: { title: string; before: string; after: string }) {
  const rows = sideBySideDiff(before, after)
  const changed = rows.some((r) => r.left.kind !== "same")
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        {title} {!changed && "(no changes)"}
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <div className="grid min-w-[640px] grid-cols-2 font-mono text-xs">
          {rows.map((row, i) => (
            <div key={i} className="contents">
              {[row.left, row.right].map((cell, side) => (
                <div key={side} className={cn("flex gap-2 px-2 py-0.5", side === 0 && "border-r", CELL[cell.kind])}>
                  <span className="w-6 shrink-0 text-right text-muted-foreground/60 select-none">{cell.line ?? ""}</span>
                  <span className="whitespace-pre-wrap break-words">
                    {cell.kind === "removed" ? "- " : cell.kind === "added" ? "+ " : "  "}
                    {cell.text}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function VersionHistory({ template, onRestored }: { template: PromptTemplate; onRestored: () => void }) {
  const { versions, restoreVersion } = useStore()
  const list = versions.filter((v) => v.templateId === template.id).sort((a, b) => b.version - a.version)
  const [aId, setAId] = useState(list[1]?.id ?? list[0]?.id)
  const [bId, setBId] = useState(list[0]?.id)
  const [restoring, setRestoring] = useState<PromptVersion | null>(null)
  const a = list.find((v) => v.id === aId) ?? list[1] ?? list[0]
  const b = list.find((v) => v.id === bId) ?? list[0]

  const settingsLine = (v: PromptVersion) => `model: ${v.model}\ntemperature: ${v.temperature}\nmax tokens: ${v.maxTokens}`

  const picker = (value: string | undefined, onChange: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-44!" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {list.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            v{v.version} · {fullDate(v.createdAt).split(",")[0]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Versions</CardTitle>
          <CardDescription>Saving never overwrites. Restoring creates a new version.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.map((v) => {
            const current = v.id === template.currentVersionId
            return (
              <div key={v.id} className="space-y-1 rounded-lg border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">v{v.version}</span>
                  {current && <Badge variant="secondary">Current</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">{fullDate(v.createdAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{v.note || "No note"}</p>
                <div className="flex gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setBId(template.currentVersionId)
                      setAId(v.id)
                    }}
                  >
                    Compare with current
                  </Button>
                  {!current && (
                    <Button size="xs" variant="ghost" onClick={() => setRestoring(v)}>
                      <History /> Restore
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Compare versions</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {picker(a?.id, setAId, "Older version")}
            <span className="text-sm text-muted-foreground">to</span>
            {picker(b?.id, setBId, "Newer version")}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {a && b ? (
            <>
              <DiffBlock title="System prompt" before={a.systemPrompt} after={b.systemPrompt} />
              <DiffBlock title="User prompt" before={a.userPrompt} after={b.userPrompt} />
              <DiffBlock title="Settings" before={settingsLine(a)} after={settingsLine(b)} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Save a second version to compare.</p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!restoring}
        onOpenChange={(o) => !o && setRestoring(null)}
        title={restoring ? `Restore v${restoring.version}?` : ""}
        description="This saves a copy of that version as the new current version. Unsaved edits in the editor are discarded. History is kept."
        confirmLabel="Restore as new version"
        onConfirm={() => {
          if (!restoring) return
          const v = restoreVersion(restoring.id)
          if (v) toast.success(`Restored v${restoring.version} as v${v.version}`)
          setRestoring(null)
          onRestored()
        }}
      />
    </div>
  )
}
