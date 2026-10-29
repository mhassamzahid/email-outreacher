import type { Settings } from "./types"

// Starting values for what isn't stored in the backend yet: the browser-side settings.

export const DEFAULT_SETTINGS: Settings = {
  defaultModel: "claude-haiku-5-5",
  postsPerLead: 5,
  maxPostAgeDays: 60,
  monthlyBudgetUsd: 150,
  scoring: { promptId: null, threshold: 80, autoSend: false, dailyAutoSendCap: 50 },
}
