"use client"

import Link from "next/link"
import { notFound, useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronLeft, Copy, Save, Star } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { PromptBody } from "@/components/prompt/prompt-body"
import { TestPanel } from "@/components/prompt/test-panel"
import { VersionHistory } from "@/components/prompt/version-history"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useStore, type VersionDraft } from "@/lib/store"
import type { PromptTemplate, PromptVersion } from "@/lib/types"

export default function PromptEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { templates, versions } = useStore()
  const template = templates.find((t) => t.id === id)
  const version = versions.find((v) => v.id === template?.currentVersionId)
  // Lives outside Editor so the open tab survives the remount after saving or restoring a version.
  const [tab, setTab] = useState("test")

  if (!template || !version) notFound()
  return <Editor key={template.currentVersionId} template={template} version={version} tab={tab} onTabChange={setTab} />
}

const toDraft = (v: PromptVersion): VersionDraft => ({
  systemPrompt: v.systemPrompt,
  userPrompt: v.userPrompt,
  model: v.model,
  temperature: v.temperature,
  maxTokens: v.maxTokens,
})

function Editor({
  template,
  version,
  tab,
  onTabChange,
}: {
  template: PromptTemplate
  version: PromptVersion
  tab: string
  onTabChange: (tab: string) => void
}) {
  const { saveVersion, duplicateTemplate, setDefaultTemplate } = useStore()
  const router = useRouter()
  const [draft, setDraft] = useState<VersionDraft>(() => toDraft(version))
  const [saveOpen, setSaveOpen] = useState(false)
  const [note, setNote] = useState("")

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(version))

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

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
        description={`${{ hook: "Hook selection", email: "Email writing", score: "Lead scoring" }[template.kind]} prompt · editing from v${version.version}`}
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

      <div className="space-y-6 px-4 pb-10 md:px-8">
        <PromptBody kind={template.kind} draft={draft} setDraft={setDraft} />

        <Tabs value={tab} onValueChange={onTabChange}>
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
