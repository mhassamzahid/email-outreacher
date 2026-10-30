"use client"

import { useCallback, useEffect, useState } from "react"
import { accessToken, supabase } from "./supabase"
import type { Company, ICP, IcpOutreach, Lead, LeadStatus, PromptKind, PromptTemplate, PromptVersion, Role, Source, User, Workspace } from "./types"

// The backend. Pages fetch on mount and show their own loading and error states.

// The backend is reached only through this app's own server (app/api/v1), which adds the API secret.
// The browser never learns the backend's address.
export const API_URL = ""

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** A backend call. `body` is sent as JSON; `csv` as a CSV file's text. */
export async function api<T>(
  path: string,
  opts: { workspaceId?: string | null; method?: string; body?: unknown; csv?: string } = {},
): Promise<T> {
  const token = await accessToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: opts.method ?? "GET",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(opts.body !== undefined && { "Content-Type": "application/json" }),
        ...(opts.csv !== undefined && { "Content-Type": "text/csv" }),
        ...(opts.workspaceId && { "X-Workspace-Id": opts.workspaceId }),
      },
      body: opts.csv !== undefined ? opts.csv : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError("Can't reach Coldbrew's server. Check your connection.", 0)
  }
  if (res.status === 204) return undefined as T
  // The session is gone or no longer valid: sign out, which sends the app back to the sign-in page.
  if (res.status === 401) void supabase.auth.signOut()
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
  /** After a create or rename: what happened to its CheapSequencer campaign. */
  campaignNote?: string | null
}

