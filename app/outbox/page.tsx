"use client"

import { OutboxView } from "@/components/outbox/outbox-view"
import { PageHeader } from "@/components/page-header"

export default function OutboxPage() {
  return (
    <>
      <PageHeader
        title="Outbox"
        description="Every lead you queued, the mailbox their emails go out from, and which of the three emails have been sent."
      />
      <div className="px-4 pb-10 md:px-8">
        <OutboxView />
      </div>
    </>
  )
}
