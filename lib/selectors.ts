import type { Generation, ICP, Lead, LeadStatus, PromptKind, PromptTemplate, PromptVersion } from "./types"
import { LEAD_STATUSES } from "./types"

export function resolveTemplate(
  templates: PromptTemplate[],
  icp: Pick<ICP, "hookPromptId" | "emailPromptId">,
  kind: PromptKind,
): PromptTemplate | undefined {
  const id = kind === "hook" ? icp.hookPromptId : icp.emailPromptId
  return templates.find((t) => t.id === id) ?? templates.find((t) => t.kind === kind && t.isDefault)
}

export function currentVersion(versions: PromptVersion[], template: PromptTemplate | undefined) {
  return template ? versions.find((v) => v.id === template.currentVersionId) : undefined
}

export function statusCounts(leads: Lead[]): Record<LeadStatus, number> {
  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>
  for (const l of leads) counts[l.status]++
  return counts
}

/** Latest generation per lead. */
export function generationByLead(generations: Generation[]): Map<string, Generation> {
  const map = new Map<string, Generation>()
  for (const g of generations) {
    const prev = map.get(g.leadId)
    if (!prev || prev.createdAt <= g.createdAt) map.set(g.leadId, g)
  }
  return map
}

/** ICPs that use a template, explicitly or through the default. */
export function icpsUsingTemplate(icps: ICP[], template: PromptTemplate): ICP[] {
  return icps.filter((icp) => {
    const id = template.kind === "hook" ? icp.hookPromptId : icp.emailPromptId
    return id === template.id || (id === null && template.isDefault)
  })
}

export const ENRICHABLE: LeadStatus[] = ["imported", "failed", "no_content"]
export const GENERATABLE: LeadStatus[] = ["enriched", "no_content", "generated", "skipped"]

export type PipelineStage = "approved" | "review" | "ready" | "pending" | "dropped"

/** Pipeline order, strongest first. One hue ramp for progress, grey for what left the pipeline. */
export const PIPELINE_STAGES: { key: PipelineStage; label: string; swatch: string }[] = [
  { key: "approved", label: "Approved or sent", swatch: "bg-data" },
  { key: "review", label: "To review", swatch: "bg-data-mid" },
  { key: "ready", label: "Ready to draft", swatch: "bg-data-soft" },
  { key: "pending", label: "Not enriched", swatch: "bg-foreground/15" },
  { key: "dropped", label: "Skipped or failed", swatch: "bg-foreground/35" },
]

const STAGE_OF: Record<LeadStatus, PipelineStage> = {
  approved: "approved",
  sent: "approved",
  generated: "review",
  enriched: "ready",
  no_content: "ready",
  imported: "pending",
  enriching: "pending",
  skipped: "dropped",
  failed: "dropped",
}

export function pipeline(leads: Lead[]): Record<PipelineStage, number> {
  const counts: Record<PipelineStage, number> = { approved: 0, review: 0, ready: 0, pending: 0, dropped: 0 }
  for (const l of leads) counts[STAGE_OF[l.status]]++
  return counts
}

/** The scoring template in use (Settings), falling back to the default scoring template. */
export function resolveScoringTemplate(templates: PromptTemplate[], scoring: { promptId: string | null }) {
  return templates.find((t) => t.id === scoring.promptId && t.kind === "score") ?? templates.find((t) => t.kind === "score" && t.isDefault)
}
