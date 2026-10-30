"use client"

import { PageHeader } from "@/components/page-header"
import { RepliesView } from "@/components/replies/replies-view"

export default function RepliesPage() {
  return (
    <>
      <PageHeader title="Replies" description="Leads who wrote back to a Coldbrew campaign, read from CheapSequencer's inbox." />
      <div className="px-4 pb-10 md:px-8">
        <RepliesView />
      </div>
    </>
  )
}
