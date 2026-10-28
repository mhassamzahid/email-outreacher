"use client"

import { useCallback, useEffect, useState } from "react"
import type { Company, ICP, IcpOutreach, PromptKind, PromptTemplate, PromptVersion, Source, Workspace } from "./types"

// The backend. Pages that use it fetch on mount and show their own loading and error states;
// everything else in the app still runs on sample data from lib/mock-data.ts.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, opts: { workspaceId?: string | null; method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body !== undefined && { "Content-Type": "application/json" }),
        ...(opts.workspaceId && { "X-Workspace-Id": opts.workspaceId }),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(`Can't reach the backend at ${API_URL}. Is it running?`, 0)
  }
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const detail = await res.json().then((b) => b?.detail).catch(() => null)
    throw new ApiError(typeof detail === "string" ? detail : `The backend answered ${res.status}.`, res.status)
  }
  return res.json() as Promise<T>
}

interface Page<T> {
  items: T[]
  total: number
}

/** Every page of a list endpoint. Stops at `cap` so a runaway list can't hang the page. */
export async function apiAll<T>(path: string, workspaceId?: string | null, cap = 2000): Promise<T[]> {
  const out: T[] = []
  const sep = path.includes("?") ? "&" : "?"
  for (let offset = 0; offset < cap; offset += 200) {
    const page = await api<Page<T>>(`${path}${sep}limit=200&offset=${offset}`, { workspaceId })
    out.push(...page.items)
    if (out.length >= page.total || page.items.length === 0) break
  }
  return out
}

/** Load on mount and on `reload()`. Keeps the last good data while reloading. */
export function useApi<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    load()
      .then((d) => {
        if (!live) return
        setData(d)
        setError(null)
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "Something went wrong."))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => {
    setLoading(true)
    setTick((t) => t + 1)
  }, [])
  return { data, error, loading, reload }
}

// ---------- Endpoints ----------

/** This workspace's outreach settings for an ICP, as the backend stores them (eo_icp_profiles). */
export interface ApiIcpProfile extends IcpOutreach {
  updatedAt: string
}

/** A Lead Intel ICP as the backend returns it, with this workspace's profile when there is one. */
export interface ApiIcp
  extends Pick<
    ICP,
    | "id" | "name" | "industry" | "priority" | "enabled" | "sources" | "anyOf" | "noneOf" | "websiteAnyOf"
    | "instagramAnyOf" | "requireAll" | "minFollowers" | "maxFollowers" | "searchTerms" | "requiresWebsite"
    | "minReviews" | "places" | "companyCount" | "createdAt" | "updatedAt"
  > {
  profile: ApiIcpProfile | null
}

const EMPTY_OUTREACH: IcpOutreach = {
  description: "",
  titles: [],
  pains: "",
  offer: "",
  proof: "",
  cta: "",
  tone: "",
  exampleEmail: "",
  wordsToAvoid: "",
  hookGuidance: "",
  enabledSources: ["linkedin", "website"],
  verifyPromptId: null,
  hookPromptId: null,
  emailPromptId: null,
}

/** One ICP for the app: Lead Intel's fields plus this workspace's outreach settings (or empty ones). */
export function toIcp(api: ApiIcp): ICP {
  const { profile, ...leadIntel } = api
  const outreach = profile ? { ...EMPTY_OUTREACH, ...profile, enabledSources: profile.enabledSources as Source[] } : EMPTY_OUTREACH
  return { ...leadIntel, ...outreach, updatedAt: profile?.updatedAt ?? api.updatedAt }
}

/** Save the outreach half of an ICP, prompt choices included. Lead Intel's own fields are never sent. */
export const saveIcpOutreach = (workspaceId: string, icpId: string, outreach: IcpOutreach) => {
  const body = {
    description: outreach.description,
    titles: outreach.titles,
    pains: outreach.pains,
    offer: outreach.offer,
    proof: outreach.proof,
    cta: outreach.cta,
    tone: outreach.tone,
    exampleEmail: outreach.exampleEmail,
    wordsToAvoid: outreach.wordsToAvoid,
    hookGuidance: outreach.hookGuidance,
    enabledSources: outreach.enabledSources,
    verifyPromptId: outreach.verifyPromptId,
    hookPromptId: outreach.hookPromptId,
    emailPromptId: outreach.emailPromptId,
  }
  return api<ApiIcpProfile>(`/icps/${icpId}/profile`, { workspaceId, method: "PUT", body })
}

export const fetchIcps = (workspaceId?: string) => api<ApiIcp[]>("/icps", { workspaceId })

/** Every contactable company Lead Intel matched to an ICP (read-only). */
export const fetchLeadIntelCompanies = (icpId: string) => apiAll<Company>(`/companies?icpId=${icpId}`)

