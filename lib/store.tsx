"use client"

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { toast } from "sonner"
import * as mock from "./mock-data"
import { runEnrichment, runGeneration, runScoring, uid } from "./mock-actions"
import { COST_PER_SCORE, autoSentToday, sendDecision } from "./scoring"
import { currentVersion, generationByLead, resolveScoringTemplate, resolveTemplate } from "./selectors"
import type {
  EnrichmentItem,
  Generation,
  GenerationStatus,
  ICP,
  Lead,
  LeadStatus,
  PromptKind,
  PromptTemplate,
  PromptVersion,
  Settings,
  Source,
} from "./types"

// Client-side app state shared across pages. Seeded from mock data and reset on refresh.
// When a backend exists, replace the initial state with fetched data and route the actions through it.

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

  createIcp: (input: Omit<ICP, "id" | "createdAt" | "updatedAt">) => ICP
  updateIcp: (id: string, patch: Partial<ICP>) => void
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
  saveVersion: (templateId: string, draft: VersionDraft, note: string) => PromptVersion
  restoreVersion: (versionId: string) => PromptVersion | undefined
  duplicateTemplate: (templateId: string) => PromptTemplate
  /** New template whose v1 is the given prompt. */
  createTemplate: (input: { name: string; kind: PromptKind; draft: VersionDraft; note: string }) => PromptTemplate
  /** Removes a template and its versions. Callers check it is not the default or in use. */
  deleteTemplate: (templateId: string) => void
  setDefaultTemplate: (templateId: string) => void
}

const StoreContext = createContext<Store | null>(null)

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
  const [icps, setIcps] = useState(mock.icps)
  const [leads, setLeads] = useState(mock.leads)
  const [items, setItems] = useState(mock.enrichmentItems)
  const [generations, setGenerations] = useState(mock.generations)
  const [templates, setTemplates] = useState(mock.promptTemplates)
  const [versions, setVersions] = useState(mock.promptVersions)
  const [settings, setSettings] = useState(mock.settings)
  const [enrichJobs, setEnrichJobs] = useState<Record<string, EnrichmentJob>>({})
  const [genJobs, setGenJobs] = useState<Record<string, GenerationJob>>({})

  const addSpend = (usd: number) =>
    setSettings((s) => ({ ...s, spentThisMonthUsd: Math.round((s.spentThisMonthUsd + usd) * 10000) / 10000 }))

  const createIcp: Store["createIcp"] = (input) => {
    const now = new Date().toISOString()
    const icp: ICP = { ...input, name: input.name.trim(), id: uid("icp"), createdAt: now, updatedAt: now }
    setIcps((list) => [...list, icp])
    return icp
  }

  const updateIcp: Store["updateIcp"] = (id, patch) =>
    setIcps((list) =>
      list.map((icp) => (icp.id === id ? { ...icp, ...patch, updatedAt: new Date().toISOString() } : icp)),
    )

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

  const saveVersion: Store["saveVersion"] = (templateId, draft, note) => {
    const latest = Math.max(0, ...versions.filter((v) => v.templateId === templateId).map((v) => v.version))
    const version: PromptVersion = {
      id: uid("pv"),
      templateId,
      version: latest + 1,
      ...draft,
      note,
      createdAt: new Date().toISOString(),
    }
    setVersions((list) => [...list, version])
    setTemplates((list) => list.map((t) => (t.id === templateId ? { ...t, currentVersionId: version.id } : t)))
    return version
  }

  const restoreVersion: Store["restoreVersion"] = (versionId) => {
    const source = versions.find((v) => v.id === versionId)
    if (!source) return undefined
    const { systemPrompt, userPrompt, model, temperature, maxTokens } = source
    return saveVersion(
      source.templateId,
      { systemPrompt, userPrompt, model, temperature, maxTokens },
      `Restored from v${source.version}`,
    )
  }

  const duplicateTemplate: Store["duplicateTemplate"] = (templateId) => {
    const tpl = templates.find((t) => t.id === templateId)!
    const current = versions.find((v) => v.id === tpl.currentVersionId)!
    const copy: PromptTemplate = { id: uid("tpl"), name: `${tpl.name} (copy)`, kind: tpl.kind, isDefault: false, currentVersionId: "" }
    const version: PromptVersion = {
      ...current,
      id: uid("pv"),
      templateId: copy.id,
      version: 1,
      note: `Duplicated from ${tpl.name} v${current.version}`,
      createdAt: new Date().toISOString(),
    }
    copy.currentVersionId = version.id
    setTemplates((list) => [...list, copy])
    setVersions((list) => [...list, version])
    return copy
  }

  const createTemplate: Store["createTemplate"] = ({ name, kind, draft, note }) => {
    const tpl: PromptTemplate = { id: uid("tpl"), name: name.trim(), kind, isDefault: false, currentVersionId: "" }
    const version: PromptVersion = {
      id: uid("pv"),
      templateId: tpl.id,
      version: 1,
      ...draft,
      note,
      createdAt: new Date().toISOString(),
    }
    tpl.currentVersionId = version.id
    setTemplates((list) => [...list, tpl])
    setVersions((list) => [...list, version])
    return tpl
  }

  const deleteTemplate: Store["deleteTemplate"] = (templateId) => {
    setTemplates((list) => list.filter((t) => t.id !== templateId))
    setVersions((list) => list.filter((v) => v.templateId !== templateId))
  }

  const setDefaultTemplate: Store["setDefaultTemplate"] = (templateId) => {
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    setTemplates((list) => list.map((t) => (t.kind === tpl.kind ? { ...t, isDefault: t.id === templateId } : t)))
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
        createIcp,
        updateIcp,
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
        saveVersion,
        restoreVersion,
        duplicateTemplate,
        createTemplate,
        deleteTemplate,
        setDefaultTemplate,
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
