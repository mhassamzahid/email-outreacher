import type { EnrichmentItem, ICP, Lead, PromptKind } from "./types"

// Real, client-side prompt rendering. No eval: placeholders are looked up in a flat map.

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

const ICP_VARS = [
  "icp.name",
  "icp.titles",
  "icp.industry",
  "icp.places",
  "icp.pains",
  "icp.offer",
  "icp.proof",
  "icp.cta",
  "icp.tone",
  "icp.exampleEmail",
  "icp.wordsToAvoid",
  "icp.hookGuidance",
]

const LEAD_VARS = [
  "lead.firstName",
  "lead.lastName",
  "lead.company",
  "lead.title",
  "lead.website",
]

const HOOK_VARS = ["hook.text", "hook.summary", "hook.post", "hook.source", "hook.url", "hook.date"]

const EMAIL_VARS = ["email.subject", "email.body"]

/**
 * What we know about the lead's company, filled by the backend: our research for Apollo companies,
 * Lead Intel's stored data for Lead Intel ones. company.summary is Company Verification's verdict.
 */
const COMPANY_VARS = [
  "company.name",
  "company.domain",
  "company.location",
  "company.socials",
  "company.website",
  "company.instagram",
  "company.apollo",
]

/** Company Verification prompts are filled by the backend from a researched company. */
const VERIFY_VARS = ["icp.name", "icp.industry", "icp.places", "icp.description", "icp.pains", "icp.offer", "icp.rules", ...COMPANY_VARS]

/** Variables offered in the editor sidebar for each prompt kind. `lead.extra.*` is matched by prefix. */
export function availableVariables(kind: PromptKind): string[] {
  if (kind === "verify") return VERIFY_VARS
  if (kind === "hook") return [...ICP_VARS, ...LEAD_VARS, "lead.extra.<column>", "items", ...COMPANY_VARS, "company.summary"]
  // Email prompts can also see every post ({{items}}), not just the chosen one ({{hook.post}}).
  if (kind === "email")
    return [...ICP_VARS, ...LEAD_VARS, "lead.extra.<column>", "items", ...HOOK_VARS, ...COMPANY_VARS, "company.summary"]
  return [...ICP_VARS, ...LEAD_VARS, "lead.extra.<column>", "items", ...HOOK_VARS, ...EMAIL_VARS]
}

export function isKnownVariable(name: string, kind: PromptKind): boolean {
  if (kind !== "verify" && name.startsWith("lead.extra.") && name.length > "lead.extra.".length) return true
  return availableVariables(kind).includes(name)
}

export function extractVariables(template: string): string[] {
  return Array.from(template.matchAll(PLACEHOLDER), (m) => m[1])
}

export function unknownVariables(template: string, kind: PromptKind): string[] {
  return Array.from(new Set(extractVariables(template).filter((v) => !isKnownVariable(v, kind))))
}

export interface HookContext {
  text: string
  source: string
  url: string
  date: string
  summary: string
  /** The full text of the chosen post. */
  post: string
}

export interface RenderContext {
  icp: ICP
  lead: Lead
  items?: EnrichmentItem[]
  hook?: HookContext | null
  /** The drafted email, for the scoring prompt. */
  email?: { subject: string; body: string } | null
}

export function formatItems(items: EnrichmentItem[]): string {
  if (items.length === 0) return "(no content found)"
  return items
    .map((it, i) => `${i + 1}. [${it.source}, ${it.postedAt.slice(0, 10)}] ${it.text}`)
    .join("\n")
}

export function buildVariables(ctx: RenderContext): Record<string, string> {
  const { icp, lead, items = [], hook, email } = ctx
  const vars: Record<string, string> = {
    "icp.name": icp.name,
    "icp.titles": icp.titles.join(", "),
    "icp.industry": icp.industry,
    "icp.places": icp.places.join(", "),
    "icp.pains": icp.pains,
    "icp.offer": icp.offer,
    "icp.proof": icp.proof,
    "icp.cta": icp.cta,
    "icp.tone": icp.tone,
    "icp.exampleEmail": icp.exampleEmail,
    "icp.wordsToAvoid": icp.wordsToAvoid,
    "icp.hookGuidance": icp.hookGuidance,
    "lead.firstName": lead.firstName,
    "lead.lastName": lead.lastName,
    "lead.company": lead.company,
    "lead.title": lead.title,
    "lead.website": lead.website,
    items: formatItems(items),
    "hook.text": hook?.text ?? "",
    "hook.source": hook?.source ?? "",
    "hook.url": hook?.url ?? "",
    "hook.date": hook?.date ?? "",
    "hook.summary": hook?.summary ?? "",
    "hook.post": hook?.post ?? "",
    "email.subject": email?.subject ?? "",
    "email.body": email?.body ?? "",
  }
  for (const [k, v] of Object.entries(lead.extra)) vars[`lead.extra.${k}`] = v
  return vars
}

/** Unknown variables render as empty strings. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (_, name: string) => vars[name] ?? "")
}