export async function fetchCompanyDetail(id: string): Promise<{ siteText: string | null }> {
  const d = await api<{ fields: Record<string, string | null> }>(`/companies/${id}`)
  return { siteText: d.fields.site_text ?? d.fields.website_text ?? null }
}

export const fetchWorkspaces = () => api<Workspace[]>("/workspaces")

export const createWorkspace = (body: { name: string; description: string }) =>
  api<Workspace>("/workspaces", { method: "POST", body })

export const updateWorkspace = (id: string, body: Partial<Pick<Workspace, "name" | "description">>) =>
  api<Workspace>(`/workspaces/${id}`, { method: "PATCH", body })

export const deleteWorkspace = (id: string) => api<void>(`/workspaces/${id}`, { method: "DELETE" })

// ---------- Stakeholders (Apollo) ----------

export interface Stakeholder {
  id: string
  companyId: string | null
  /** The pipeline company they were found at. */
  pipelineCompanyId: string | null
  /** The Lead Intel ICP whose search found them, if found by ICP. */
  icpId: string | null
  /** Their employer as Apollo names it. */
  organizationName: string | null
  source: string
  firstName: string
  /** Masked ("Mo***n") until revealed. */
  lastName: string
  title: string
  seniority: string | null
  linkedinUrl: string | null
  hasEmail: boolean | null
  email: string | null
  emailStatus: string | null
  revealedAt: string | null
  leadId: string | null
  foundAt: string
}

export interface StakeholderSearchResult {
  results: {
    companyId: string
    name: string | null
    status: "searched" | "skipped" | "failed"
    found: number
    new: number
    totalAtApollo: number | null
    reason: string | null
  }[]
  error: string | null
}

export interface StakeholderRevealResult {
  outcomes: {
    stakeholderId: string
    status: "revealed" | "no_match" | "already_revealed" | "not_found" | "failed"
    email: string | null
    leadId: string | null
    leadCreated: boolean
    reason: string | null
  }[]
  revealed: number
  error: string | null
}

export const fetchStakeholders = (workspaceId: string, companyId?: string) =>
  api<Stakeholder[]>(companyId ? `/stakeholders?companyId=${companyId}` : "/stakeholders", { workspaceId })

export const revealStakeholders = (workspaceId: string, stakeholderIds: string[]) =>
  api<StakeholderRevealResult>("/stakeholders/reveal", { workspaceId, method: "POST", body: { stakeholderIds } })

export const fetchAllStakeholders = (workspaceId: string) => api<Stakeholder[]>("/stakeholders", { workspaceId })

/** A new ICP: exactly Lead Intel's fields. Added to Lead Intel's icps table, shared by both projects. */
export type IcpCreate = Pick<
  ICP,
  | "name" | "industry" | "priority" | "enabled" | "sources" | "anyOf" | "noneOf" | "websiteAnyOf" | "instagramAnyOf"
  | "requireAll" | "minFollowers" | "maxFollowers" | "searchTerms" | "requiresWebsite" | "minReviews" | "places"
>

export const createIcp = (body: IcpCreate) => api<ApiIcp>("/icps", { method: "POST", body })

// ---------- LinkedIn people and posts (Apify) ----------

export const addAsLeads = (workspaceId: string, stakeholderIds: string[]) =>
  api<{ added: number; linkedExisting: number; skipped: number }>("/stakeholders/add-as-leads", {
    workspaceId,
    method: "POST",
    body: { stakeholderIds },
  })

export interface ApiPost {
  id: string
  leadId: string
  source: "linkedin" | "instagram" | "facebook" | "website"
  url: string
  postedAt: string | null
  text: string
  mediaType: string
  isRepost: boolean
  fetchedAt: string
}

export const fetchPosts = (workspaceId: string, leadId?: string) =>
  api<ApiPost[]>(leadId ? `/posts?leadId=${leadId}` : "/posts", { workspaceId })

export const fetchLeadPosts = (workspaceId: string, body: { leadIds: string[]; maxPosts: number; maxAgeDays: number }) =>
  api<{
    results: { leadId: string; linkedin: number | null; instagram: number | null; new: number }[]
    costUsd: number | null
    error: string | null
  }>("/posts/fetch", { workspaceId, method: "POST", body })

// ---------- Company pipeline ----------

export type PipelineStatus = "found" | "qualified" | "not_fit" | "error"

