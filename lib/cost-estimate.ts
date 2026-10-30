import type { CostEstimate, CostItem, CostUnit } from "./api"

export const UNIT_LABEL: Record<CostUnit, string> = {
  month: "per month",
  lead: "per lead",
  email: "per email sent",
}

/** Emails sent in a month: leads times the average sent to each. */
export function sendsPerMonth(e: CostEstimate): number {
  return e.leadsPerMonth * e.emailsPerLead
}

/** What one item costs in a month at this volume. */
export function monthlyCost(item: CostItem, e: CostEstimate): number {
  if (!item.enabled) return 0
  if (item.unit === "lead") return item.amountUsd * e.leadsPerMonth
  if (item.unit === "email") return item.amountUsd * sendsPerMonth(e)
  return item.amountUsd
}

export interface CostTotals {
  monthly: number
  perLead: number | null
  perEmail: number | null
  replies: number
  perReply: number | null
  byCategory: { category: string; monthly: number }[]
}

export function totals(e: CostEstimate): CostTotals {
  const monthly = e.items.reduce((sum, item) => sum + monthlyCost(item, e), 0)
  const sends = sendsPerMonth(e)
  const replies = (e.leadsPerMonth * e.replyRatePct) / 100
  const byCategory = new Map<string, number>()
  for (const item of e.items) {
    const key = item.category.trim() || "Other"
    byCategory.set(key, (byCategory.get(key) ?? 0) + monthlyCost(item, e))
  }
  return {
    monthly,
    perLead: e.leadsPerMonth > 0 ? monthly / e.leadsPerMonth : null,
    perEmail: sends > 0 ? monthly / sends : null,
    replies,
    perReply: replies > 0 ? monthly / replies : null,
    byCategory: [...byCategory].map(([category, m]) => ({ category, monthly: m })).sort((a, b) => b.monthly - a.monthly),
  }
}
