"use client"

import { type NumberField, NumberSettings } from "@/components/settings/number-settings"
import { type ResearchSettings as Limits, fetchResearchSettings, saveResearchSettings } from "@/lib/api"

const FIELDS: NumberField<keyof Limits>[] = [
  {
    key: "researchMaxPages",
    label: "Most pages per company",
    hint: "Homepage included. Claude reads one page at a time and stops sooner when it has enough. 1 reads the homepage only.",
    min: 1,
    max: 15,
  },
  {
    key: "researchMaxSeconds",
    label: "Most seconds per company",
    hint: "Reading stops after this long, even mid-way. Pages are at least 2 seconds apart, and each Claude step takes a few seconds.",
    min: 30,
    max: 600,
  },
]

/** How much of a company's website research may read. Saved per workspace in the backend. */
export function ResearchSettings() {
  return (
    <NumberSettings
      fields={FIELDS}
      load={fetchResearchSettings}
      save={saveResearchSettings}
      note="Each extra page is one more Claude call, so higher limits cost a little more per company."
      savedMessage="The next research uses these limits."
    />
  )
}
