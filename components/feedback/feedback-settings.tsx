"use client"

import { type NumberField, NumberSettings } from "@/components/settings/number-settings"
import { type FeedbackSettings as Counts, fetchFeedbackSettings, saveFeedbackSettings } from "@/lib/api"

const FIELDS: NumberField<keyof Counts>[] = [
  {
    key: "sampleExamples",
    label: "Example emails per email",
    hint: "The newest emails from the Example emails page for the lead's ICP, shown to Claude as the voice to write in and scored against. 0 turns them off.",
    min: 0,
    max: 10,
  },
  {
    key: "goodExamples",
    label: "Good examples per email",
    hint: "The ICP's latest emails rated good, shown to Claude to write like. 0 turns them off.",
    min: 0,
    max: 10,
  },
  {
    key: "badExamples",
    label: "Bad examples per email",
    hint: "The ICP's latest emails rated bad, with your tags and notes, for Claude to avoid. 0 turns them off.",
    min: 0,
    max: 10,
  },
  {
    key: "improveExamples",
    label: "Rated emails per prompt suggestion",
    hint: "How many of the ICP's rated emails Claude reads when you ask it to improve the email prompt.",
    min: 3,
    max: 50,
  },
]

/** How many rated emails Claude learns from. Saved per workspace in the backend. */
export function FeedbackSettings() {
  return (
    <NumberSettings
      fields={FIELDS}
      load={fetchFeedbackSettings}
      save={saveFeedbackSettings}
      note="More examples give Claude more to go on, but make each email cost more to write: every example adds a few hundred tokens."
      savedMessage="New emails use these counts from now on."
    />
  )
}