export interface PipelineCompany {
  id: string
  icpId: string | null
  source: "lead_intel" | "apollo"
  leadIntelBusinessId: string | null
  apolloOrgId: string | null
  name: string
  domain: string | null
  websiteUrl: string | null
  linkedinUrl: string | null
  facebookUrl: string | null
  twitterUrl: string | null
  instagramUrl: string | null
  city: string | null
  state: string | null
  status: PipelineStatus
  statusReason: string | null
  overridden: boolean
  ruleFit: boolean | null
  ruleDetail: { reason: string; hits: { term: string; source: string; group: string }[]; skipped: string[] } | null
  score: number | null
  scoreDetail: {
    summary: string
    reasons: string[]
    concerns: string[]
    model: string
    error: string | null
    /** Pages Claude asked to read after the homepage, in order, and why. */
    reading?: { url: string; reason: string; read: boolean }[]
  } | null
  research: {
    website: { outcome: string; via: string | null; url: string | null; title: string; text: string; detail: string | null } | null
    socials: Record<string, string>
    instagram: { handle: string; name: string; bio: string; category: string | null; followers: number | null; private: boolean } | null
  } | null
  researchedAt: string | null
  createdAt: string
}

export interface SourceFindResult {
  found: number
  added: number
  duplicates: number
  upgraded: number
  totalAvailable: number | null
  error: string | null
}

export const fetchPipeline = (workspaceId: string, icpId?: string) =>
  api<PipelineCompany[]>(icpId ? `/pipeline/companies?icpId=${icpId}` : "/pipeline/companies", { workspaceId })

export const findCompanies = (
  workspaceId: string,
  body: {
    icpId: string
    sources: ("lead_intel" | "apollo")[]
    /** Only these of the ICP's Lead Intel companies; all of them when left out. */
    leadIntelIds?: string[]
    apollo?: { keywords: string[]; locations: string[]; employeeRanges: string[]; page: number; perPage: number }
  },
) => api<{ leadIntel: SourceFindResult | null; apollo: SourceFindResult | null }>("/pipeline/find", { workspaceId, method: "POST", body })

export const researchCompanies = (workspaceId: string, companyIds: string[], force = false) =>
  api<{ researched: number; skipped: number; qualified: number; notFit: number; errors: number; costUsd: number; notes: string[] }>(
    "/pipeline/research",
    { workspaceId, method: "POST", body: { companyIds, force } },
  )

export const setCompanyStatus = (workspaceId: string, companyId: string, status: "qualified" | "not_fit") =>
  api<PipelineCompany>(`/pipeline/companies/${companyId}`, { workspaceId, method: "PATCH", body: { status } })

export const findPipelineStakeholders = (
  workspaceId: string,
  body: { companyIds: string[]; source: "apollo" | "linkedin"; titles: string[]; seniorities: string[]; maxPerCompany: number },
) => api<StakeholderSearchResult & { costUsd: number | null }>("/pipeline/stakeholders", { workspaceId, method: "POST", body })

// ---------- Usage: what Claude, Apollo and Apify have cost ----------

export type UsageProvider = "claude" | "apollo" | "apify"

export interface UsageTotals {
  calls: number
  failed: number
  credits: number
  costUsd: number
  inputTokens: number
  outputTokens: number
}

export interface ProviderCall {
  id: string
  provider: string
  endpoint: string | null
  action: string | null
  status: "succeeded" | "failed"
  credits: number | null
  costUsd: number
  model: string | null
  inputTokens: number | null
  outputTokens: number | null
  calledAt: string
}

export interface Usage {
  since: string
  providers: (UsageTotals & { provider: string })[]
  actions: (UsageTotals & { provider: string; action: string })[]
  recent: ProviderCall[]
}

export const fetchUsage = (workspaceId: string, days: number) => api<Usage>(`/usage?days=${days}`, { workspaceId })

// ---------- Prompts: Company Verification, Hook Selection, Email Generation, Email scoring ----------

export type PromptDraft = Pick<PromptVersion, "systemPrompt" | "userPrompt" | "model" | "temperature" | "maxTokens" | "maxPosts">

export const fetchPrompts = (workspaceId: string) =>
  api<{ prompts: PromptTemplate[]; versions: PromptVersion[] }>("/prompts", { workspaceId })

export const createPrompt = (
  workspaceId: string,
  body: { name: string; kind: PromptKind; version: PromptDraft; note: string; isDefault?: boolean },
) => api<{ prompt: PromptTemplate; version: PromptVersion }>("/prompts", { workspaceId, method: "POST", body })

export const savePromptVersion = (workspaceId: string, promptId: string, draft: PromptDraft, note: string) =>
  api<PromptVersion>(`/prompts/${promptId}/versions`, { workspaceId, method: "POST", body: { ...draft, note } })

export const updatePrompt = (workspaceId: string, promptId: string, patch: { name?: string; isDefault?: true }) =>
  api<PromptTemplate>(`/prompts/${promptId}`, { workspaceId, method: "PATCH", body: patch })

