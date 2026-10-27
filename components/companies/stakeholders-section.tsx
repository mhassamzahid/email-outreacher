"use client"

import Link from "next/link"
import { useState } from "react"
import { ExternalLink, MailCheck, RotateCw, UserSearch } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Pill, type PillTone } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { type Stakeholder, fetchStakeholders, revealStakeholders, useApi } from "@/lib/api"

const EMAIL_TONE: Record<string, PillTone> = { verified: "positive", unverified: "warning", no_match: "neutral" }

function emailLabel(s: Stakeholder): { text: string; tone: PillTone } {
  if (!s.revealedAt) return s.hasEmail ? { text: "Has email", tone: "info" } : { text: "No email on file", tone: "neutral" }
  if (s.emailStatus === "no_match") return { text: "No match", tone: "neutral" }
  if (!s.email) return { text: "No email found", tone: "neutral" }
  return { text: s.emailStatus ?? "Email", tone: EMAIL_TONE[s.emailStatus ?? ""] ?? "neutral" }
}

/** The people Apollo found at one company, and revealing their emails (which turns them into leads). */
export function StakeholdersSection({
  workspaceId,
  companyId,
  onFind,
  version,
}: {
  workspaceId: string
  companyId: string
  onFind: () => void
  /** Bumped by the parent after a search, so this list reloads. */
  version: number
}) {
  const people = useApi(() => fetchStakeholders(workspaceId, companyId), [workspaceId, companyId, version])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const list = people.data ?? []
  const hidden = list.filter((s) => !s.revealedAt)
  const picked = hidden.filter((s) => selected.has(s.id))

  const reveal = async () => {
    setBusy(true)
    try {
      const r = await revealStakeholders(workspaceId, picked.map((s) => s.id))
      if (r.error) toast.error("Apollo refused", { description: r.error })
      const leads = r.outcomes.filter((o) => o.leadCreated).length
      const noMatch = r.outcomes.filter((o) => o.status === "no_match").length
      if (r.revealed || noMatch)
        toast.success(`Revealed ${r.revealed} ${r.revealed === 1 ? "person" : "people"}`, {
          description: [leads ? `${leads} added as leads.` : "", noMatch ? `${noMatch} had no match (no credits used).` : ""]
            .filter(Boolean)
            .join(" ") || undefined,
        })
      setSelected(new Set())
      people.reload()
    } catch (e) {
      toast.error("Couldn't reveal", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {people.loading && !people.data ? (
        <Skeleton className="h-16 w-full" />
      ) : people.error ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          Couldn&apos;t load: {people.error}
          <Button variant="ghost" size="sm" onClick={people.reload}>
            <RotateCw /> Retry
          </Button>
        </p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody found yet. Search Apollo for the owners and decision makers.</p>
      ) : (
        <ul className="divide-y divide-rule rounded-md border">
          {list.map((s) => {
            const label = emailLabel(s)
            return (
              <li key={s.id} className="flex items-start gap-3 px-3 py-2">
                <Checkbox
                  className="mt-0.5"
                  aria-label={`Select ${s.firstName}`}
                  checked={!!s.revealedAt || selected.has(s.id)}
                  disabled={!!s.revealedAt}
                  onCheckedChange={(v) =>
                    setSelected((set) => {
                      const next = new Set(set)
                      if (v === true) next.add(s.id)
                      else next.delete(s.id)
                      return next
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">{s.title || "No title"}</p>
                  {s.email && <p className="truncate text-[13px]">{s.email}</p>}
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <Pill tone={label.tone} className="capitalize">
                    {label.text}
                  </Pill>
                  <div className="flex items-center gap-2 text-xs">
                    {s.linkedinUrl && (
                      <a href={s.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
                        LinkedIn <ExternalLink className="size-3" aria-hidden />
                      </a>
                    )}
                    {s.leadId && (
                      <Link href="/leads" className="text-data hover:underline">
                        Lead
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onFind}>
          <UserSearch /> {list.length ? "Search again" : "Find stakeholders"}
        </Button>
        {hidden.length > 0 && (
          <Button size="sm" disabled={picked.length === 0 || busy} onClick={() => setConfirming(true)}>
            <MailCheck /> {busy ? "Revealing…" : picked.length ? `Reveal ${picked.length} ${picked.length === 1 ? "email" : "emails"}` : "Tick people to reveal"}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Reveal ${picked.length} ${picked.length === 1 ? "email" : "emails"}?`}
        description={
          <>
            This uses Apollo credits: about 1 per person whose email comes back, and none when Apollo has no match.
            Revealed people are added as leads in this workspace, and are never charged for twice.
          </>
        }
        confirmLabel={`Reveal ${picked.length}`}
        onConfirm={() => void reveal()}
      />
    </div>
  )
}
