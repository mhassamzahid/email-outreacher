"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, Sparkles, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fetchLeadPosts, generateEmails } from "@/lib/api"
import { COST_PER_POST, FETCHED_SOURCES } from "@/lib/costs"
import { SOURCE_LABEL, formatUsd } from "@/lib/format"
import { resolveTemplate } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import type { ICP } from "@/lib/types"

// The backend takes up to 25 leads per request; bigger runs go in batches, one after another.
const BATCH = 25

function batches<T>(list: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += BATCH) out.push(list.slice(i, i + BATCH))
  return out
}

/** Fetch the leads' recent LinkedIn and Instagram posts through Apify, for the sources the ICP has on. */
export function EnrichDialog({
  icp,
  leadIds,
  open,
  onOpenChange,
}: {
  icp: ICP
  leadIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { leads, settings, currentWorkspaceId, reloadLeads } = useStore()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState("")
  const targets = leads.filter((l) => leadIds.includes(l.id))
  const sources = FETCHED_SOURCES.filter((s) => icp.enabledSources.includes(s))
  const maxPosts = Math.min(20, Math.max(1, icp.postsPerSource ?? settings.postsPerLead))
  const maxAgeDays = Math.min(365, Math.max(1, icp.maxPostAgeDays ?? settings.maxPostAgeDays))
  const withUrl = {
    linkedin: targets.filter((l) => l.linkedinUrl).length,
    instagram: targets.filter((l) => l.instagramUrl).length,
  }
  // At most: every lead with a URL has the full number of posts. Instagram can also fall back to the
  // company's account from Lead Intel, so leads without their own may still cost a little.
  const ceiling = sources.reduce((sum, s) => sum + withUrl[s] * maxPosts * COST_PER_POST[s], 0)

  const run = async () => {
    setRunning(true)
    let found = 0
    let cost = 0
    let error: string | null = null
    const groups = batches(targets.map((l) => l.id))
    try {
      for (const [i, ids] of groups.entries()) {
        setProgress(groups.length > 1 ? `Batch ${i + 1} of ${groups.length}` : "")
        const r = await fetchLeadPosts(currentWorkspaceId, { leadIds: ids, maxPosts, maxAgeDays, sources: [...sources] })
        found += r.results.reduce((sum, x) => sum + x.new, 0)
        cost += r.costUsd ?? 0
        if (r.error) {
          error = r.error
          break
        }
      }
      if (error) toast.error("Apify stopped the run", { description: `${error} ${found} new posts were saved before it stopped.` })
      else toast.success(`Saved ${found} new post${found === 1 ? "" : "s"}`, { description: `Apify charged ${formatUsd(cost)}.` })
      onOpenChange(false)
    } catch (e) {
      toast.error("Couldn't fetch posts", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setRunning(false)
      setProgress("")
      reloadLeads()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Fetch posts for {targets.length} lead{targets.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Their posts from the last {maxAgeDays} days, up to {maxPosts} per network, through Apify. Hook selection reads them
            when emails are written.
          </DialogDescription>
        </DialogHeader>
        {sources.length === 0 ? (
          <p className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 flex-none text-warning" />
            Turn on LinkedIn or Instagram in this ICP&apos;s Enrichment sources first.
          </p>
        ) : (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            {sources.map((s) => (
              <div key={s} className="contents">
                <dt className="text-muted-foreground">{SOURCE_LABEL[s]}</dt>
                <dd className="text-right tabular-nums">
                  {withUrl[s]} with a profile{s === "instagram" ? " (or their company's)" : ""}
                </dd>
              </div>
            ))}
            <dt className="text-muted-foreground">Costs at most</dt>
            <dd className="text-right font-medium tabular-nums">{formatUsd(ceiling)}</dd>
          </dl>
        )}
        <p className="text-xs text-muted-foreground">
          Posts per network and how far back come from Settings. What Apify actually charges shows on the Usage page.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Cancel
          </Button>
          <Button disabled={running || sources.length === 0 || targets.length === 0} onClick={() => void run()}>
            <Sparkles /> {running ? `Fetching…${progress ? ` ${progress}` : ""}` : "Fetch posts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Write emails for the leads with Claude: hook selection, the email, then its score. Drafts go to Review. */
export function GenerateDialog({
  icp,
  leadIds,
  open,
  onOpenChange,
}: {
  icp: ICP
  leadIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { templates, currentWorkspaceId, reloadLeads } = useStore()
  const [instruction, setInstruction] = useState("")
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState("")
  const hookPrompt = resolveTemplate(templates, icp, "hook")
  const emailPrompt = resolveTemplate(templates, icp, "email")

  const run = async () => {
    setRunning(true)
    let drafted = 0
    let cost = 0
    const problems: string[] = []
    const groups = batches(leadIds)
    try {
      for (const [i, ids] of groups.entries()) {
        setProgress(groups.length > 1 ? `Batch ${i + 1} of ${groups.length}` : "")
        const r = await generateEmails(currentWorkspaceId, ids, instruction)
        drafted += r.drafted
        cost += r.costUsd
        problems.push(...r.results.filter((x) => x.status !== "drafted" && x.reason).map((x) => x.reason!))
      }
      const reasons = [...new Set(problems)]
      const description = [cost ? `Claude cost ${formatUsd(cost)}.` : "", ...reasons].filter(Boolean).join(" ") || undefined
      if (drafted) toast.success(`${drafted} email${drafted === 1 ? "" : "s"} written, ready in Review`, { description })
      else toast.error("No emails were written", { description })
      onOpenChange(false)
    } catch (e) {
      toast.error("Couldn't write them", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setRunning(false)
      setProgress("")
      reloadLeads()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Write emails for {leadIds.length} lead{leadIds.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Claude picks hooks from their posts, writes each email, then scores it. Nothing is sent: drafts wait in Review.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Hook selection prompt</dt>
          <dd className="text-right">{hookPrompt?.name ?? "Default"}</dd>
          <dt className="text-muted-foreground">Email prompt</dt>
          <dd className="text-right">{emailPrompt?.name ?? "Default"}</dd>
        </dl>
        <div className="space-y-1.5">
          <Label htmlFor="generate-instruction">Extra instruction (optional)</Label>
          <Input
            id="generate-instruction"
            placeholder="e.g. keep it under 80 words"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Claude charges per email; what each run cost shows on the{" "}
          <Link href="/usage" className="underline">
            Usage
          </Link>{" "}
          page. Leads already drafted get a new draft in place of their unsent one.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Cancel
          </Button>
          <Button disabled={running || leadIds.length === 0} onClick={() => void run()}>
            <Wand2 /> {running ? `Writing…${progress ? ` ${progress}` : ""}` : "Write emails"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
