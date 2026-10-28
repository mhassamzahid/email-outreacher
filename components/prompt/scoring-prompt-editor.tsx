"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { HighlightedEditor } from "@/components/prompt/highlighted-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MODELS, fullDate } from "@/lib/format"
import { currentVersion, resolveScoringTemplate } from "@/lib/selectors"
import { useStore, type VersionDraft } from "@/lib/store"
import { availableVariables, unknownVariables } from "@/lib/templating"
import type { PromptTemplate, PromptVersion } from "@/lib/types"

/** The scoring prompt, editable from Settings. Testing and history live in the full prompt editor. */
export function ScoringPromptEditor() {
  const { templates, versions, settings, promptsStatus } = useStore()
  const template = resolveScoringTemplate(templates, settings.scoring)
  const version = currentVersion(versions, template)
  if (promptsStatus === "loading") return <p className="text-sm text-muted-foreground">Loading the scoring prompt…</p>
  if (!template || !version) return <p className="text-sm text-muted-foreground">No scoring prompt exists yet.</p>
  return <Editor key={version.id} template={template} version={version} />
}

const toDraft = (v: PromptVersion): VersionDraft => ({
  systemPrompt: v.systemPrompt,
  userPrompt: v.userPrompt,
  model: v.model,
  temperature: v.temperature,
  maxTokens: v.maxTokens,
  maxPosts: v.maxPosts,
})

function Editor({ template, version }: { template: PromptTemplate; version: PromptVersion }) {
  const { saveVersion } = useStore()
  const [draft, setDraft] = useState<VersionDraft>(() => toDraft(version))
  const [note, setNote] = useState("")
  const systemRef = useRef<HTMLTextAreaElement>(null)
  const userRef = useRef<HTMLTextAreaElement>(null)
  const lastFocused = useRef<"systemPrompt" | "userPrompt">("userPrompt")

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(version))
  const unknown = unknownVariables(`${draft.systemPrompt}\n${draft.userPrompt}`, "score")
  const variables = availableVariables("score").filter((v) => v !== "lead.extra.<column>")

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

  const save = async () => {
    try {
      const v = await saveVersion(template.id, draft, note.trim())
      setNote("")
      toast.success(`Saved ${template.name} v${v.version}`, { description: "New drafts are scored with it from now on." })
    } catch (e) {
      toast.error("Couldn't save it", { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">{template.name}</span>{" "}
          <span className="text-muted-foreground">
            v{version.version} · saved {fullDate(version.createdAt)}
          </span>
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/prompts/${template.id}`}>
            Test and version history <ExternalLink />
          </Link>
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="score-system">System prompt</Label>
        <HighlightedEditor
          id="score-system"
          kind="score"
          value={draft.systemPrompt}
          onChange={(v) => setDraft((d) => ({ ...d, systemPrompt: v }))}
          textareaRef={systemRef}
          onFocus={() => (lastFocused.current = "systemPrompt")}
          minHeight={72}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="score-user">User prompt</Label>
        <HighlightedEditor
          id="score-user"
          kind="score"
          value={draft.userPrompt}
          onChange={(v) => setDraft((d) => ({ ...d, userPrompt: v }))}
          textareaRef={userRef}
          onFocus={() => (lastFocused.current = "userPrompt")}
          minHeight={200}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Insert a variable at the cursor</p>
        <div className="flex flex-wrap gap-1">
          {variables.map((v) => (
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
      {unknown.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-pill-warning p-3 text-sm text-pill-warning-ink">
          <AlertTriangle className="mt-0.5 size-4 flex-none" />
          <span>
            {unknown.map((v) => `{{${v}}}`).join(", ")} {unknown.length === 1 ? "isn't a" : "aren't"} known variable
            {unknown.length === 1 ? "" : "s"} and will render as empty.
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        The prompt must return JSON with a <code className="font-mono">score</code> from 0 to 100 and a list of{" "}
        <code className="font-mono">reasons</code>.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1.5">
          <Label>Model</Label>
          <Select value={draft.model} onValueChange={(v) => setDraft((d) => ({ ...d, model: v }))}>
            <SelectTrigger className="w-full!" aria-label="Scoring model">
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
          <Label htmlFor="score-temperature">Temperature</Label>
          <Input
            id="score-temperature"
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={draft.temperature}
            onChange={(e) => setDraft((d) => ({ ...d, temperature: Math.min(1, Math.max(0, Number(e.target.value))) }))}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-end gap-2 border-t pt-4">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="score-note">Version note (optional)</Label>
          <Input id="score-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" />
        </div>
        <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(toDraft(version))}>
          Discard
        </Button>
        <Button disabled={!dirty} onClick={save}>
          Save as v{version.version + 1}
        </Button>
      </div>
    </div>
  )
}
