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

const HOOK_VARS = ["hook.text", "hook.source", "hook.url", "hook.date", "hook.summary"]

const EMAIL_VARS = ["email.subject", "email.body"]

/** Variables offered in the editor sidebar for each prompt kind. `lead.extra.*` is matched by prefix. */
export function availableVariables(kind: PromptKind): string[] {
  if (kind === "hook") return [...ICP_VARS, ...LEAD_VARS, "lead.extra.<column>", "items"]
  if (kind === "email") return [...ICP_VARS, ...LEAD_VARS, "lead.extra.<column>", ...HOOK_VARS]
  return [...ICP_VARS, ...LEAD_VARS, "lead.extra.<column>", "items", ...HOOK_VARS, ...EMAIL_VARS]
}

export function isKnownVariable(name: string, kind: PromptKind): boolean {
  if (name.startsWith("lead.extra.") && name.length > "lead.extra.".length) return true
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