export const deletePrompt = (workspaceId: string, promptId: string) =>
  api<void>(`/prompts/${promptId}`, { workspaceId, method: "DELETE" })

// ---------- What research read for a pipeline company ----------

export interface CompanyContent {
  pages: { url: string; role: string; via: string; status: number | null; text: string; fetchedAt: string }[]
  posts: { id: string; source: string; url: string; postedAt: string | null; text: string; mediaType: string }[]
}

export const fetchCompanyContent = (workspaceId: string, companyId: string) =>
  api<CompanyContent>(`/pipeline/companies/${companyId}/content`, { workspaceId })

// ---------- Emails: hook selection, email generation and review. Nothing here sends email. ----------

export type EmailStatus = "draft" | "edited" | "approved" | "sent" | "skipped"

export interface EmailDraft {
  id: string
  lead: {
    id: string
    icpId: string | null
    firstName: string
    lastName: string
    title: string
    company: string
    email: string | null
    linkedinUrl: string | null
  }
  status: EmailStatus
  subject: string
  body: string
  originalBody: string
  edited: boolean
  hook: string
  relevance: number
  confidence: number
  flags: string[]
  chosenPost: { source: string; url: string; postedAt: string | null; text: string; whose: "person" | "company" } | null
  points: { rank: number; point: string; why: string; relevance: number }[]
  costUsd: number
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  feedback: EmailFeedback | null
  /** How many rated emails Claude was shown as examples when it wrote this one. */
  examplesUsed: number
}

export type FeedbackTag =
  | "strong_hook" | "right_tone" | "clear_cta" | "send_as_is"
  | "too_long" | "too_generic" | "wrong_hook" | "tone_off" | "made_up_facts" | "weak_cta" | "wrong_person"

export interface EmailFeedback {
  rating: "good" | "bad"
  tags: FeedbackTag[]
  note: string
  updatedAt: string
}

export interface GenerateResult {
  results: { leadId: string; name: string | null; status: "drafted" | "failed" | "skipped"; reason: string | null; emailId: string | null }[]
  drafted: number
  costUsd: number
}

export const fetchEmails = (workspaceId: string) => api<EmailDraft[]>("/emails", { workspaceId })

export const generateEmails = (workspaceId: string, leadIds: string[], instruction = "") =>
  api<GenerateResult>("/emails/generate", { workspaceId, method: "POST", body: { leadIds, instruction } })

export const updateEmail = (
  workspaceId: string,
  emailId: string,
  patch: { subject?: string; body?: string; status?: "draft" | "approved" | "skipped" },
) => api<EmailDraft>(`/emails/${emailId}`, { workspaceId, method: "PATCH", body: patch })

// ---------- Feedback on generated emails, and prompt improvement from it ----------

export const rateEmail = (workspaceId: string, emailId: string, feedback: Omit<EmailFeedback, "updatedAt">) =>
  api<EmailDraft>(`/emails/${emailId}/feedback`, { workspaceId, method: "PUT", body: feedback })

export const clearRating = (workspaceId: string, emailId: string) =>
  api<EmailDraft>(`/emails/${emailId}/feedback`, { workspaceId, method: "DELETE" })

export const fetchFeedbackStats = (workspaceId: string) =>
  api<{ icpId: string | null; good: number; bad: number }[]>("/emails/feedback/stats", { workspaceId })

export interface PromptSuggestion {
  promptId: string
  promptName: string
  basedOnVersion: number
  chosenByIcps: number
  isDefault: boolean
  examples: number
  summary: string
  changes: string[]
  systemPrompt: string
  userPrompt: string
  costUsd: number
}

export const suggestEmailPrompt = (workspaceId: string, icpId: string) =>
  api<PromptSuggestion>("/improve/email-prompt", { workspaceId, method: "POST", body: { icpId } })

// ---------- Settings: how many rated emails Claude learns from ----------

export interface FeedbackSettings {
  goodExamples: number
  badExamples: number
  improveExamples: number
}

export const fetchFeedbackSettings = (workspaceId: string) => api<FeedbackSettings>("/settings/feedback", { workspaceId })

export const saveFeedbackSettings = (workspaceId: string, body: FeedbackSettings) =>
  api<FeedbackSettings>("/settings/feedback", { workspaceId, method: "PUT", body })

// ---------- Settings: how much of a company's website research reads ----------

export interface ResearchSettings {
  researchMaxPages: number
  researchMaxSeconds: number
}

export const fetchResearchSettings = (workspaceId: string) => api<ResearchSettings>("/settings/research", { workspaceId })

export const saveResearchSettings = (workspaceId: string, body: ResearchSettings) =>
  api<ResearchSettings>("/settings/research", { workspaceId, method: "PUT", body })
