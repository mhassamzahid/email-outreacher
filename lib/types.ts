export type Source = "linkedin" | "instagram" | "facebook" | "website"

export const SOURCES: Source[] = ["linkedin", "instagram", "facebook", "website"]

export type MediaType = "text" | "image" | "video" | "carousel" | "article" | "page"

export interface ICP {
  id: string
  name: string
  description: string
  titles: string[]
  industries: string[]
  companySize: string
  locations: string[]
  pains: string
  offer: string
  proof: string
  cta: string
  tone: string
  exampleEmail: string
  wordsToAvoid: string
  hookGuidance: string
  enabledSources: Source[]
  /** null = use the default hook template */
  hookPromptId: string | null
  /** null = use the default email template */
  emailPromptId: string | null
  createdAt: string
  updatedAt: string
}

export type LeadStatus =
  | "imported"
  | "enriching"
  | "enriched"
  | "no_content"
  | "generated"
  | "approved"
  | "sent"
  | "skipped"
  | "failed"

export const LEAD_STATUSES: LeadStatus[] = [
  "imported",
  "enriching",
  "enriched",
  "no_content",
  "generated",
  "approved",
  "sent",
  "skipped",
  "failed",
]

export interface Lead {
  id: string
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
  extra: Record<string, string>
  status: LeadStatus
  /** AI lead score from the scoring prompt; null until the lead has a draft to score. */
  score: LeadScore | null
  createdAt: string
}

export interface LeadScore {
  /** 0 to 100 */
  value: number
  reasons: string[]
  promptVersionId: string
  scoredAt: string
}

export interface EnrichmentItem {
  id: string
  leadId: string
  source: Source
  url: string
  postedAt: string
  text: string
  mediaType: MediaType
}

export type PromptKind = "hook" | "email" | "score"

export interface PromptTemplate {
  id: string
  name: string
  kind: PromptKind
  isDefault: boolean
  currentVersionId: string
}

export interface PromptVersion {
  id: string
  templateId: string
  version: number
  systemPrompt: string
  userPrompt: string
  model: string
  temperature: number
  maxTokens: number
  note: string
  createdAt: string
}

export type GenerationStatus = "draft" | "edited" | "approved" | "sent" | "skipped"

export type GenerationFlag =
  | "sensitive_topic"
  | "repost"
  | "old_content"
  | "low_relevance"
  | "word_count"

export interface Generation {
  id: string
  leadId: string
  hookPromptVersionId: string
  emailPromptVersionId: string
  chosenItemId: string | null
  hook: string
  /** 0 to 5 */
  relevance: number
  subject: string
  body: string
  /** 0 to 100 */
  confidence: number
  flags: GenerationFlag[]
  status: GenerationStatus
  editedBody: string | null
  costUsd: number
  createdAt: string
  sentAt: string | null
  /** "auto" when the lead scored at or above the threshold with auto-send on. */
  sentBy: "auto" | "manual" | null
}

export interface Settings {
  defaultModel: string
  postsPerLead: number
  maxPostAgeDays: number
  monthlyBudgetUsd: number
  /** Spend recorded this calendar month (mock). */
  spentThisMonthUsd: number
  scoring: ScoringSettings
}

export interface ScoringSettings {
  /** Scoring template; null uses the default scoring template. */
  promptId: string | null
  /** Leads scoring at or above this are sent automatically (when autoSend is on). */
  threshold: number
  autoSend: boolean
  /** Most emails auto-sent per day; the rest wait in review. */
  dailyAutoSendCap: number
}

export type Role = "sales" | "management" | "admin"

export const ROLES: Role[] = ["sales", "management", "admin"]

export type UserStatus = "active" | "invited" | "deactivated"

export interface User {
  id: string
  name: string
  email: string
  role: Role
  workspaceIds: string[]
  status: UserStatus
  /** null until they first sign in. */
  lastActiveAt: string | null
  createdAt: string
}

export interface Workspace {
  id: string
  name: string
  description: string
  createdAt: string
}
