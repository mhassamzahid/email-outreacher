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
  imported: "Imported",
  enriching: "Enriching",
  enriched: "Enriched",
  no_content: "No content",
  generated: "Generated",
  approved: "Approved",
  skipped: "Skipped",
  failed: "Failed",
}

/** Solid color used for status dots and the breakdown bar. */
export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  imported: "bg-slate-400",
  enriching: "bg-sky-400",
  enriched: "bg-blue-500",
  no_content: "bg-zinc-300 dark:bg-zinc-600",
  generated: "bg-violet-500",
  approved: "bg-emerald-500",
  skipped: "bg-amber-400",
  failed: "bg-red-500",
}

export const GENERATION_STATUS_LABEL: Record<GenerationStatus, string> = {
  draft: "Draft",
  edited: "Edited",
  approved: "Approved",
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

export const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]

/** First sentence after the greeting, used as a preview in tables. */
export function firstLine(body: string): string {
  const paras = body.split("\n\n").map((p) => p.trim())
  const content = /^(hi|hey|hello|dear)\b/i.test(paras[0] ?? "") ? paras[1] : paras[0]
  return (content ?? "").split(/(?<=[.?])\s/)[0] ?? ""
}
