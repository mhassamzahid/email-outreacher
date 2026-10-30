import type { CostBasis, CostEstimate, CostItem, CostReference } from "./api"

export const BASIS_LABEL: Record<CostBasis, string> = {
  lead: "per lead",
  month: "a month",
  email: "per email sent",
}

/** Emails sent in a month: leads times the average sent to each. */
export function sendsPerMonth(e: CostEstimate): number {
  return e.leadsPerMonth * e.emailsPerLead
}

/** How many uses of an item a month. */
export function usesPerMonth(item: CostItem, e: CostEstimate): number {
  if (item.basis === "lead") return item.quantity * e.leadsPerMonth
  if (item.basis === "email") return item.quantity * sendsPerMonth(e)
  return item.quantity
}

/** What one item costs in a month at this volume. */
export function monthlyCost(item: CostItem, e: CostEstimate): number {
  return item.enabled ? item.priceUsd * usesPerMonth(item, e) : 0
}

/** One Claude use's price from its tokens and the model's price per million tokens. */
export function claudePrice(ref: CostReference | undefined, model: string, tokensIn: number, tokensOut: number): number | null {
  const p = ref?.claudePrices.find((x) => x.model === model)
  if (!p) return null
  return Math.round(((tokensIn * p.inputPerMtok + tokensOut * p.outputPerMtok) / 1e6) * 1e6) / 1e6
}

export interface CostTotals {
  monthly: number
  perLead: number | null
  perEmail: number | null
  replies: number
  perReply: number | null
}

export function totals(e: CostEstimate): CostTotals {
  const monthly = e.items.reduce((sum, item) => sum + monthlyCost(item, e), 0)
  const sends = sendsPerMonth(e)
  const replies = (e.leadsPerMonth * e.replyRatePct) / 100
  return {
    monthly,
    perLead: e.leadsPerMonth > 0 ? monthly / e.leadsPerMonth : null,
    perEmail: sends > 0 ? monthly / sends : null,
    replies,
    perReply: replies > 0 ? monthly / replies : null,
  }
}

/** Items grouped by category, in the order categories first appear, each with its monthly subtotal. */
export function byCategory(e: CostEstimate): { category: string; items: CostItem[]; monthly: number }[] {
  const groups = new Map<string, CostItem[]>()
  for (const item of e.items) {
    const key = item.category.trim() || "Other"
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups].map(([category, items]) => ({ category, items, monthly: items.reduce((s, i) => s + monthlyCost(i, e), 0) }))
}
