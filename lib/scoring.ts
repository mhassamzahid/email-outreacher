import { FLAG_LABEL } from "./format"
import type { Generation, GenerationFlag, ScoringSettings } from "./types"

// Real routing rules (not mock): whether a scored draft is sent automatically or waits for a person.

export const COST_PER_SCORE = 0.002

export interface SendDecision {
  send: boolean
  /** One sentence for the review panel and the queue. */
  reason: string
}

/** Auto-sent emails dated today, for the daily cap. */
export function autoSentToday(generations: Generation[], now = new Date()): number {
  const today = now.toISOString().slice(0, 10)
  return generations.filter((g) => g.sentBy === "auto" && g.sentAt?.slice(0, 10) === today).length
}

export function sendDecision(
  score: number | null,
  flags: GenerationFlag[],
  settings: ScoringSettings,
  sentToday: number,
): SendDecision {
  if (score === null) return { send: false, reason: "Not scored yet, so a person reviews it." }
  if (score < settings.threshold)
    return { send: false, reason: `Score ${score} is below the auto-send threshold of ${settings.threshold}.` }
  if (flags.length > 0)
    return {
      send: false,
      reason: `Score ${score} clears the threshold, but flagged drafts (${flags.map((f) => FLAG_LABEL[f].toLowerCase()).join(", ")}) always get a human review.`,
    }
  if (!settings.autoSend)
    return { send: false, reason: `Score ${score} clears the threshold of ${settings.threshold}, but auto-send is off.` }
  if (sentToday >= settings.dailyAutoSendCap)
    return { send: false, reason: `Score ${score} clears the threshold, but today's auto-send limit of ${settings.dailyAutoSendCap} is reached.` }
  return { send: true, reason: `Score ${score} is at or above the threshold of ${settings.threshold}, so it was sent automatically.` }
}

/** Score buckets of width 10 for the threshold preview chart. */
export function scoreHistogram(scores: number[]): number[] {
  const bins = new Array(10).fill(0)
  for (const s of scores) bins[Math.min(9, Math.floor(s / 10))]++
  return bins
}
