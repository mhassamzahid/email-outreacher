"use client"

import { CostEstimator } from "@/components/costs/cost-estimator"
import { PageHeader } from "@/components/page-header"

export default function CostsPage() {
  return (
    <>
      <PageHeader
        title="Cost estimator"
        description="What Coldbrew costs a month at your volume. Add, edit or switch off any line; each note says where its number comes from."
      />
      <div className="px-4 pb-10 md:px-8">
        <CostEstimator />
      </div>
    </>
  )
}
