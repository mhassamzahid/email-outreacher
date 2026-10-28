"use client"

import { createContext, useCallback, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { toast } from "sonner"
import * as api from "./api"
import * as mock from "./mock-data"
import { runEnrichment, runGeneration, runScoring, uid } from "./mock-actions"
import { COST_PER_SCORE, autoSentToday, sendDecision } from "./scoring"
import { currentVersion, generationByLead, resolveScoringTemplate, resolveTemplate } from "./selectors"
import type {
  EnrichmentItem,
  Generation,
  GenerationStatus,
  ICP,
  IcpOutreach,
  Lead,
  LeadStatus,
  PromptKind,
  PromptTemplate,
  PromptVersion,
  Settings,
  Source,
  User,
  Workspace,
} from "./types"

// Client-side app state shared across pages. Workspaces, ICPs and prompts come from the backend;
// leads, enrichment and generations are still seeded from mock data and reset on refresh.

export interface SourceProgress {
  done: number
  found: number
  empty: number
  failed: number
}

export interface EnrichmentJob {
  icpId: string
  total: number
  completed: number
  bySource: Record<Source, SourceProgress>
  outcomes: { enriched: number; no_content: number; failed: number }
  costUsd: number
  running: boolean
}

export interface GenerationJob {
  icpId: string
  total: number
  completed: number
  costUsd: number
  running: boolean
}

export type VersionDraft = Pick<PromptVersion, "systemPrompt" | "userPrompt" | "model" | "temperature" | "maxTokens">

interface Store {
  icps: ICP[]
  leads: Lead[]
  setLeads: Dispatch<SetStateAction<Lead[]>>
  items: EnrichmentItem[]
  generations: Generation[]
  templates: PromptTemplate[]
  versions: PromptVersion[]
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  enrichJobs: Record<string, EnrichmentJob>
  genJobs: Record<string, GenerationJob>

  /** Lead Intel's ICPs with this workspace's outreach settings. Empty until loaded; see icpsStatus. */
  icpsStatus: "loading" | "ready" | "error"
  icpsError: string | null
  reloadIcps: () => void
  /**
   * Change an ICP's outreach settings, prompt choices included. Saved to the backend (Lead Intel's own
   * fields are never sent). Rejects if the save fails.
   */
  updateIcp: (id: string, patch: Partial<IcpOutreach>) => Promise<void>
  /**
   * Add an ICP to Lead Intel (shared by both projects), then save this workspace's outreach settings
   * for it if any were given. Rejects with the backend's reason (e.g. a name that's taken) if the ICP
   * wasn't created. If it was but the outreach settings didn't save, resolves with a `warning`.
   */
  createIcp: (input: api.IcpCreate, outreach?: Partial<IcpOutreach>) => Promise<{ icp: ICP; warning?: string }>
  addLeads: (leads: Lead[]) => void
  moveLeads: (ids: string[], icpId: string) => void
  deleteLeads: (ids: string[]) => void
  startEnrichment: (icpId: string, leadIds: string[]) => Promise<void>
  dismissEnrichJob: (icpId: string) => void
  startGeneration: (
    icpId: string,
    leadIds: string[],
    opts?: { instruction?: string; excludeItemIds?: string[]; reviewOnly?: boolean },
  ) => Promise<void>
  updateGeneration: (id: string, patch: Partial<Generation>) => void
  setGenerationStatus: (ids: string[], status: GenerationStatus) => void
  /** Marks approved emails as sent by a person (simulated: nothing leaves the app). */
  sendGenerations: (ids: string[]) => void
  /** Re-runs the scoring prompt for one lead's current draft. */
  rescoreLead: (leadId: string) => Promise<void>
  /** The workspace's prompts, from the backend. Empty until loaded; see promptsStatus. */
  promptsStatus: "loading" | "ready" | "error"
  promptsError: string | null
  reloadPrompts: () => void
  /** Saved in the backend as the template's next version. Rejects with the backend's reason. */
  saveVersion: (templateId: string, draft: VersionDraft, note: string) => Promise<PromptVersion>
  restoreVersion: (versionId: string) => Promise<PromptVersion | undefined>
  duplicateTemplate: (templateId: string) => Promise<PromptTemplate>
  /** New template whose v1 is the given prompt. */
  createTemplate: (input: { name: string; kind: PromptKind; draft: VersionDraft; note: string; isDefault?: boolean }) => Promise<PromptTemplate>
  /** Removes a template and its versions. The backend refuses the default or one an ICP uses. */
  deleteTemplate: (templateId: string) => Promise<void>
  setDefaultTemplate: (templateId: string) => Promise<void>

  users: User[]
  /** From the backend. Empty until loaded; see workspacesStatus. */
  workspaces: Workspace[]
  workspacesStatus: "loading" | "ready" | "error"
  workspacesError: string | null
  reloadWorkspaces: () => void
  currentUserId: string
  currentWorkspaceId: string
  setCurrentWorkspace: (id: string) => void
  /** Adds the person as "invited" (simulated: no email is sent). */
  inviteUser: (input: Pick<User, "name" | "email" | "role" | "workspaceIds">) => User
  updateUser: (id: string, patch: Partial<Pick<User, "name" | "role" | "workspaceIds" | "status">>) => void
  removeUser: (id: string) => void
  /** Saved in the backend. Rejects with the backend's reason (e.g. the name is taken). */
  createWorkspace: (input: { name: string; description: string; memberIds: string[] }) => Promise<Workspace>
  updateWorkspace: (id: string, patch: Partial<Pick<Workspace, "name" | "description">>) => Promise<void>
  /** Sets which non-admins can open the workspace. Admins always can, so they're left alone. */
  setWorkspaceMembers: (id: string, memberIds: string[]) => void
  /** Deletes it in the backend and takes it off every user. Callers check it is not the current one. */
  deleteWorkspace: (id: string) => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

const CURRENT_WORKSPACE_KEY = "eo.currentWorkspaceId"

const emptyProgress = (): Record<Source, SourceProgress> => ({
  linkedin: { done: 0, found: 0, empty: 0, failed: 0 },
  instagram: { done: 0, found: 0, empty: 0, failed: 0 },
  facebook: { done: 0, found: 0, empty: 0, failed: 0 },
  website: { done: 0, found: 0, empty: 0, failed: 0 },
})

const LEAD_STATUS_FOR: Record<GenerationStatus, LeadStatus> = {
  draft: "generated",
  edited: "generated",
  approved: "approved",
  sent: "sent",
  skipped: "skipped",
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [icps, setIcps] = useState<ICP[]>([])
  const [icpsStatus, setIcpsStatus] = useState<Store["icpsStatus"]>("loading")
  const [icpsError, setIcpsError] = useState<string | null>(null)
  const [icpsTick, setIcpsTick] = useState(0)
  const [leads, setLeads] = useState(mock.leads)
  const [items, setItems] = useState(mock.enrichmentItems)
  const [generations, setGenerations] = useState(mock.generations)
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [promptsStatus, setPromptsStatus] = useState<Store["promptsStatus"]>("loading")
  const [promptsError, setPromptsError] = useState<string | null>(null)
  const [promptsTick, setPromptsTick] = useState(0)
  const [settings, setSettings] = useState(mock.settings)
  const [enrichJobs, setEnrichJobs] = useState<Record<string, EnrichmentJob>>({})
  const [genJobs, setGenJobs] = useState<Record<string, GenerationJob>>({})
  const [users, setUsers] = useState(mock.users)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspacesStatus, setWorkspacesStatus] = useState<Store["workspacesStatus"]>("loading")
  const [workspacesError, setWorkspacesError] = useState<string | null>(null)
  const [workspacesTick, setWorkspacesTick] = useState(0)
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState("")

  // The chosen workspace is remembered per browser; it falls back to the first one.
  const setCurrentWorkspace = useCallback((id: string) => {
    setCurrentWorkspaceId(id)
    try {
      localStorage.setItem(CURRENT_WORKSPACE_KEY, id)
    } catch {
      // Storage can be unavailable (private windows); the choice just won't survive a reload.
    }
  }, [])

  useEffect(() => {
    let live = true
    api
      .fetchWorkspaces()
      .then((list) => {
        if (!live) return
        setWorkspaces(list)
        setWorkspacesStatus("ready")
        setWorkspacesError(null)
        let saved: string | null = null
        try {
          saved = localStorage.getItem(CURRENT_WORKSPACE_KEY)
        } catch {}
        setCurrentWorkspaceId((current) =>
          list.some((w) => w.id === current) ? current : list.find((w) => w.id === saved)?.id ?? list[0]?.id ?? "",
        )
      })
      .catch((e: unknown) => {
        if (!live) return
        setWorkspacesStatus("error")
        setWorkspacesError(e instanceof Error ? e.message : "Couldn't load workspaces.")
      })
    return () => {
      live = false
    }
  }, [workspacesTick])

  const reloadWorkspaces = useCallback(() => {
    setWorkspacesStatus("loading")
    setWorkspacesTick((t) => t + 1)
  }, [])

  const addSpend = (usd: number) =>
    setSettings((s) => ({ ...s, spentThisMonthUsd: Math.round((s.spentThisMonthUsd + usd) * 10000) / 10000 }))

  // ICPs come from Lead Intel (shared with it) plus this workspace's outreach settings, so they
  // reload whenever the workspace changes.
  useEffect(() => {
    if (!currentWorkspaceId) return
    let live = true
    api
      .fetchIcps(currentWorkspaceId)
      .then((list) => {
        if (!live) return
        setIcps(list.map(api.toIcp))
        setIcpsStatus("ready")
        setIcpsError(null)
      })
      .catch((e: unknown) => {
        if (!live) return
        setIcpsStatus("error")
        setIcpsError(e instanceof Error ? e.message : "Couldn't load ICPs.")
      })
    return () => {
      live = false
    }
  }, [currentWorkspaceId, icpsTick])

  // Prompts belong to the workspace. The backend creates its built-in defaults on the first read.
  useEffect(() => {
    if (!currentWorkspaceId) return
    let live = true
    api
      .fetchPrompts(currentWorkspaceId)
      .then(({ prompts, versions }) => {
        if (!live) return
        setTemplates(prompts)
        setVersions(versions)
        setPromptsStatus("ready")
        setPromptsError(null)
      })
      .catch((e: unknown) => {
        if (!live) return
        setPromptsStatus("error")
        setPromptsError(e instanceof Error ? e.message : "Couldn't load prompts.")
      })
    return () => {
      live = false
    }
  }, [currentWorkspaceId, promptsTick])

  const reloadPrompts = useCallback(() => {
    setPromptsStatus("loading")
    setPromptsTick((t) => t + 1)
  }, [])

  const reloadIcps = useCallback(() => {
    setIcpsStatus("loading")
    setIcpsTick((t) => t + 1)
  }, [])

  const createIcp: Store["createIcp"] = async (input, outreach) => {
    let icp = api.toIcp(await api.createIcp(input))
    let warning: string | undefined
    if (outreach && Object.keys(outreach).length) {
      try {
        const saved = await api.saveIcpOutreach(currentWorkspaceId, icp.id, { ...icp, ...outreach })
        icp = { ...icp, ...outreach, updatedAt: saved.updatedAt }
      } catch (e) {
        warning = `The ICP was created, but who to reach wasn't saved: ${e instanceof Error ? e.message : "unknown error"}`
      }
    }
    setIcps((list) => [...list, icp].sort((a, b) => a.priority - b.priority))
    return { icp, warning }
  }

  const updateIcp: Store["updateIcp"] = async (id, patch) => {
    const current = icps.find((i) => i.id === id)
    if (!current) return
    const next: ICP = { ...current, ...patch }
    const saved = await api.saveIcpOutreach(currentWorkspaceId, id, next)
    next.updatedAt = saved.updatedAt
    setIcps((list) => list.map((icp) => (icp.id === id ? next : icp)))
  }

  const addLeads: Store["addLeads"] = (newLeads) => setLeads((list) => [...list, ...newLeads])

  const moveLeads: Store["moveLeads"] = (ids, icpId) =>
    setLeads((list) => list.map((l) => (ids.includes(l.id) ? { ...l, icpId } : l)))

  const deleteLeads: Store["deleteLeads"] = (ids) => {
    setLeads((list) => list.filter((l) => !ids.includes(l.id)))
    setItems((list) => list.filter((it) => !ids.includes(it.leadId)))
    setGenerations((list) => list.filter((g) => !ids.includes(g.leadId)))
  }

  const startEnrichment: Store["startEnrichment"] = async (icpId, leadIds) => {
    const icp = icps.find((i) => i.id === icpId)
    if (!icp || leadIds.length === 0) return
    const targets = leads.filter((l) => leadIds.includes(l.id))
    setLeads((list) => list.map((l) => (leadIds.includes(l.id) ? { ...l, status: "enriching" } : l)))
    setItems((list) => list.filter((it) => !leadIds.includes(it.leadId)))
    setEnrichJobs((jobs) => ({
      ...jobs,
      [icpId]: {
        icpId,
        total: targets.length,
        completed: 0,
        bySource: emptyProgress(),
        outcomes: { enriched: 0, no_content: 0, failed: 0 },
        costUsd: 0,
        running: true,
      },
    }))

    await runEnrichment(targets, icp, settings, (result) => {
      setLeads((list) => list.map((l) => (l.id === result.leadId ? { ...l, status: result.status } : l)))
      setItems((list) => [...list, ...result.items])
      addSpend(result.costUsd)
      setEnrichJobs((jobs) => {
        const job = jobs[icpId]
        if (!job) return jobs
        const bySource = { ...job.bySource }
        for (const [source, outcome] of Object.entries(result.sourceOutcomes) as [Source, string][]) {
          const p = { ...bySource[source] }
          p.done++
          if (outcome === "found") p.found++
          else if (outcome === "empty") p.empty++
          else p.failed++
          bySource[source] = p
        }
        return {
          ...jobs,
          [icpId]: {
            ...job,
            completed: job.completed + 1,
            bySource,
            outcomes: { ...job.outcomes, [result.status]: job.outcomes[result.status] + 1 },
            costUsd: job.costUsd + result.costUsd,
          },
        }
      })
    })

    setEnrichJobs((jobs) => (jobs[icpId] ? { ...jobs, [icpId]: { ...jobs[icpId], running: false } } : jobs))
    toast.success(`Enrichment finished for ${targets.length} lead${targets.length === 1 ? "" : "s"}`)
  }

  const dismissEnrichJob: Store["dismissEnrichJob"] = (icpId) =>
    setEnrichJobs((jobs) => {
      const next = { ...jobs }
      delete next[icpId]
      return next
    })

  const startGeneration: Store["startGeneration"] = async (icpId, leadIds, opts = {}) => {
    const icp = icps.find((i) => i.id === icpId)
    const hookVersion = icp && currentVersion(versions, resolveTemplate(templates, icp, "hook"))
    const emailVersion = icp && currentVersion(versions, resolveTemplate(templates, icp, "email"))
    const scoreVersion = currentVersion(versions, resolveScoringTemplate(templates, settings.scoring))
    if (!icp || !hookVersion || !emailVersion || !scoreVersion || leadIds.length === 0) return
    const targets = leads.filter((l) => leadIds.includes(l.id))
    setGenJobs((jobs) => ({
      ...jobs,
      [icpId]: { icpId, total: targets.length, completed: 0, costUsd: 0, running: true },
    }))
    let sentToday = autoSentToday(generations)
    let autoSent = 0

    await runGeneration(
      { icp, leads: targets, items, hookVersion, emailVersion, scoreVersion, instruction: opts.instruction, excludeItemIds: opts.excludeItemIds },
      (g, score) => {
        // Regenerating from the review panel never auto-sends: a person is already looking at it.
        const decision = opts.instruction || opts.excludeItemIds || opts.reviewOnly
          ? { send: false }
          : sendDecision(score.value, g.flags, settings.scoring, sentToday)
        const final: Generation = decision.send ? { ...g, status: "sent", sentAt: new Date().toISOString(), sentBy: "auto" } : g
        if (decision.send) {
          sentToday++
          autoSent++
        }
        setGenerations((list) => [...list.filter((x) => x.leadId !== g.leadId), final])
        setLeads((list) =>
          list.map((l) => (l.id === g.leadId ? { ...l, score, status: decision.send ? "sent" : "generated" } : l)),
        )
        const cost = g.costUsd + COST_PER_SCORE
        addSpend(cost)
        setGenJobs((jobs) => {
          const job = jobs[icpId]
          return job ? { ...jobs, [icpId]: { ...job, completed: job.completed + 1, costUsd: job.costUsd + cost } } : jobs
        })
      },
    )

    setGenJobs((jobs) => (jobs[icpId] ? { ...jobs, [icpId]: { ...jobs[icpId], running: false } } : jobs))
    const n = targets.length
    toast.success(
      autoSent
        ? `Generated ${n} email${n === 1 ? "" : "s"}: ${autoSent} sent automatically, ${n - autoSent} waiting for review`
        : `Generated and scored ${n} email${n === 1 ? "" : "s"}, ready for review`,
    )
  }

  const updateGeneration: Store["updateGeneration"] = (id, patch) => {
    const gen = generations.find((g) => g.id === id)
    setGenerations((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)))
    if (gen && patch.status)
      setLeads((list) => list.map((l) => (l.id === gen.leadId ? { ...l, status: LEAD_STATUS_FOR[patch.status!] } : l)))
  }

  const setGenerationStatus: Store["setGenerationStatus"] = (ids, status) => {
    const leadIds = generations.filter((g) => ids.includes(g.id)).map((g) => g.leadId)
    setGenerations((list) => list.map((g) => (ids.includes(g.id) ? { ...g, status } : g)))
    setLeads((list) => list.map((l) => (leadIds.includes(l.id) ? { ...l, status: LEAD_STATUS_FOR[status] } : l)))
  }

  const sendGenerations: Store["sendGenerations"] = (ids) => {
    const now = new Date().toISOString()
    const leadIds = generations.filter((g) => ids.includes(g.id)).map((g) => g.leadId)
    setGenerations((list) =>
      list.map((g) => (ids.includes(g.id) ? { ...g, status: "sent", sentAt: now, sentBy: "manual" } : g)),
    )
    setLeads((list) => list.map((l) => (leadIds.includes(l.id) ? { ...l, status: "sent" } : l)))
  }

  const rescoreLead: Store["rescoreLead"] = async (leadId) => {
    const lead = leads.find((l) => l.id === leadId)
    const icp = lead && icps.find((i) => i.id === lead.icpId)
    const generation = generationByLead(generations).get(leadId)
    const scoreVersion = currentVersion(versions, resolveScoringTemplate(templates, settings.scoring))
    if (!lead || !icp || !generation || !scoreVersion) return
    const score = await runScoring(icp, lead, generation, items, scoreVersion)
    setLeads((list) => list.map((l) => (l.id === leadId ? { ...l, score } : l)))
    addSpend(COST_PER_SCORE)
  }

  const saveVersion: Store["saveVersion"] = async (templateId, draft, note) => {
    const version = await api.savePromptVersion(currentWorkspaceId, templateId, draft, note)
    setVersions((list) => [...list, version])
    setTemplates((list) => list.map((t) => (t.id === templateId ? { ...t, currentVersionId: version.id } : t)))
    return version
  }

  const restoreVersion: Store["restoreVersion"] = async (versionId) => {
    const source = versions.find((v) => v.id === versionId)
    if (!source) return undefined
    const { systemPrompt, userPrompt, model, temperature, maxTokens } = source
    return saveVersion(
      source.templateId,
      { systemPrompt, userPrompt, model, temperature, maxTokens },
      `Restored from v${source.version}`,
    )
  }

  const createTemplate: Store["createTemplate"] = async ({ name, kind, draft, note, isDefault }) => {
    const { prompt, version } = await api.createPrompt(currentWorkspaceId, { name: name.trim(), kind, version: draft, note, isDefault })
    setTemplates((list) => [...list.map((t) => (isDefault && t.kind === kind ? { ...t, isDefault: false } : t)), prompt])
    setVersions((list) => [...list, version])
    return prompt
  }

  const duplicateTemplate: Store["duplicateTemplate"] = async (templateId) => {
    const tpl = templates.find((t) => t.id === templateId)!
    const current = versions.find((v) => v.id === tpl.currentVersionId)!
    const { systemPrompt, userPrompt, model, temperature, maxTokens } = current
    return createTemplate({
      name: `${tpl.name} (copy)`,
      kind: tpl.kind,
      draft: { systemPrompt, userPrompt, model, temperature, maxTokens },
      note: `Duplicated from ${tpl.name} v${current.version}`,
    })
  }

  const deleteTemplate: Store["deleteTemplate"] = async (templateId) => {
    await api.deletePrompt(currentWorkspaceId, templateId)
    setTemplates((list) => list.filter((t) => t.id !== templateId))
    setVersions((list) => list.filter((v) => v.templateId !== templateId))
  }

  const setDefaultTemplate: Store["setDefaultTemplate"] = async (templateId) => {
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    await api.updatePrompt(currentWorkspaceId, templateId, { isDefault: true })
    setTemplates((list) => list.map((t) => (t.kind === tpl.kind ? { ...t, isDefault: t.id === templateId } : t)))
  }

  const inviteUser: Store["inviteUser"] = (input) => {
    const user: User = {
      ...input,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      id: uid("usr"),
      status: "invited",
      lastActiveAt: null,
      createdAt: new Date().toISOString(),
    }
    setUsers((list) => [...list, user])
    return user
  }

  const updateUser: Store["updateUser"] = (id, patch) =>
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)))

  const removeUser: Store["removeUser"] = (id) => setUsers((list) => list.filter((u) => u.id !== id))

  const createWorkspace: Store["createWorkspace"] = async ({ name, description, memberIds }) => {
    const ws = await api.createWorkspace({ name: name.trim(), description: description.trim() })
    setWorkspaces((list) => [...list, ws])
    // Admins see every workspace; everyone else only the ones they were added to.
    setUsers((list) =>
      list.map((u) => (u.role === "admin" || memberIds.includes(u.id) ? { ...u, workspaceIds: [...u.workspaceIds, ws.id] } : u)),
    )
    return ws
  }

  const updateWorkspace: Store["updateWorkspace"] = async (id, patch) => {
    const ws = await api.updateWorkspace(id, patch)
    setWorkspaces((list) => list.map((w) => (w.id === id ? ws : w)))
  }

  const setWorkspaceMembers: Store["setWorkspaceMembers"] = (id, memberIds) =>
    setUsers((list) =>
      list.map((u) => {
        if (u.role === "admin") return u
        const without = u.workspaceIds.filter((w) => w !== id)
        return { ...u, workspaceIds: memberIds.includes(u.id) ? [...without, id] : without }
      }),
    )

  const deleteWorkspace: Store["deleteWorkspace"] = async (id) => {
    await api.deleteWorkspace(id)
    setWorkspaces((list) => list.filter((w) => w.id !== id))
    setUsers((list) => list.map((u) => ({ ...u, workspaceIds: u.workspaceIds.filter((w) => w !== id) })))
  }

  return (
    <StoreContext.Provider
      value={{
        icps,
        leads,
        setLeads,
        items,
        generations,
        templates,
        versions,
        settings,
        setSettings,
        enrichJobs,
        genJobs,
        icpsStatus,
        icpsError,
        reloadIcps,
        updateIcp,
        createIcp,
        addLeads,
        moveLeads,
        deleteLeads,
        startEnrichment,
        dismissEnrichJob,
        startGeneration,
        updateGeneration,
        setGenerationStatus,
        sendGenerations,
        rescoreLead,
        promptsStatus,
        promptsError,
        reloadPrompts,
        saveVersion,
        restoreVersion,
        duplicateTemplate,
        createTemplate,
        deleteTemplate,
        setDefaultTemplate,
        users,
        workspaces,
        workspacesStatus,
        workspacesError,
        reloadWorkspaces,
        currentUserId: mock.CURRENT_USER_ID,
        currentWorkspaceId,
        setCurrentWorkspace,
        inviteUser,
        updateUser,
        removeUser,
        createWorkspace,
        updateWorkspace,
        setWorkspaceMembers,
        deleteWorkspace,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error("useStore must be used inside StoreProvider")
  return store
}