const EMPTY_OUTREACH: IcpOutreach = {
  description: "",
  titles: [],
  pains: "",
  offer: "",
  proof: "",
  cta: "",
  tone: "",
  wordsToAvoid: "",
  hookGuidance: "",
  enabledSources: ["linkedin", "website"],
  productId: null,
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
    wordsToAvoid: outreach.wordsToAvoid,
    hookGuidance: outreach.hookGuidance,
    enabledSources: outreach.enabledSources,
    productId: outreach.productId,
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

/** Exactly these people can open the workspace (admins open every one anyway). */
export const setWorkspaceMembersApi = (id: string, userIds: string[]) =>
  api<void>(`/workspaces/${id}/members`, { method: "PUT", body: { userIds } })

// ---------- Sending: mailboxes (CheapSequencer) and their domains (CheapInboxes). Read-only. ----------

export interface Mailbox {
  id: string
  email: string
  name: string
  domain: string
  provider: string
  status: string
  authStatus: string
  needsAttention: boolean
  lastError: string | null
  tags: string[]
  campaignDaily: number
  warmupDaily: number
  totalDaily: number
  warmupEnabled: boolean
  warmupState: string | null
  warmupStartedAt: string | null
  lastSentAt: string | null
  todaySends: number
  todayReplies: number
  todayFailed: number
  todayInbox: number
  todaySpam: number
  todaySaved: number
  todayUnknown: number
}

export interface SendingDomain {
  domain: string
  status: string
  health: string
  problems: string[]
}

export interface Mailboxes {
  summary: {
    connected: number
    connectedLimit: number | null
    sendsUsed: number
    sendsLimit: number | null
    periodEndsAt: string | null
    campaignDaily: number
    warmupTodaySends: number
    warmupTodayInbox: number
    warmupTodaySpam: number
    warmupTodaySaved: number
    warmupWeekSent: number
    warmupWeekInbox: number
    warmupWeekSpam: number
    warmupWeekSaved: number
    needingReview: number
  }
  mailboxes: Mailbox[]
  domains: SendingDomain[]
  campaigns: { name: string; status: string; dailySendCap: number | null }[]
  /** Why part of the page is missing: a key not set, or a service down. */
  errors: string[]
}

export const fetchMailboxes = () => api<Mailboxes>("/mailboxes")

// ---------- Sending: CheapSequencer campaigns, queueing approved emails, follow-ups ----------

export interface SendingSettings {
  senderCompany: string
  senderAddress: string
  followupFallback2: string
  followupFallback3: string
  followupLeadHours: number
}

export interface TemplateOutcome {
  campaign: string
  status: "updated" | "unchanged" | "skipped"
  reason: string | null
}

export const fetchSendingSettings = (workspaceId: string) => api<SendingSettings>("/sending/settings", { workspaceId })

/** Saves, then writes the signature into every Coldbrew campaign that isn't sending. */
export const saveSendingSettings = (workspaceId: string, body: SendingSettings) =>
  api<SendingSettings & { templates: TemplateOutcome[] }>("/sending/settings", { workspaceId, method: "PUT", body })

export interface SendingCampaign {
  id: string
  name: string
  status: string
  dailySendCap: number | null
  /** Leads Coldbrew put in it. */
  queued: number
}

export const fetchSendingCampaigns = (workspaceId: string) => api<SendingCampaign[]>("/sending/campaigns", { workspaceId })

export interface QueueResult {
  queued: number
  results: { emailId: string; status: "queued" | "skipped"; reason: string | null; campaign: string | null }[]
}

/** Put approved first emails into their ICP's campaign. Doesn't activate it or send. */
export const queueEmails = (workspaceId: string, emailIds: string[]) =>
  api<QueueResult>("/sending/queue", { workspaceId, method: "POST", body: { emailIds } })

export interface FollowUpRun {
  checked: number
  written: number
  ended: number
  costUsd: number
  notes: string[]
}

export interface CampaignSync {
  icp: string
  status: "created" | "renamed" | "linked" | "unchanged" | "skipped"
  note: string
}

/** Give every ICP that's on its "Coldbrew: <ICP>" campaign: link, rename or create a draft copy. */
export const syncCampaigns = (workspaceId: string) => api<CampaignSync[]>("/sending/campaigns/sync", { workspaceId, method: "POST" })

export const runFollowUps = (workspaceId: string) => api<FollowUpRun>("/sending/follow-ups/run", { workspaceId, method: "POST" })

export type OutboxState =
  | "queued"
  | "sending"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "failed"
  | "paused"
  | "stopped"
  | "finished"

export interface OutboxStep {
  step: 1 | 2 | 3
  /** Empty on 2 and 3: they reply in the same thread. */
  subject: string
  body: string
  status: "waiting" | "sent" | "skipped"
  /** False while email 2 or 3 is still the generic text from Settings. */
  personalized: boolean
  sentAt: string | null
}

export interface OutboxRow {
  emailId: string
  leadId: string
  name: string
  email: string
  title: string
  company: string
  campaignId: string
  campaign: string
  /** The mailbox all three emails go out from, once CheapSequencer has assigned one. */
  mailbox: string | null
  state: OutboxState
  sent: number
  queuedAt: string | null
  lastSentAt: string | null
  syncedAt: string | null
  steps: OutboxStep[]
}

/** Every queued lead and its three emails, as of the last follow-up check. */
export const fetchOutbox = (workspaceId: string) => api<OutboxRow[]>("/sending/outbox", { workspaceId })

export interface ReplyThread {
  id: string
  subject: string
  preview: string
  mailbox: string
  leadEmail: string
  leadName: string
  leadId: string | null
  campaign: string
  lastMessageAt: string | null
  messageCount: number
  inboundCount: number
  unreadCount: number
  classification: string | null
}

export interface ReplyMessage {
  id: string
  direction: "inbound" | "outbound"
  fromName: string
  fromAddress: string
  to: string[]
  sentAt: string | null
  subject: string
  body: string
}

/** Conversations in Coldbrew's campaigns where the lead wrote back, from CheapSequencer's inbox. */
export const fetchReplies = (workspaceId: string) => api<ReplyThread[]>("/sending/replies", { workspaceId })

export const fetchReplyThread = (workspaceId: string, threadId: string) =>
  api<ReplyThread & { messages: ReplyMessage[] }>(`/sending/replies/${encodeURIComponent(threadId)}`, { workspaceId })

// ---------- Do-not-contact list: one for every workspace ----------

export type ExclusionKeyType = "domain" | "email" | "phone" | "place_id" | "name_location"
export type ExclusionReason = "current_client" | "past_client" | "do_not_contact" | "competitor" | "other"

export interface Exclusion {
  id: string
  keyType: ExclusionKeyType
  keyValue: string
  reason: ExclusionReason
  businessName: string
  note: string
  createdAt: string
}

export const fetchExclusions = () => api<Exclusion[]>("/exclusions")

export const addExclusion = (body: { keyType: ExclusionKeyType; value: string; reason: ExclusionReason; businessName?: string; note?: string }) =>
  api<Exclusion>("/exclusions", { method: "POST", body })

export const removeExclusion = (id: string) => api<void>(`/exclusions/${id}`, { method: "DELETE" })

/** Every key the pipeline company has goes on the list, and it's marked not a fit. */
export const excludeCompany = (workspaceId: string, companyId: string, reason: ExclusionReason, note = "") =>
  api<Exclusion[]>(`/exclusions/company/${companyId}`, { workspaceId, method: "POST", body: { reason, note } })

// ---------- Users: role and workspaces here; accounts and passwords in Supabase ----------

export const fetchMe = () => api<User>("/me")

/** Admins only. */
export const fetchUsers = () => api<User[]>("/users")

export const addUserApi = (body: { name: string; email: string; role: Role; workspaceIds: string[] }) =>
  api<User>("/users", { method: "POST", body })

export const updateUserApi = (
  id: string,
  body: Partial<{ name: string; role: Role; status: "active" | "deactivated"; workspaceIds: string[] }>,
) => api<User>(`/users/${id}`, { method: "PATCH", body })

export const removeUserApi = (id: string) => api<void>(`/users/${id}`, { method: "DELETE" })

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

/** Turn an ICP off and archive its campaign. Refused while the campaign still has leads in a sequence. */
export const archiveIcp = (workspaceId: string, id: string) => api<ApiIcp>(`/icps/${id}/archive`, { workspaceId, method: "POST" })

/** Turn an archived ICP back on, with a new draft campaign. */
export const restoreIcp = (workspaceId: string, id: string) => api<ApiIcp>(`/icps/${id}/restore`, { workspaceId, method: "POST" })

/** Delete an ICP nothing uses yet, and archive its campaign. Refused, with what uses it, otherwise. */
export const deleteIcp = (workspaceId: string, id: string) => api<void>(`/icps/${id}`, { workspaceId, method: "DELETE" })

/** Change an ICP's own fields in Lead Intel's icps table (shared, so Lead Intel sees it too). */
export const updateIcpDefinition = (workspaceId: string, id: string, body: IcpCreate) =>
  api<ApiIcp>(`/icps/${id}`, { workspaceId, method: "PUT", body })

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

export const fetchLeadPosts = (
  workspaceId: string,
  body: { leadIds: string[]; maxPosts: number; maxAgeDays: number; sources?: ("linkedin" | "instagram")[] },
) =>
  api<{
    results: { leadId: string; linkedin: number | null; instagram: number | null; new: number }[]
    costUsd: number | null
    error: string | null
  }>("/posts/fetch", { workspaceId, method: "POST", body })

// ---------- Company pipeline ----------

export type PipelineStatus = "found" | "qualified" | "not_fit" | "error"

export type CompanySource = "lead_intel" | "apollo" | "google_maps"

export interface PipelineCompany {
  id: string
  icpId: string | null
  source: CompanySource
  leadIntelBusinessId: string | null
  apolloOrgId: string | null
  googlePlaceId: string | null
  name: string
  domain: string | null
  websiteUrl: string | null
  linkedinUrl: string | null
  facebookUrl: string | null
  twitterUrl: string | null
  instagramUrl: string | null
  city: string | null
  state: string | null
  phone: string | null
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
    /** What the site publishes for reaching them; the owner only where the page says so. */
    contacts?: SiteContacts | null
  } | null
  researchedAt: string | null
  createdAt: string
}

