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
