import {
  COST_PER_GENERATION,
  ageInDays,
  chooseHookItem,
  composeEmail,
  findPostSeed,
  leadSources,
  mockScore,
  pickItemsForLead,
} from "./mock-data"
import { COST_PER_SCORE } from "./scoring"
import { buildVariables, renderTemplate, type HookContext } from "./templating"
import type {
  EnrichmentItem,
  Generation,
  GenerationFlag,
  ICP,
  Lead,
  LeadScore,
  PromptKind,
  PromptVersion,
  Settings,
  Source,
} from "./types"

// Every function here fakes a network call. Replace the bodies with real API calls later;
// the signatures are what pages depend on.

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const between = (min: number, max: number) => min + Math.random() * (max - min)

let counter = 0
export const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`

/** Simulates a fetch so pages can show skeletons. */
export async function load<T>(value: T, ms = 600): Promise<T> {
  await delay(ms)
  return value
}

// ---------------------------------------------------------------------------
// Cost estimates
// ---------------------------------------------------------------------------

export const COST_PER_POST: Record<Source, number> = {
  linkedin: 0.0023,
  instagram: 0.0023,
  facebook: 0.004,
  website: 0,
}

export function costPerLeadForSource(source: Source, postsPerLead: number): number {
  return COST_PER_POST[source] * postsPerLead
}

export interface EnrichmentEstimate {
  bySource: Record<Source, { leads: number; cost: number }>
  total: number
}

export function estimateEnrichmentCost(
  leads: Lead[],
  enabledSources: Source[],
  postsPerLead: number,
): EnrichmentEstimate {
  const bySource = {
    linkedin: { leads: 0, cost: 0 },
    instagram: { leads: 0, cost: 0 },
    facebook: { leads: 0, cost: 0 },
    website: { leads: 0, cost: 0 },
  }
  for (const lead of leads) {
    for (const s of leadSources(lead)) {
      if (!enabledSources.includes(s)) continue
      bySource[s].leads++
      bySource[s].cost += costPerLeadForSource(s, postsPerLead)
    }
  }
  const total = Object.values(bySource).reduce((sum, s) => sum + s.cost, 0)
  return { bySource, total }
}

/** Drafting plus scoring, per lead. */
export function estimateGenerationCost(leadCount: number): number {
  return leadCount * (COST_PER_GENERATION + COST_PER_SCORE)
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

export type SourceOutcome = "found" | "empty" | "failed"

export interface EnrichmentResult {
  leadId: string
  status: "enriched" | "no_content" | "failed"
  items: EnrichmentItem[]
  sourceOutcomes: Partial<Record<Source, SourceOutcome>>
  costUsd: number
}

/**
 * Enriches leads one by one, calling onResult as each finishes so progress UI can update live.
 * Callers should set the leads to `enriching` before starting.
 */
export async function runEnrichment(
  leads: Lead[],
  icp: ICP,
  settings: Settings,
  onResult: (result: EnrichmentResult) => void,
  signal?: AbortSignal,
): Promise<void> {
  for (const lead of leads) {
    if (signal?.aborted) return
    await delay(between(350, 900))

    const sources = leadSources(lead).filter((s) => icp.enabledSources.includes(s))
    const sourceOutcomes: EnrichmentResult["sourceOutcomes"] = {}
    const found: Source[] = []
    for (const s of sources) {
      const roll = Math.random()
      const outcome: SourceOutcome = roll < 0.06 ? "failed" : roll < 0.22 ? "empty" : "found"
      sourceOutcomes[s] = outcome
      if (outcome === "found") found.push(s)
    }

    const items = found.length
      ? pickItemsForLead(lead, found, 2 + Math.floor(Math.random() * 5), Math.random, uid("item")).filter(
          (it) => it.source === "website" || ageInDays(it.postedAt) <= settings.maxPostAgeDays,
        )
      : []

    const allFailed = sources.length > 0 && sources.every((s) => sourceOutcomes[s] === "failed")
    const costUsd = found.reduce((sum, s) => sum + costPerLeadForSource(s, settings.postsPerLead), 0)

    onResult({
      leadId: lead.id,
      status: allFailed ? "failed" : items.length ? "enriched" : "no_content",
      items,
      sourceOutcomes,
      costUsd,
    })
  }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface GenerationRequest {
  icp: ICP
  leads: Lead[]
  items: EnrichmentItem[]
  hookVersion: PromptVersion
  emailVersion: PromptVersion
  /** The scoring prompt version; every draft is scored right after it is written. */
  scoreVersion: PromptVersion
  /** Optional one-line instruction, e.g. "make it shorter". */
  instruction?: string
  /** Item ids to avoid, for "regenerate with a different item". */
  excludeItemIds?: string[]
}

function applyInstruction(body: string, instruction?: string): string {
  if (!instruction) return body
  if (/short|concise|brief/i.test(instruction)) {
    const paras = body.split("\n\n")
    // Drop the middle paragraph (offer detail) when there are enough to spare.
    if (paras.length >= 5) paras.splice(2, 1)
    return paras.join("\n\n")
  }
  if (/casual|friendl/i.test(instruction)) return body.replace(/^Hi /, "Hey ")
  return body
}

export async function runGeneration(
  req: GenerationRequest,
  onResult?: (generation: Generation, score: LeadScore) => void,
): Promise<Generation[]> {
  const out: Generation[] = []
  for (const lead of req.leads) {
    await delay(between(300, 700))
    const leadItems = req.items.filter((it) => it.leadId === lead.id)
    const choice = chooseHookItem(req.icp.id, leadItems, req.excludeItemIds)
    const sensitiveOnly =
      leadItems.length > 0 && leadItems.every((it) => findPostSeed(req.icp.id, it)?.sensitive)

    const flags: GenerationFlag[] = []
    if (sensitiveOnly) flags.push("sensitive_topic")
    const relevance = choice ? 2 + Math.floor(Math.random() * 4) : 0
    if (choice?.seed.repost) flags.push("repost")
    if (choice && choice.item.source !== "website" && ageInDays(choice.item.postedAt) > 60) flags.push("old_content")
    if (choice && relevance < 3) flags.push("low_relevance")

    const { subject, body } = composeEmail(req.icp.id, lead, choice?.seed.hook ?? "", Math.floor(Math.random() * 3))
    const finalBody = applyInstruction(body, req.instruction)
    const words = finalBody.split(/\s+/).length
    if (words < 40 || words > 130) flags.push("word_count")

    const generation: Generation = {
      id: uid("gen"),
      leadId: lead.id,
      hookPromptVersionId: req.hookVersion.id,
      emailPromptVersionId: req.emailVersion.id,
      chosenItemId: choice?.item.id ?? null,
      hook: choice?.seed.hook ?? "",
      relevance,
      subject,
      body: finalBody,
      confidence: choice
        ? Math.max(30, Math.min(96, 50 + relevance * 8 + Math.floor(Math.random() * 12) - flags.length * 9))
        : 40 + Math.floor(Math.random() * 18),
      flags,
      status: "draft",
      editedBody: null,
      costUsd: COST_PER_GENERATION,
      createdAt: new Date().toISOString(),
      sentAt: null,
      sentBy: null,
    }
    await delay(between(120, 260))
    const scored = mockScore(req.icp, lead, generation, leadItems, Math.random)
    const score: LeadScore = {
      ...scored,
      promptVersionId: req.scoreVersion.id,
      scoredAt: new Date().toISOString(),
    }
    out.push(generation)
    onResult?.(generation, score)
  }
  return out
}

/** Re-runs only the scoring prompt for a lead's current draft. */
export async function runScoring(
  icp: ICP,
  lead: Lead,
  generation: Generation,
  items: EnrichmentItem[],
  scoreVersion: PromptVersion,
): Promise<LeadScore> {
  await delay(between(500, 900))
  const leadItems = items.filter((it) => it.leadId === lead.id)
  const scored = mockScore(icp, lead, generation, leadItems, Math.random)
  return { ...scored, promptVersionId: scoreVersion.id, scoredAt: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// Prompt test
// ---------------------------------------------------------------------------

// Placeholder per-million-token rates for the mock cost readout. Not real pricing.
const MOCK_INPUT_USD_PER_MTOK = 3
const MOCK_OUTPUT_USD_PER_MTOK = 15

export interface PromptTestInput {
  kind: PromptKind
  version: Pick<PromptVersion, "systemPrompt" | "userPrompt" | "model">
  icp: ICP
  lead: Lead
  items: EnrichmentItem[]
  hook?: HookContext | null
  /** The lead's current draft, for the scoring prompt. */
  generation?: Generation | null
}

export interface PromptTestResult {
  renderedSystem: string
  renderedUser: string
  rawOutput: string
  parsed: Record<string, unknown> | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
}

/** Rendering is real. Only the model call is mocked. */
export function renderPrompt(input: PromptTestInput) {
  const email = input.generation
    ? { subject: input.generation.subject, body: input.generation.editedBody ?? input.generation.body }
    : null
  const vars = buildVariables({ icp: input.icp, lead: input.lead, items: input.items, hook: input.hook, email })
  return {
    renderedSystem: renderTemplate(input.version.systemPrompt, vars),
    renderedUser: renderTemplate(input.version.userPrompt, vars),
  }
}

export async function runPromptTest(input: PromptTestInput): Promise<PromptTestResult> {
  const { renderedSystem, renderedUser } = renderPrompt(input)
  const latencyMs = Math.round(between(800, 1800))
  await delay(latencyMs)

  let output: Record<string, unknown>
  if (input.kind === "hook") {
    const choice = chooseHookItem(input.icp.id, input.items)
    const index = choice ? input.items.findIndex((it) => it.id === choice.item.id) + 1 : null
    output = choice
      ? {
          chosen_item: index,
          summary: choice.seed.summary,
          hook: choice.seed.hook,
          relevance: 3 + Math.floor(Math.random() * 3),
          flags: choice.seed.repost ? ["repost"] : [],
        }
      : { chosen_item: null, summary: "", hook: "", relevance: 0, flags: [] }
  } else if (input.kind === "score") {
    const gen = input.generation ?? { chosenItemId: null, relevance: 0, confidence: 50, flags: [] }
    const { value, reasons } = mockScore(input.icp, input.lead, gen, input.items, Math.random)
    output = { score: value, reasons }
  } else {
    const { subject, body } = composeEmail(input.icp.id, input.lead, input.hook?.text ?? "", Math.floor(Math.random() * 3))
    output = { subject, body, confidence: 60 + Math.floor(Math.random() * 35) }
  }

  const rawOutput = JSON.stringify(output, null, 2)
  const inputTokens = Math.ceil((renderedSystem.length + renderedUser.length) / 4)
  const outputTokens = Math.ceil(rawOutput.length / 4)
  const costUsd = (inputTokens * MOCK_INPUT_USD_PER_MTOK + outputTokens * MOCK_OUTPUT_USD_PER_MTOK) / 1_000_000

  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(rawOutput)
  } catch {
    parsed = null
  }

  return { renderedSystem, renderedUser, rawOutput, parsed, inputTokens, outputTokens, costUsd, latencyMs }
}
