"use client"

import { PageHeader } from "@/components/page-header"
import { DraftsView } from "@/components/review/drafts-view"

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Review"
        description="Emails Claude drafted for your leads, with the hook and the posts behind each one. Edit, approve or skip. Nothing is sent from here."
      />
      <div className="px-4 pb-10 md:px-8">
        <DraftsView />
      </div>
    </>
  )
}
