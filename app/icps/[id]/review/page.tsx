"use client"

import { DraftsView } from "@/components/review/drafts-view"
import { useIcpParam } from "@/hooks/use-icp"

export default function IcpReviewPage() {
  const icp = useIcpParam()
  if (!icp) return null
  return <DraftsView icpId={icp.id} />
}