/** Stored inside the company's research JSON, so the keys keep the backend's spelling. */
export interface SiteContacts {
  email: string | null
  all_emails: string[]
  phone: string | null
  owner_name: string | null
  owner_name_source: string | null
}

export interface SourceFindResult {
  found: number
  added: number
  duplicates: number
  upgraded: number
  totalAvailable: number | null
  error: string | null
  /** On the do-not-contact list, so not added. */
  excluded?: number
  /** Google Maps: requests made, what they cost, and anything worth knowing about the run. */
  searches?: number | null
  costUsd?: number | null
  notes?: string[]
}

export const fetchPipeline = (workspaceId: string, icpId?: string) =>
  api<PipelineCompany[]>(icpId ? `/pipeline/companies?icpId=${icpId}` : "/pipeline/companies", { workspaceId })

export const findCompanies = (
  workspaceId: string,
  body: {
    icpId: string
    sources: CompanySource[]
    /** Only these of the ICP's Lead Intel companies; all of them when left out. */
    leadIntelIds?: string[]
    apollo?: { keywords: string[]; locations: string[]; employeeRanges: string[]; page: number; perPage: number }
    googleMaps?: { searchTerms: string[]; locations: string[]; radiusMiles: number; maxSearches: number }
  },
) =>
  api<{ leadIntel: SourceFindResult | null; apollo: SourceFindResult | null; googleMaps: SourceFindResult | null }>("/pipeline/find", {
    workspaceId,
    method: "POST",
    body,
  })

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

