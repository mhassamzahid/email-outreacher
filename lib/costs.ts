import type { Source } from "./types"

// What fetching posts costs on Apify, per post, at the actors' published rates: about $2 per 1,000
// LinkedIn posts and up to $2.70 per 1,000 Instagram posts. Facebook isn't fetched yet; websites
// are read for free during company research.

export const COST_PER_POST: Record<Source, number> = {
  linkedin: 0.002,
  instagram: 0.0027,
  facebook: 0,
  website: 0,
}

/** The sources Enrich actually fetches. */
export const FETCHED_SOURCES = ["linkedin", "instagram"] as const

export function costPerLeadForSource(source: Source, postsPerLead: number): number {
  return COST_PER_POST[source] * postsPerLead
}
