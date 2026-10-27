"use client"

import { ReviewQueue } from "@/components/review-queue"
import { useIcpParam } from "@/hooks/use-icp"

export default function IcpReviewPage() {
  const icp = useIcpParam()
  if (!icp) return null
  return <ReviewQueue icpId={icp.id} />
}
