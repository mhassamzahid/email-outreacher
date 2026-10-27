"use client"

import { PageHeader } from "@/components/page-header"
import { ReviewQueue } from "@/components/review-queue"

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Review queue"
        description="Every generated email across ICPs. Approve, edit, skip or send; anything that scores below the threshold waits here."
      />
      <div className="px-4 pb-10 md:px-8">
        <ReviewQueue />
      </div>
    </>
  )
}
