import { uid } from "./mock-actions"
import type { Lead } from "./types"

export type LeadField =
  | "firstName"
  | "lastName"
  | "email"
  | "company"
  | "title"
  | "website"
  | "linkedinUrl"
  | "instagramUrl"
  | "facebookUrl"

export type MappingTarget = LeadField | "__extra__" | "__ignore__"

export const LEAD_FIELDS: { field: LeadField; label: string; synonyms: string[] }[] = [
  { field: "firstName", label: "First name", synonyms: ["firstname", "first", "fname", "givenname"] },
  { field: "lastName", label: "Last name", synonyms: ["lastname", "last", "lname", "surname", "familyname"] },
  { field: "email", label: "Email", synonyms: ["email", "emailaddress", "workemail", "mail", "businessemail"] },
  { field: "company", label: "Company", synonyms: ["company", "companyname", "organization", "organisation", "account", "brand"] },
  { field: "title", label: "Job title", synonyms: ["title", "jobtitle", "position", "role", "designation"] },
  { field: "website", label: "Website", synonyms: ["website", "url", "domain", "companywebsite", "site", "web", "companyurl"] },
  { field: "linkedinUrl", label: "LinkedIn URL", synonyms: ["linkedin", "linkedinurl", "linkedinprofile", "personallinkedin", "li"] },
  { field: "instagramUrl", label: "Instagram URL", synonyms: ["instagram", "instagramurl", "ig", "insta"] },
  { field: "facebookUrl", label: "Facebook URL", synonyms: ["facebook", "facebookurl", "fb", "facebookpage"] },
]

export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
])

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

function scoreHeader(header: string, synonyms: string[]): number {
  const h = normalize(header)
  if (!h) return 0
  if (synonyms.includes(h)) return 3
  if (synonyms.some((s) => s.length > 2 && (h.startsWith(s) || h.endsWith(s)))) return 2
  if (synonyms.some((s) => s.length > 3 && h.includes(s))) return 1
  return 0
}

/** Best field per header by fuzzy match. Each field is used once; the rest go to `extra`. */
export function suggestMapping(headers: string[]): MappingTarget[] {
  const candidates: { col: number; field: LeadField; score: number }[] = []
  headers.forEach((h, col) => {
    for (const f of LEAD_FIELDS) {
      const score = scoreHeader(h, f.synonyms)
      if (score) candidates.push({ col, field: f.field, score })
    }
  })
  candidates.sort((a, b) => b.score - a.score)
  const mapping: MappingTarget[] = headers.map(() => "__extra__")
  const usedFields = new Set<LeadField>()
  const usedCols = new Set<number>()
  for (const c of candidates) {
    if (usedFields.has(c.field) || usedCols.has(c.col)) continue
    mapping[c.col] = c.field
    usedFields.add(c.field)
    usedCols.add(c.col)
  }
  return mapping
}

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase().trim() ?? ""
}

function normalizeUrl(value: string): string {
  const v = value.trim()
  if (!v) return ""
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

export interface ImportStats {
  totalRows: number
  missingEmail: number
  duplicatesInFile: number
  duplicatesExisting: number
  websitesDerived: number
  withLinkedin: number
  withInstagram: number
  withFacebook: number
  withWebsite: number
}

export interface ImportResult {
  leads: Lead[]
  stats: ImportStats
  /** Lead index for each data row, or the reason it was dropped. */
  rowOutcome: (number | "missing_email" | "duplicate")[]
  derivedWebsite: Set<number>
}

export function buildImport(
  headers: string[],
  rows: string[][],
  mapping: MappingTarget[],
  icpId: string,
  existingEmails: Set<string>,
): ImportResult {
  const stats: ImportStats = {
    totalRows: rows.length,
    missingEmail: 0,
    duplicatesInFile: 0,
    duplicatesExisting: 0,
    websitesDerived: 0,
    withLinkedin: 0,
    withInstagram: 0,
    withFacebook: 0,
    withWebsite: 0,
  }
  const seen = new Set<string>()
  const leads: Lead[] = []
  const rowOutcome: ImportResult["rowOutcome"] = []
  const derivedWebsite = new Set<number>()
  const now = new Date().toISOString()

  for (const row of rows) {
    const fields: Partial<Record<LeadField, string>> = {}
    const extra: Record<string, string> = {}
    mapping.forEach((target, col) => {
      const value = (row[col] ?? "").trim()
      if (target === "__ignore__") return
      if (target === "__extra__") {
        if (value) extra[headers[col].trim() || `column_${col + 1}`] = value
      } else if (value) {
        fields[target] = value
      }
    })

    const email = (fields.email ?? "").toLowerCase()
    if (!email || !email.includes("@")) {
      stats.missingEmail++
      rowOutcome.push("missing_email")
      continue
    }
    if (existingEmails.has(email)) {
      stats.duplicatesExisting++
      rowOutcome.push("duplicate")
      continue
    }
    if (seen.has(email)) {
      stats.duplicatesInFile++
      rowOutcome.push("duplicate")
      continue
    }
    seen.add(email)

    let website = normalizeUrl(fields.website ?? "")
    const domain = domainOf(email)
    if (!website && domain && !FREE_MAIL_DOMAINS.has(domain)) {
      website = `https://${domain}`
      stats.websitesDerived++
      derivedWebsite.add(leads.length)
    }

    const lead: Lead = {
      id: uid("lead"),
      icpId,
      firstName: fields.firstName ?? "",
      lastName: fields.lastName ?? "",
      email,
      company: fields.company ?? "",
      title: fields.title ?? "",
      website,
      linkedinUrl: normalizeUrl(fields.linkedinUrl ?? ""),
      instagramUrl: normalizeUrl(fields.instagramUrl ?? ""),
      facebookUrl: normalizeUrl(fields.facebookUrl ?? ""),
      extra,
      status: "imported",
      createdAt: now,
    }
    if (lead.linkedinUrl) stats.withLinkedin++
    if (lead.instagramUrl) stats.withInstagram++
    if (lead.facebookUrl) stats.withFacebook++
    if (lead.website) stats.withWebsite++
    rowOutcome.push(leads.length)
    leads.push(lead)
  }

  return { leads, stats, rowOutcome, derivedWebsite }
}

export const SAMPLE_CSV = [
  ["First Name", "Last Name", "Email", "Company", "Job Title", "LinkedIn URL", "Instagram", "Facebook", "Website", "City"],
  ["Ava", "Morgan", "ava@brightloom.com", "Brightloom", "Founder", "linkedin.com/in/ava-morgan", "instagram.com/brightloom", "", "brightloom.com", "Austin"],
  ["Liam", "Carter", "liam@northpeak.io", "Northpeak", "CEO", "https://www.linkedin.com/in/liam-carter", "", "", "", "Denver"],
  ["Noor", "Saeed", "noor.saeed@gmail.com", "Saeed & Co, Interiors", "Owner", "", "instagram.com/saeedinteriors", "facebook.com/saeedinteriors", "", "Dubai"],
  ["Ethan", "Ross", "ethan@fieldhouse.co", "Fieldhouse", "Co-founder", "linkedin.com/in/ethan-ross", "", "", "", "Chicago"],
  ["Ava", "Morgan", "AVA@brightloom.com", "Brightloom", "Founder", "", "", "", "", "Austin"],
  ["Grace", "Lee", "", "Harbor Supply", "Head of Growth", "linkedin.com/in/grace-lee", "", "", "harborsupply.com", "Seattle"],
]
