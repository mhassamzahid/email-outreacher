"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, ChevronUp, ExternalLink, Loader2, RefreshCw, Shuffle, SkipForward } from "lucide-react"
import { toast } from "sonner"
import { SourceIcon } from "@/components/source-icon"
import { FlagBadges, GenerationStatusBadge, NoHookBadge, RelevanceDots } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { SOURCE_LABEL, formatUsd, fullDate, fullName, shortDate } from "@/lib/format"
import { estimateGenerationCost } from "@/lib/mock-actions"
import { useStore } from "@/lib/store"
import type { EnrichmentItem, Generation, ICP, Lead } from "@/lib/types"

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">{children}</kbd>
}

function ItemCard({ item }: { item: EnrichmentItem }) {
  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <SourceIcon source={item.source} />
        <span>{SOURCE_LABEL[item.source]}</span>
        <span>·</span>
        <span>{shortDate(item.postedAt)}</span>
        <span>·</span>
        <span>{item.mediaType}</span>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
        >
          Open <ExternalLink className="size-3" />
        </a>
      </div>
      <p className="text-sm whitespace-pre-wrap">{item.text}</p>
    </div>
  )
}

export function ReviewPanel({
  icp,
  lead,
  generation,
  position,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  icp: ICP
  lead: Lead
  generation: Generation
  position: number
  total: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  const { items, templates, versions, genJobs, updateGeneration, startGeneration } = useStore()
  const [subject, setSubject] = useState(generation.subject)
  const [body, setBody] = useState(generation.editedBody ?? generation.body)
  const [instruction, setInstruction] = useState("")
  const [othersOpen, setOthersOpen] = useState(false)
  const regenerating = !!genJobs[icp.id]?.running

  const leadItems = items.filter((it) => it.leadId === lead.id)
  const chosen = leadItems.find((it) => it.id === generation.chosenItemId)
  const others = leadItems.filter((it) => it.id !== generation.chosenItemId)
  const dirty = subject !== generation.subject || body !== (generation.editedBody ?? generation.body)
  const words = body.trim() ? body.trim().split(/\s+/).length : 0

  const versionLabel = (id: string) => {
    const v = versions.find((x) => x.id === id)
    const t = v && templates.find((x) => x.id === v.templateId)
    return v && t ? `${t.name} v${v.version}` : "Unknown version"
  }

  const edits = () => (dirty ? { subject, editedBody: body } : {})

  const save = () => {
    updateGeneration(generation.id, { ...edits(), status: "edited" })
    toast.success("Edits saved")
  }

  const approve = () => {
    updateGeneration(generation.id, { ...edits(), status: "approved" })
    toast.success(`Approved email to ${lead.firstName}`)
    onNext()
  }

  const skip = () => {
    updateGeneration(generation.id, { ...edits(), status: "skipped" })
    toast(`Skipped ${fullName(lead)}`)
    onNext()
  }

  const regenerate = (opts: { instruction?: string; excludeItemIds?: string[] }) => {
    void startGeneration(icp.id, [lead.id], opts)
    setInstruction("")
  }

  // Keep the latest handlers for the keyboard listener without re-binding on every keystroke.
  const handlers = useRef({ approve, skip, onNext, onPrev })
  useEffect(() => {
    handlers.current = { approve, skip, onNext, onPrev }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (el.closest("input, textarea, select, [contenteditable=true]")) return
      const key = e.key.toLowerCase()
      if (key === "j") handlers.current.onNext()
      else if (key === "k") handlers.current.onPrev()
      else if (key === "a") handlers.current.approve()
      else if (key === "s") handlers.current.skip()
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full! gap-0 sm:max-w-2xl!">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2 pr-8">
            <SheetTitle className="truncate">{fullName(lead)}</SheetTitle>
            <GenerationStatusBadge status={generation.status} />
            <div className="ml-auto flex items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground tabular-nums">
                {position} of {total}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Previous (K)" onClick={onPrev}>
                <ChevronUp />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Next (J)" onClick={onNext}>
                <ChevronDown />
              </Button>
            </div>
          </div>
          <SheetDescription>
            {lead.title} at {lead.company} · {lead.email}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Hook</h3>
              {chosen ? <RelevanceDots value={generation.relevance} /> : <NoHookBadge />}
              <div className="ml-auto">
                <FlagBadges flags={generation.flags} />
              </div>
            </div>
            {chosen ? (
              <>
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">{generation.hook}</p>
                <ItemCard item={chosen} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {generation.flags.includes("sensitive_topic")
                  ? "The only content found was on a sensitive topic, so it was not used. The email opens with an observation about their role instead."
                  : leadItems.length
                    ? "None of the content was a good fit for this ICP. The email opens with an observation about their role instead."
                    : "No content was found for this lead. The email opens with an observation about their role instead."}
              </p>
            )}
            {others.length > 0 && (
              <Collapsible open={othersOpen} onOpenChange={setOthersOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-2">
                    {othersOpen ? <ChevronUp /> : <ChevronDown />}
                    {chosen ? "Other content" : "Content found"} ({others.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-1">
                  {others.map((it) => (
                    <ItemCard key={it.id} item={it} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </section>

          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Body</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {words} words · confidence {generation.confidence}
                </span>
              </div>
              <Textarea id="body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} className="text-sm leading-relaxed" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={approve}>
                <Check /> Approve <Kbd>A</Kbd>
              </Button>
              <Button variant="outline" onClick={skip}>
                <SkipForward /> Skip <Kbd>S</Kbd>
              </Button>
              <Button variant="outline" disabled={!dirty} onClick={save}>
                Save edits
              </Button>
              {dirty && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSubject(generation.subject)
                    setBody(generation.editedBody ?? generation.body)
                  }}
                >
                  Discard
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <h3 className="text-sm font-medium">Regenerate</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Instruction for regeneration"
                placeholder="Optional instruction, e.g. make it shorter"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={regenerating}
                onClick={() => regenerate({ instruction: instruction.trim() || undefined })}
              >
                {regenerating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Regenerate ({formatUsd(estimateGenerationCost(1))})
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              disabled={regenerating || !chosen || others.length === 0}
              onClick={() => regenerate({ excludeItemIds: chosen ? [chosen.id] : [] })}
            >
              <Shuffle /> Use a different item
            </Button>
            <p className="text-xs text-muted-foreground">Regenerating replaces this draft, including unsaved edits.</p>
          </section>

          <section className="space-y-1 text-xs text-muted-foreground">
            <p>Hook prompt: {versionLabel(generation.hookPromptVersionId)}</p>
            <p>Email prompt: {versionLabel(generation.emailPromptVersionId)}</p>
            <p>
              Generated {fullDate(generation.createdAt)} · cost {formatUsd(generation.costUsd)}
            </p>
            <p className="pt-2">
              Shortcuts: <Kbd>J</Kbd> next, <Kbd>K</Kbd> previous, <Kbd>A</Kbd> approve, <Kbd>S</Kbd> skip
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
