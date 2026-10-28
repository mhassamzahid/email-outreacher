"use client"

import { useRef, type Dispatch, type SetStateAction } from "react"
import { AlertTriangle } from "lucide-react"
import { HighlightedEditor } from "@/components/prompt/highlighted-editor"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MODELS } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useStore, type VersionDraft } from "@/lib/store"
import { availableVariables, unknownVariables } from "@/lib/templating"
import type { PromptKind } from "@/lib/types"

const GROUPS: { label: string; match: (v: string) => boolean }[] = [
  { label: "ICP", match: (v) => v.startsWith("icp.") },
  { label: "Lead", match: (v) => v.startsWith("lead.") },
  { label: "Content", match: (v) => v === "items" || v.startsWith("hook.") },
  { label: "Draft", match: (v) => v.startsWith("email.") },
]

/**
 * System and user prompt editors with variable highlighting, click-to-insert variables,
 * unknown-variable warnings and model settings. Shared by the prompt editor and New prompt.
 */
export function PromptBody({
  kind,
  draft,
  setDraft,
  userError,
}: {
  kind: PromptKind
  draft: VersionDraft
  setDraft: Dispatch<SetStateAction<VersionDraft>>
  userError?: string
}) {
  const { leads } = useStore()
  const systemRef = useRef<HTMLTextAreaElement>(null)
  const userRef = useRef<HTMLTextAreaElement>(null)
  const lastFocused = useRef<"systemPrompt" | "userPrompt">("userPrompt")

  // Only hook and email prompts are given posts.
  const usesPosts = kind === "hook" || kind === "email"
  const unknown = unknownVariables(`${draft.systemPrompt}\n${draft.userPrompt}`, kind)
  const extraColumns = Array.from(new Set(leads.flatMap((l) => Object.keys(l.extra)))).sort()
  const variables = availableVariables(kind).flatMap((v) =>
    v === "lead.extra.<column>" ? extraColumns.map((c) => `lead.extra.${c}`) : [v],
  )

  const insert = (name: string) => {
    const field = lastFocused.current
    const el = (field === "systemPrompt" ? systemRef : userRef).current
    const text = draft[field]
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const token = `{{${name}}}`
    setDraft((d) => ({ ...d, [field]: text.slice(0, start) + token + text.slice(end) }))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="system">System prompt</Label>
          <HighlightedEditor
            id="system"
            kind={kind}
            value={draft.systemPrompt}
            onChange={(v) => setDraft((d) => ({ ...d, systemPrompt: v }))}
            textareaRef={systemRef}
            onFocus={() => (lastFocused.current = "systemPrompt")}
            minHeight={72}
          />
          <p className="text-xs text-muted-foreground">Who the model is and the rules it always follows.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user">User prompt</Label>
          <HighlightedEditor
            id="user"
            kind={kind}
            value={draft.userPrompt}
            onChange={(v) => setDraft((d) => ({ ...d, userPrompt: v }))}
            textareaRef={userRef}
            onFocus={() => (lastFocused.current = "userPrompt")}
            minHeight={240}
          />
          <p className={userError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {userError || "The task, filled in for each lead. Variables in {{braces}} are replaced before it is sent."}
          </p>
        </div>
        {unknown.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-pill-warning p-3 text-sm text-pill-warning-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Unknown variable{unknown.length > 1 ? "s" : ""}{" "}
              {unknown.map((v, i) => (
                <span key={v}>
                  {i > 0 && ", "}
                  <code className="font-mono text-xs">{`{{${v}}}`}</code>
                </span>
              ))}{" "}
              will render as empty. Check the spelling against the list on the right.
            </p>
          </div>
        )}
        <div className={cn("grid gap-3", usesPosts ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Select value={draft.model} onValueChange={(v) => setDraft((d) => ({ ...d, model: v }))}>
              <SelectTrigger id="model" className="w-full!" aria-label="Model">
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
          <div className="space-y-1.5">
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={draft.temperature}
              onChange={(e) => setDraft((d) => ({ ...d, temperature: Math.min(1, Math.max(0, Number(e.target.value))) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxTokens">Max tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              min={1}
              step={50}
              value={draft.maxTokens}
              onChange={(e) => setDraft((d) => ({ ...d, maxTokens: Math.max(1, Math.round(Number(e.target.value))) }))}
            />
          </div>
          {usesPosts && (
            <div className="space-y-1.5">
              <Label htmlFor="maxPosts">Posts sent</Label>
              <Input
                id="maxPosts"
                type="number"
                min={1}
                max={50}
                placeholder="15"
                aria-describedby="maxPosts-hint"
                value={draft.maxPosts ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxPosts: e.target.value === "" ? null : Math.min(50, Math.max(1, Math.round(Number(e.target.value)))),
                  }))
                }
              />
              <p id="maxPosts-hint" className="text-xs text-muted-foreground">
                Newest posts in {"{{items}}"}, 1 to 50. Empty is 15.
              </p>
            </div>
          )}
        </div>
      </div>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Variables</CardTitle>
          <CardDescription>Click to insert at the cursor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {GROUPS.map((g) => {
            const vars = variables.filter(g.match)
            if (!vars.length) return null
            return (
              <div key={g.label} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
                <div className="flex flex-wrap gap-1">
                  {vars.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insert(v)}
                      className="rounded-[4px] bg-data-soft/60 px-1.5 py-0.5 font-mono text-[11px] text-data hover:bg-data-soft"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
