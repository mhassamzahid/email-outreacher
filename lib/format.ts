import type { GenerationFlag, GenerationStatus, Lead, LeadStatus, Source } from "./types"

export function formatUsd(n: number): string {
  if (n > 0 && n < 0.1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export function fullName(lead: Pick<Lead, "firstName" | "lastName">): string {
  return `${lead.firstName} ${lead.lastName}`.trim()
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  imported: "Not enriched",
  enriching: "Enriching",
  enriched: "Enriched",
  no_content: "No content",
  generated: "To review",
  approved: "Approved",
  sent: "Sent",
  skipped: "Skipped",
  failed: "Failed",
}

/** Solid color used for status dots and the breakdown bar. */
export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  imported: "bg-foreground/20",
  enriching: "bg-data-mid",
  enriched: "bg-data-soft ring-1 ring-inset ring-data-mid",
  no_content: "bg-foreground/20",
  generated: "bg-data-mid",
  approved: "bg-positive",
  sent: "bg-data",
  skipped: "bg-foreground/35",
  failed: "bg-negative",
}

export const GENERATION_STATUS_LABEL: Record<GenerationStatus, string> = {
  draft: "Draft",
  edited: "Edited",
  approved: "Approved",
  sent: "Sent",
  skipped: "Skipped",
}

export const SOURCE_LABEL: Record<Source, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "Website",
}

export const FLAG_LABEL: Record<GenerationFlag, string> = {
  sensitive_topic: "Sensitive topic",
  repost: "Repost",
  old_content: "Old content",
  low_relevance: "Low relevance",
  word_count: "Word count",
}

// OpenAI API model IDs: flagship, balanced (default), cost-sensitive high volume.
export const MODELS = ["gpt-6-astra", "gpt-6.1-sol", "gpt-6-luna"]

/** First sentence after the greeting, used as a preview in tables. */
export function firstLine(body: string): string {
  const paras = body.split("\n\n").map((p) => p.trim())
  const content = /^(hi|hey|hello|dear)\b/i.test(paras[0] ?? "") ? paras[1] : paras[0]
  return (content ?? "").split(/(?<=[.?])\s/)[0] ?? ""
}

/** 4210 → "4.2k", 21400 → "21k". */
export function compactCount(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}k`
}
