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
  | "skipped"
  | "failed"

export const LEAD_STATUSES: LeadStatus[] = [
  "imported",
  "enriching",
  "enriched",
  "no_content",
  "generated",
  "approved",
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
  createdAt: string
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

export type PromptKind = "hook" | "email"

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

export type GenerationStatus = "draft" | "edited" | "approved" | "skipped"

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
}

export interface Settings {
  defaultModel: string
  postsPerLead: number
  maxPostAgeDays: number
  monthlyBudgetUsd: number
  /** Spend recorded this calendar month (mock). */
  spentThisMonthUsd: number
}
