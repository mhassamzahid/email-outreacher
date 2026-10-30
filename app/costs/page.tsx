"use client"

import { CostEstimator } from "@/components/costs/cost-estimator"
import { PageHeader } from "@/components/page-header"

export default function CostsPage() {
  return (
    <>
      <PageHeader
        title="Cost estimator"
        description="Pick how you run Coldbrew and see what it costs a month, line by line."
      />
      <div className="px-4 pb-10 md:px-8">
        <CostEstimator />
      </div>
    </>
  )
}