export type UsageProvider = "claude" | "apollo" | "apify" | "google_places"

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

export type EmailStatus = "draft" | "edited" | "approved" | "queued" | "sent" | "skipped"

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
  /** The ranked hooks from Hook Selection, best first. */
  points: { rank: number; point: string; hook: string; source: string; why: string; relevance: number }[]
  costUsd: number
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  feedback: EmailFeedback | null
  /** How many rated emails Claude was shown as examples when it wrote this one. */
  examplesUsed: number
  /** The Email Scoring prompt's verdict, 0 to 100, or null when it wasn't scored. */
  score: number | null
  scoreReasons: string[]
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
  sampleExamples: number
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

// ---------- People added by hand or from a CSV (Apollo's export format) ----------

/** Save one of the backend's CSV templates. Fetched with the session, so it isn't a plain link. */
export async function downloadTemplate(kind: "people" | "leads") {
  const token = await accessToken()
  const res = await fetch(`${API_URL}/api/v1/${kind === "people" ? "stakeholders" : "leads"}/template.csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new ApiError(`Couldn't get the template (${res.status}).`, res.status)
  const blob = await res.blob()
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `${kind}-template.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export interface PersonInput {
  icpId: string | null
  firstName: string
  lastName: string
  title: string
  company: string
  email: string
  linkedinUrl: string
  website: string
}

export const addPerson = (workspaceId: string, person: PersonInput) =>
  api<{ person: Stakeholder; new: boolean; leadCreated: boolean; companyName: string | null }>("/stakeholders", {
    workspaceId,
    method: "POST",
    body: person,
  })

export interface PeopleImportResult {
  dryRun: boolean
  totalRows: number
  valid: number
  added: number
  updated: number
  leadsCreated: number
  linkedToCompanies: number
  duplicatesInFile: number
  errors: { row: number; reason: string }[]
  columns: Record<string, string>
}

export const importPeople = (workspaceId: string, csv: string, icpId: string | null, dryRun: boolean) =>
  api<PeopleImportResult>(`/stakeholders/import?dryRun=${dryRun}${icpId ? `&icpId=${icpId}` : ""}`, {
    workspaceId,
    method: "POST",
    csv,
  })

// ---------- Products: what we sell. Each ICP picks one. ----------

export interface ProductFields {
  name: string
  description: string
  value: string
  proof: string
  offer: string
  cta: string
  url: string
}

export interface Product extends ProductFields {
  id: string
  createdAt: string
  updatedAt: string
  /** The ICPs that sell this product. */
  icpIds: string[]
}

export const fetchProducts = (workspaceId: string) => api<Product[]>("/products", { workspaceId })

export const createProduct = (workspaceId: string, body: ProductFields) =>
  api<Product>("/products", { workspaceId, method: "POST", body })

export const updateProduct = (workspaceId: string, id: string, body: ProductFields) =>
  api<Product>(`/products/${id}`, { workspaceId, method: "PUT", body })

export const deleteProduct = (workspaceId: string, id: string) =>
  api<void>(`/products/${id}`, { workspaceId, method: "DELETE" })

// ---------- Output schemas: the JSON shape each prompt kind answers in (fixed by the app) ----------

export interface OutputSchema {
  name: string
  /** When this shape is used. */
  note: string
  /** The JSON schema, exactly as sent to Claude as the required output format. */
  jsonSchema: Record<string, unknown>
}

export const fetchOutputSchemas = () => api<Record<PromptKind, OutputSchema[]>>("/prompts/output-schemas")

// ---------- Example emails: a library of emails in our voice, per ICP ----------

export interface ExampleEmailFields {
  subject: string
  body: string
  /** What makes it a good example. Shown to Claude next to it. */
  note: string
  allIcps: boolean
  icpIds: string[]
}

export interface ExampleEmail extends ExampleEmailFields {
  id: string
  source: "manual" | "generated"
  sourceEmailId: string | null
  createdAt: string
  updatedAt: string
}

export const fetchExamples = (workspaceId: string) => api<ExampleEmail[]>("/examples", { workspaceId })

export const createExample = (workspaceId: string, body: ExampleEmailFields) =>
  api<ExampleEmail>("/examples", { workspaceId, method: "POST", body })

export const updateExample = (workspaceId: string, id: string, body: ExampleEmailFields) =>
  api<ExampleEmail>(`/examples/${id}`, { workspaceId, method: "PUT", body })

export const deleteExample = (workspaceId: string, id: string) =>
  api<void>(`/examples/${id}`, { workspaceId, method: "DELETE" })

/** Copy a generated email (with edits) into the library, for its lead's ICP. */
export const saveEmailAsExample = (workspaceId: string, emailId: string, note = "") =>
  api<ExampleEmail>(`/examples/from-email/${emailId}`, { workspaceId, method: "POST", body: { note } })

// ---------- Leads ----------

interface ApiLead {
  id: string
  icpId: string | null
  firstName: string
  lastName: string
  email: string | null
  emailStatus: string | null
  title: string
  company: string
  website: string
  linkedinUrl: string | null
  instagramUrl: string | null
  facebookUrl: string | null
  extra: Record<string, string>
  status: LeadStatus
  score: number | null
  scoreReasons: string[] | null
  postCount: number
  createdAt: string
}

function toLead(l: ApiLead): Lead {
  return {
    id: l.id,
    icpId: l.icpId ?? "",
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email ?? "",
    emailStatus: l.emailStatus,
    company: l.company,
    title: l.title,
    website: l.website,
    linkedinUrl: l.linkedinUrl ?? "",
    instagramUrl: l.instagramUrl ?? "",
    facebookUrl: l.facebookUrl ?? "",
    extra: l.extra,
    status: l.status,
    score: l.score === null ? null : { value: l.score, reasons: l.scoreReasons ?? [] },
    postCount: l.postCount,
    createdAt: l.createdAt,
  }
}

export const fetchLeads = async (workspaceId: string) => (await apiAll<ApiLead>("/leads", workspaceId)).map(toLead)

export interface LeadInput {
  icpId: string
  firstName: string
  lastName: string
  email: string
  company: string
  title: string
  website: string
  linkedinUrl: string
  instagramUrl: string
  facebookUrl: string
  /** Custom fields, usable in prompts as {{lead.extra.name}}. */
  extra: Record<string, string>
}

/** Add one lead. 409 when the workspace already has them (same email or LinkedIn). */
export const addLeadApi = async (workspaceId: string, lead: LeadInput) =>
  toLead(await api<ApiLead>("/leads", { workspaceId, method: "POST", body: lead }))

export const deleteLeadsApi = (workspaceId: string, leadIds: string[]) =>
  api<{ changed: number }>("/leads/delete", { workspaceId, method: "POST", body: { leadIds } })

export const moveLeadsApi = (workspaceId: string, leadIds: string[], icpId: string) =>
  api<{ changed: number }>("/leads/move", { workspaceId, method: "POST", body: { leadIds, icpId } })


export interface LeadImportResult {
  dryRun: boolean
  totalRows: number
  imported: number
  duplicatesInFile: number
  duplicatesExisting: number
  invalid: number
  websitesFromEmail: number
  /** Each CSV column and the lead field it fills, or null when it's kept as an extra field. */
  columns: { column: string; field: string | null }[]
  rows: { row: number; outcome: "imported" | "duplicate" | "invalid"; reason: string | null }[]
}

/** Import a CSV into an ICP. With dryRun, nothing is saved: the result previews each row's outcome. */
export const importLeadsCsv = (workspaceId: string, icpId: string, csv: string, dryRun: boolean) =>
  api<LeadImportResult>(`/leads/import?icpId=${icpId}&dryRun=${dryRun}`, { workspaceId, method: "POST", csv })
