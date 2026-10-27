"use client"

import { useCallback, useEffect, useState } from "react"
import type { Company, ICP, IcpOutreach, Source, Workspace } from "./types"

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

export interface ApiCompany extends Company {
  importedAt: string | null
}

/** This workspace's outreach settings for an ICP, as the backend stores them (eo_icp_profiles). */
export interface ApiIcpProfile extends Omit<IcpOutreach, "hookPromptId" | "emailPromptId"> {
  hookPromptId: string | null
  emailPromptId: string | null
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
  hookPromptId: null,
  emailPromptId: null,
}

/** One ICP for the app: Lead Intel's fields plus this workspace's outreach settings (or empty ones). */
export function toIcp(api: ApiIcp): ICP {
  const { profile, ...leadIntel } = api
  const outreach = profile ? { ...EMPTY_OUTREACH, ...profile, enabledSources: profile.enabledSources as Source[] } : EMPTY_OUTREACH
  return { ...leadIntel, ...outreach, updatedAt: profile?.updatedAt ?? api.updatedAt }
}

/**
 * Save the outreach half of an ICP. Lead Intel's own fields are never sent.
 * Prompt choices stay in the browser for now: prompts don't live in the backend yet.
 */
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
  }
  return api<ApiIcpProfile>(`/icps/${icpId}/profile`, { workspaceId, method: "PUT", body })
}

export const fetchIcps = (workspaceId?: string) => api<ApiIcp[]>("/icps", { workspaceId })

export const fetchCompanies = (workspaceId: string, scope?: "inWorkspace") =>
  apiAll<ApiCompany>(scope ? "/companies?inWorkspace=true" : "/companies", workspaceId)

export async function fetchCompanyDetail(id: string): Promise<{ siteText: string | null }> {
  const d = await api<{ fields: Record<string, string | null> }>(`/companies/${id}`)
  return { siteText: d.fields.site_text ?? d.fields.website_text ?? null }
}

export const importCompanies = (workspaceId: string, companyIds: string[]) =>
  api<{ imported: number; alreadyInWorkspace: number; notFound: string[] }>("/companies/import", {
    workspaceId,
    method: "POST",
    body: { companyIds },
  })

export const removeCompanies = (workspaceId: string, companyIds: string[]) =>
  api<{ removed: number }>("/companies/remove", { workspaceId, method: "POST", body: { companyIds } })

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

export const searchStakeholders = (
  workspaceId: string,
  body: { companyIds: string[]; titles: string[]; seniorities: string[] },
) => api<StakeholderSearchResult>("/stakeholders/search", { workspaceId, method: "POST", body })

export const revealStakeholders = (workspaceId: string, stakeholderIds: string[]) =>
  api<StakeholderRevealResult>("/stakeholders/reveal", { workspaceId, method: "POST", body: { stakeholderIds } })

export interface IcpSearch {
  icpId: string
  titles: string[]
  seniorities: string[]
  locations: string[]
  keywords: string
  employeeRanges: string[]
  verifiedEmailOnly: boolean
  perPage: number
  page: number
}

export const searchByIcp = (workspaceId: string, body: IcpSearch) =>
  api<{ found: number; new: number; totalAtApollo: number | null; page: number; error: string | null }>(
    "/stakeholders/search-icp",
    { workspaceId, method: "POST", body },
  )

export const fetchAllStakeholders = (workspaceId: string) => api<Stakeholder[]>("/stakeholders", { workspaceId })

/** A new ICP: exactly Lead Intel's fields. Added to Lead Intel's icps table, shared by both projects. */
export type IcpCreate = Pick<
  ICP,
  | "name" | "industry" | "priority" | "enabled" | "sources" | "anyOf" | "noneOf" | "websiteAnyOf" | "instagramAnyOf"
  | "requireAll" | "minFollowers" | "maxFollowers" | "searchTerms" | "requiresWebsite" | "minReviews" | "places"
>

export const createIcp = (body: IcpCreate) => api<ApiIcp>("/icps", { method: "POST", body })
