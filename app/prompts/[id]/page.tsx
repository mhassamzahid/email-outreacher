"use client"

import Link from "next/link"
import { notFound, useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { AlertTriangle, ChevronLeft, Copy, Save, Star } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { HighlightedEditor } from "@/components/prompt/highlighted-editor"
import { TestPanel } from "@/components/prompt/test-panel"
import { VersionHistory } from "@/components/prompt/version-history"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MODELS } from "@/lib/format"
import { useStore, type VersionDraft } from "@/lib/store"
import { availableVariables, unknownVariables } from "@/lib/templating"
import type { PromptTemplate, PromptVersion } from "@/lib/types"

export default function PromptEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { templates, versions } = useStore()
  const template = templates.find((t) => t.id === id)
  const version = versions.find((v) => v.id === template?.currentVersionId)

  if (!template || !version) notFound()
  return <Editor key={template.currentVersionId} template={template} version={version} />
}

const toDraft = (v: PromptVersion): VersionDraft => ({
  systemPrompt: v.systemPrompt,
  userPrompt: v.userPrompt,
  model: v.model,
  temperature: v.temperature,
  maxTokens: v.maxTokens,
})

const GROUPS: { label: string; match: (v: string) => boolean }[] = [
  { label: "ICP", match: (v) => v.startsWith("icp.") },
  { label: "Lead", match: (v) => v.startsWith("lead.") },
  { label: "Content", match: (v) => v === "items" || v.startsWith("hook.") },
]

function Editor({ template, version }: { template: PromptTemplate; version: PromptVersion }) {
  const { leads, saveVersion, duplicateTemplate, setDefaultTemplate } = useStore()
  const router = useRouter()
  const [draft, setDraft] = useState<VersionDraft>(() => toDraft(version))
  const [saveOpen, setSaveOpen] = useState(false)
  const [note, setNote] = useState("")
  const systemRef = useRef<HTMLTextAreaElement>(null)
  const userRef = useRef<HTMLTextAreaElement>(null)
  const lastFocused = useRef<"systemPrompt" | "userPrompt">("userPrompt")

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(version))
  const unknown = unknownVariables(`${draft.systemPrompt}\n${draft.userPrompt}`, template.kind)
  const extraColumns = Array.from(new Set(leads.flatMap((l) => Object.keys(l.extra)))).sort()
  const variables = availableVariables(template.kind).flatMap((v) =>
    v === "lead.extra.<column>" ? extraColumns.map((c) => `lead.extra.${c}`) : [v],
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

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

  const save = () => {
    const v = saveVersion(template.id, draft, note.trim())
    setSaveOpen(false)
    toast.success(`Saved ${template.name} v${v.version}`)
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Link href="/prompts" className="text-muted-foreground hover:text-foreground" aria-label="Back to prompts">
              <ChevronLeft className="size-4" />
            </Link>
            {template.name}
          </span>
        }
        description={`${template.kind === "hook" ? "Hook selection" : "Email writing"} prompt · editing from v${version.version}`}
        actions={
          <>
            {dirty && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                Unsaved
              </Badge>
            )}
            {template.isDefault ? (
              <Badge variant="secondary">
                <Star /> Default
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDefaultTemplate(template.id)
                  toast.success(`${template.name} is now the default ${template.kind} prompt`)
                }}
              >
                <Star /> Set as default
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const copy = duplicateTemplate(template.id)
                toast.success(`Created ${copy.name}`)
                router.push(`/prompts/${copy.id}`)
              }}
            >
              <Copy /> Duplicate
            </Button>
            <Button size="sm" disabled={!dirty} onClick={() => setSaveOpen(true)}>
              <Save /> Save as new version
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="system">System prompt</Label>
              <HighlightedEditor
                id="system"
                kind={template.kind}
                value={draft.systemPrompt}
                onChange={(v) => setDraft((d) => ({ ...d, systemPrompt: v }))}
                textareaRef={systemRef}
                onFocus={() => (lastFocused.current = "systemPrompt")}
                minHeight={72}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user">User prompt</Label>
              <HighlightedEditor
                id="user"
                kind={template.kind}
                value={draft.userPrompt}
                onChange={(v) => setDraft((d) => ({ ...d, userPrompt: v }))}
                textareaRef={userRef}
                onFocus={() => (lastFocused.current = "userPrompt")}
                minHeight={240}
              />
            </div>
            {unknown.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
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
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Select value={draft.model} onValueChange={(v) => setDraft((d) => ({ ...d, model: v }))}>
                  <SelectTrigger className="w-full!" aria-label="Model">
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
                          className="rounded-md bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
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

        <Tabs defaultValue="test">
          <TabsList>
            <TabsTrigger value="test">Test</TabsTrigger>
            <TabsTrigger value="history">Version history</TabsTrigger>
          </TabsList>
          <TabsContent value="test" className="pt-2">
            <TestPanel template={template} draft={draft} />
          </TabsContent>
          <TabsContent value="history" className="pt-2">
            <VersionHistory template={template} onRestored={() => undefined} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as v{version.version + 1}</DialogTitle>
            <DialogDescription>
              v{version.version} stays in history. ICPs using this template pick up the new version on their next run.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save version</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
