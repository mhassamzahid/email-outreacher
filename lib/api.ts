"use client"

import { useCallback, useEffect, useState } from "react"
import type { Company, LeadIntelIcp, Workspace } from "./types"

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

export const fetchIcps = () => api<(LeadIntelIcp & { companyCount: number })[]>("/icps")

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
