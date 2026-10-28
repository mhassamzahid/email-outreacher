"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, ExternalLink, Inbox, RotateCcw, Save, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { EmptyState } from "@/components/empty-state"
import { FeedbackControl } from "@/components/feedback/feedback-control"
import { Pill, type PillTone } from "@/components/status"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { type EmailDraft, type EmailStatus, fetchEmails, generateEmails, updateEmail, useApi } from "@/lib/api"
import { formatUsd, shortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const FILTERS: { value: string; label: string; test: (s: EmailStatus) => boolean }[] = [
  { value: "review", label: "To review", test: (s) => s === "draft" || s === "edited" },
  { value: "approved", label: "Approved", test: (s) => s === "approved" },
  { value: "skipped", label: "Skipped", test: (s) => s === "skipped" },
  { value: "all", label: "All", test: () => true },
]

const STATUS: Record<EmailStatus, { label: string; tone: PillTone }> = {
  draft: { label: "Draft", tone: "info" },
  edited: { label: "Edited", tone: "info" },
  approved: { label: "Approved", tone: "positive" },
  sent: { label: "Sent", tone: "neutral" },
  skipped: { label: "Skipped", tone: "neutral" },
}

const name = (d: EmailDraft) => `${d.lead.firstName} ${d.lead.lastName}`.trim() || d.lead.email || "Unnamed lead"
const errorText = (e: unknown) => (e instanceof Error ? e.message : undefined)

/** Real drafted emails: what Claude wrote, why, and the review actions. Nothing here sends email. */
export function DraftsView({ icpId }: { icpId?: string }) {
  return <WorkspaceGate>{(wsId) => <Drafts key={wsId} wsId={wsId} icpId={icpId} />}</WorkspaceGate>
}

function Drafts({ wsId, icpId }: { wsId: string; icpId?: string }) {
  const emails = useApi(() => fetchEmails(wsId), [wsId])
  const [filter, setFilter] = useState("review")
  const [openId, setOpenId] = useState<string | null>(null)

  if (emails.error && !emails.data) return <BackendError message={emails.error} onRetry={emails.reload} />
  if (!emails.data) return <TableSkeleton rows={6} />

  const list = emails.data.filter((d) => !icpId || d.lead.icpId === icpId)
  const visible = list.filter((d) => FILTERS.find((f) => f.value === filter)!.test(d.status))
  const open = list.find((d) => d.id === openId) ?? null

  if (list.length === 0)
    return (
      <EmptyState
        icon={Inbox}
        title="No drafts yet"
        description="Pick people who are leads on the People page and choose Write emails. Their drafts land here for review."
        action={
          <Button asChild variant="outline">
            <Link href="/people">Go to People</Link>
          </Button>
        }
      />
    )

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Filter drafts" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              filter === f.value ? "border-data bg-data/10 font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {f.label} <span className="tabular-nums opacity-70">{list.filter((d) => f.test(d.status)).length}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here" description="Try another filter." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Hook</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Written</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => setOpenId(d.id)}>
                  <TableCell className="max-w-56">
                    <p className="truncate font-medium">{name(d)}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {[d.lead.title, d.lead.company].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-96">
                    <p className="truncate font-medium">{d.subject}</p>
                    <p className="truncate text-[13px] text-muted-foreground">{d.body.split("\n")[0]}</p>
                  </TableCell>
                  <TableCell>
                    {d.hook ? <Pill tone="info">From a post · {d.relevance}/5</Pill> : <Pill>No hook</Pill>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" title={`Claude's own confidence: ${d.confidence}`}>
                    {d.score ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Pill tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Pill>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{shortDate(d.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {open && (
        <DraftSheet
          key={open.id + open.updatedAt}
          wsId={wsId}
          draft={open}
          onClose={() => setOpenId(null)}
          onChanged={(next) => {
            if (next) setOpenId(next)
            emails.reload()
          }}
        />
      )}
    </div>
  )
}

function DraftSheet({
  wsId,
  draft,
  onClose,
  onChanged,
}: {
  wsId: string
  draft: EmailDraft
  onClose: () => void
  /** After any change; with the new draft's id when it was rewritten. */
  onChanged: (nextId?: string) => void
}) {
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [instruction, setInstruction] = useState("")
  const [busy, setBusy] = useState("")
  const dirty = subject.trim() !== draft.subject || body.trim() !== draft.body
  const sent = draft.status === "sent"

  const save = async (status?: "draft" | "approved" | "skipped") => {
    setBusy(status ?? "save")
    try {
      await updateEmail(wsId, draft.id, { ...(dirty ? { subject: subject.trim(), body: body.trim() } : {}), ...(status ? { status } : {}) })
      toast.success(
        status === "approved" ? "Approved" : status === "skipped" ? "Skipped" : status === "draft" ? "Back to review" : "Saved your edits",
      )
      onChanged()
    } catch (e) {
      toast.error("Couldn't save it", { description: errorText(e) })
    } finally {
      setBusy("")
    }
  }

  const rewrite = async () => {
    setBusy("rewrite")
    const id = toast.loading(`Rewriting ${name(draft)}'s email…`)
    try {
      const r = await generateEmails(wsId, [draft.lead.id], instruction)
      const [result] = r.results
      if (result?.status !== "drafted") throw new Error(result?.reason ?? "It wasn't rewritten.")
      toast.success("Rewritten", { id, description: `Claude cost ${formatUsd(r.costUsd)}.` })
      onChanged(result.emailId ?? undefined)
    } catch (e) {
      toast.error("Couldn't rewrite it", { id, description: errorText(e) })
    } finally {
      setBusy("")
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent className="w-full! gap-0 overflow-y-auto sm:max-w-xl!">
        <SheetHeader className="px-5 pt-5 pb-4">
          <SheetTitle className="text-lg">{name(draft)}</SheetTitle>
          <SheetDescription>
            {[draft.lead.title, draft.lead.company].filter(Boolean).join(" at ") || "No title"}
            {draft.lead.email ? ` · ${draft.lead.email}` : " · no email address yet"}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Pill tone={STATUS[draft.status].tone}>{STATUS[draft.status].label}</Pill>
            {draft.score !== null && <Pill tone={draft.score >= 70 ? "positive" : draft.score >= 40 ? "warning" : "negative"}>Score {draft.score}</Pill>}
            <span className="text-xs text-muted-foreground tabular-nums">
              Confidence {draft.confidence} · cost {formatUsd(draft.costUsd)}
              {draft.flags.length ? ` · ${draft.flags.map((f) => f.replaceAll("_", " ")).join(", ")}` : ""}
            </span>
          </div>
        </SheetHeader>

        <section className="space-y-3 border-t border-rule px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="draft-subject">Subject</Label>
            <Input id="draft-subject" value={subject} disabled={sent} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="draft-body">Body</Label>
            <Textarea id="draft-body" rows={10} value={body} disabled={sent} onChange={(e) => setBody(e.target.value)} />
            {draft.edited && <p className="text-xs text-muted-foreground">Edited. Claude&apos;s original is kept.</p>}
          </div>
          {!sent && (
            <div className="flex flex-wrap gap-2">
              {dirty && (
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void save()}>
                  <Save /> Save edits
                </Button>
              )}
              {draft.status !== "approved" && (
                <Button size="sm" disabled={!!busy || !subject.trim() || !body.trim()} onClick={() => void save("approved")}>
                  <Check /> {dirty ? "Save and approve" : "Approve"}
                </Button>
              )}
              {draft.status !== "skipped" && (
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void save("skipped")}>
                  <X /> Skip
                </Button>
              )}
              {(draft.status === "approved" || draft.status === "skipped") && (
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void save("draft")}>
                  <RotateCcw /> Back to review
                </Button>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Approving marks it ready. Nothing is sent from here.</p>
        </section>

        {draft.scoreReasons.length > 0 && (
          <section className="space-y-2 border-t border-rule px-5 py-4">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Why it scored {draft.score}</h3>
            <ul className="list-disc space-y-0.5 pl-5 text-[13px]">
              {draft.scoreReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Scored against the emails rated good and bad and the sample email.</p>
          </section>
        )}

        <section className="space-y-2 border-t border-rule px-5 py-4">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Why this email</h3>
          {draft.hook ? (
            <>
              <p className="text-[13px]">
                <span className="font-medium">Hook:</span> {draft.hook}
              </p>
              {draft.chosenPost && (
                <blockquote className="rounded-md bg-muted/50 px-3 py-2 text-[13px] leading-relaxed">
                  <a href={draft.chosenPost.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                    {draft.chosenPost.whose === "person" ? "Their" : "Their company's"} {draft.chosenPost.source} post
                    {draft.chosenPost.postedAt ? `, ${shortDate(draft.chosenPost.postedAt)}` : ""} <ExternalLink className="size-3" aria-hidden />
                  </a>
                  <span className="mt-1 line-clamp-6 block">{draft.chosenPost.text || "No text"}</span>
                </blockquote>
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              No hook: there were no posts to read, or none worth mentioning. The email opens on their role or company instead.
            </p>
          )}
          {draft.points.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs text-muted-foreground">Hooks found, best first</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-[13px]">
                {draft.points.map((p) => (
                  <li key={p.rank}>
                    {p.hook || p.point} <span className="text-muted-foreground tabular-nums">({p.relevance}/5)</span>
                    <span className="block text-xs text-muted-foreground">
                      {[p.source, p.hook ? p.point : "", p.why].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section className="space-y-2 border-t border-rule px-5 py-4">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Rate it</h3>
          <p className="text-xs text-muted-foreground">
            Good and bad emails are shown to Claude as examples for this ICP next time.
            {draft.examplesUsed ? ` This one was written with ${draft.examplesUsed} rated examples.` : ""}
          </p>
          <FeedbackControl key={draft.feedback?.updatedAt ?? "unrated"} workspaceId={wsId} draft={draft} onSaved={() => onChanged()} />
        </section>

        {!sent && (
          <section className="space-y-2 border-t border-rule px-5 py-4">
            <Label htmlFor="draft-instruction">Rewrite with Claude</Label>
            <Input
              id="draft-instruction"
              placeholder="Optional: shorter, mention their new store…"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Runs hook selection and the email again, replacing this draft and your edits.</p>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void rewrite()}>
              <Sparkles /> {busy === "rewrite" ? "Rewriting…" : "Rewrite"}
            </Button>
          </section>
        )}
      </SheetContent>
    </Sheet>
  )
}
