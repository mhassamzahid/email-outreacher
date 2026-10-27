"use client"

import { ExternalLink } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { SourceIcon } from "@/components/source-icon"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { ApiPost } from "@/lib/api"
import { shortDate } from "@/lib/format"

/** A lead's fetched posts, newest first, each linking to the original. */
export function PostsSheet({
  name,
  posts,
  loading,
  onClose,
}: {
  name: string
  posts: ApiPost[]
  loading: boolean
  onClose: () => void
}) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full! gap-0 overflow-y-auto sm:max-w-lg!">
        <SheetHeader className="px-5 pt-5 pb-4">
          <SheetTitle className="text-lg">{name}&apos;s posts</SheetTitle>
          <SheetDescription>
            Recent LinkedIn posts, and Instagram posts from their own or their company&apos;s account.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 border-t border-rule px-5 py-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : posts.length === 0 ? (
            <EmptyState icon={ExternalLink} title="No posts yet" description="Fetch posts from the People page." />
          ) : (
            posts.map((p) => (
              <article key={p.id} className="space-y-1.5 rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <SourceIcon source={p.source} />
                  <span className="capitalize">{p.source}</span>
                  <span>·</span>
                  <span className="tabular-nums">{p.postedAt ? shortDate(p.postedAt) : "Date unknown"}</span>
                  {p.isRepost && <span>· repost</span>}
                  {p.mediaType !== "text" && <span className="capitalize">· {p.mediaType}</span>}
                  <a href={p.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-0.5 hover:underline">
                    Open <ExternalLink className="size-3" aria-hidden />
                  </a>
                </div>
                <p className="line-clamp-6 text-[13px] leading-relaxed whitespace-pre-line">{p.text || "No text (image or video only)."}</p>
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
