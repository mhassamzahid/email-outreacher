"use client"

import { useState } from "react"
import { Inbox, RotateCw } from "lucide-react"
import { BackendError, WorkspaceGate } from "@/components/companies/backend-state"
import { EmptyState } from "@/components/empty-state"
import { Pill } from "@/components/status"
import { TableSkeleton } from "@/components/table-skeleton"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { type ReplyThread, fetchReplies, fetchReplyThread, useApi } from "@/lib/api"
import { fullDate, shortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Conversations where a lead wrote back, read from CheapSequencer's inbox. Nothing is answered or marked read here. */
export function RepliesView() {
  return <WorkspaceGate>{(wsId) => <Replies key={wsId} wsId={wsId} />}</WorkspaceGate>
}

function Replies({ wsId }: { wsId: string }) {
  const threads = useApi(() => fetchReplies(wsId), [wsId])
  const [openId, setOpenId] = useState<string | null>(null)

  if (threads.error && !threads.data) return <BackendError message={threads.error} onRetry={threads.reload} />
  if (!threads.data) return <TableSkeleton rows={6} />

  const open = threads.data.find((t) => t.id === openId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[13px] text-muted-foreground">
          {threads.data.length} conversation{threads.data.length === 1 ? "" : "s"} with a reply. To answer, use the inbox in CheapSequencer or the
          mailbox itself.
        </p>
        <Button size="sm" variant="outline" onClick={threads.reload} disabled={threads.loading}>
          <RotateCw /> Refresh
        </Button>
      </div>

      {threads.data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No replies yet"
          description="When a lead in a Coldbrew campaign writes back, the conversation shows up here and their follow-ups stop."
        />
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
          {threads.data.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpenId(t.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2 flex-none rounded-full", t.unreadCount ? "bg-data" : "bg-transparent")}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("truncate text-sm", t.unreadCount ? "font-semibold" : "font-medium")}>
                      {t.leadName || t.leadEmail}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{t.campaign.replace(/^Coldbrew: /, "")}</span>
                    <span className="ml-auto flex-none text-xs text-muted-foreground tabular-nums">
                      {t.lastMessageAt ? shortDate(t.lastMessageAt) : ""}
                    </span>
                  </span>
                  <span className="block truncate text-[13px]">{t.subject}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{t.preview}</span>
                </span>
                {t.classification && <Pill tone={t.classification === "interested" ? "positive" : "neutral"}>{t.classification}</Pill>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <ThreadSheet wsId={wsId} thread={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function ThreadSheet({ wsId, thread, onClose }: { wsId: string; thread: ReplyThread; onClose: () => void }) {
  const detail = useApi(() => fetchReplyThread(wsId, thread.id), [wsId, thread.id])
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full! gap-0 overflow-y-auto sm:max-w-xl!">
        <SheetHeader className="px-5 pt-5 pb-4">
          <SheetTitle className="text-lg">{thread.leadName || thread.leadEmail}</SheetTitle>
          <SheetDescription>
            {thread.leadEmail} · {thread.campaign} · with {thread.mailbox}
          </SheetDescription>
        </SheetHeader>
        {detail.error && <p className="border-t border-rule px-5 py-4 text-sm text-destructive">Couldn&apos;t load it: {detail.error}</p>}
        {!detail.data && !detail.error && (
          <div className="space-y-3 border-t border-rule px-5 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {detail.data?.messages.map((m) => (
          <section
            key={m.id}
            className={cn("space-y-1.5 border-t border-rule px-5 py-4", m.direction === "inbound" && "bg-data/5")}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[13px] font-medium">
                {m.direction === "inbound" ? thread.leadName || m.fromName || m.fromAddress : m.fromName || m.fromAddress}
              </span>
              <span className="text-xs text-muted-foreground">{m.direction === "inbound" ? "replied" : "sent"}</span>
              {m.sentAt && <span className="ml-auto text-xs text-muted-foreground">{fullDate(m.sentAt)} UTC</span>}
            </div>
            <p className="text-[13px] leading-relaxed whitespace-pre-line">{m.body.trim()}</p>
          </section>
        ))}
      </SheetContent>
    </Sheet>
  )
}
