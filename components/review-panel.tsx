"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, ChevronUp, ExternalLink, Gauge, Loader2, RefreshCw, Send, Shuffle, SkipForward } from "lucide-react"
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
import { COST_PER_SCORE, autoSentToday, sendDecision } from "@/lib/scoring"
import { cn } from "@/lib/utils"
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
  const { items, templates, versions, genJobs, generations, settings, updateGeneration, startGeneration, sendGenerations, rescoreLead } =
    useStore()
  const [rescoring, setRescoring] = useState(false)
  const sent = generation.status === "sent"
  const score = lead.score
  const threshold = settings.scoring.threshold
  const decision = sendDecision(score?.value ?? null, generation.flags, settings.scoring, autoSentToday(generations))
  const routing = sent
    ? generation.sentBy === "auto"
      ? `Sent automatically ${generation.sentAt ? fullDate(generation.sentAt) : ""}: the score cleared the threshold of ${threshold} with no flags.`
      : `Sent by a person ${generation.sentAt ? fullDate(generation.sentAt) : ""}.`
    : decision.send
      ? `Clears the threshold of ${threshold} with no flags. It was drafted before auto-send could send it, so it waits for you.`
      : decision.reason
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
    if (sent) return
    updateGeneration(generation.id, { ...edits(), status: "approved" })
    toast.success(`Approved email to ${lead.firstName}`)
    onNext()
  }

  const skip = () => {
    if (sent) return
    updateGeneration(generation.id, { ...edits(), status: "skipped" })
    toast(`Skipped ${fullName(lead)}`)
    onNext()
  }

  const regenerate = (opts: { instruction?: string; excludeItemIds?: string[] }) => {
    // A person is looking at this draft, so the new one stays in review even if it scores high.
    void startGeneration(icp.id, [lead.id], { ...opts, reviewOnly: true })
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
          <section className="space-y-3 rounded-lg border p-3" aria-label="Lead score">
            <div className="flex items-center gap-3">
              <Gauge className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Lead score</h3>
              {score ? (
                <span className="flex items-baseline gap-1">
                  <span className={cn("text-xl tabular-nums", score.value >= threshold ? "text-data" : "text-foreground")}>
                    {score.value}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 100 · threshold {threshold}</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Not scored</span>
              )}
              {!sent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  disabled={rescoring}
                  onClick={async () => {
                    setRescoring(true)
                    await rescoreLead(lead.id)
                    setRescoring(false)
                    toast.success(`Re-scored ${fullName(lead)}`)
                  }}
                >
                  {rescoring ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-score ({formatUsd(COST_PER_SCORE)})
                </Button>
              )}
            </div>
            {score && (
              <div className="relative h-2 rounded-full bg-muted" aria-hidden>
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full", score.value >= threshold ? "bg-data" : "bg-data-mid/60")}
                  style={{ width: `${score.value}%` }}
                />
                <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-foreground/70" style={{ left: `${threshold}%` }} />
              </div>
            )}
            <p className="text-sm">{routing}</p>
            {score && score.reasons.length > 0 && (
              <ul className="space-y-1 text-[13px] text-muted-foreground">
                {score.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-2 size-1 flex-none rounded-full bg-muted-foreground/60" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Hook</h3>
              {chosen ? <RelevanceDots value={generation.relevance} /> : <NoHookBadge />}
              {generation.flags.length > 0 && (
                <div className="ml-auto">
                  <FlagBadges flags={generation.flags} />
                </div>
              )}
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
              <Input id="subject" value={subject} readOnly={sent} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Body</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {words} words · confidence {generation.confidence}
                </span>
              </div>
              <Textarea
                id="body"
                rows={12}
                value={body}
                readOnly={sent}
                onChange={(e) => setBody(e.target.value)}
                className="text-sm leading-relaxed"
              />
            </div>
            {sent ? (
              <p className="rounded-lg bg-pill-info px-3 py-2 text-sm text-pill-info-ink">
                This email has been sent, so it can no longer be edited.
              </p>
            ) : (
            <div className="flex flex-wrap gap-2">
              {generation.status === "approved" ? (
                <Button
                  onClick={() => {
                    if (dirty) updateGeneration(generation.id, edits())
                    sendGenerations([generation.id])
                    toast.success(`Sent email to ${lead.firstName}`, { description: "Simulated: no mail connection yet." })
                    onNext()
                  }}
                >
                  <Send /> Send now
                </Button>
              ) : (
                <Button onClick={approve}>
                  <Check /> Approve <Kbd>A</Kbd>
                </Button>
              )}
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
            )}
          </section>

          <section className={cn("space-y-2 rounded-lg border p-3", sent && "hidden")}>
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
            {score && (
              <p>
                Scoring prompt: {versionLabel(score.promptVersionId)} ·{" "}
                <Link href="/settings#scoring" className="underline underline-offset-2 hover:text-foreground">
                  edit in Settings
                </Link>
              </p>
            )}
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
