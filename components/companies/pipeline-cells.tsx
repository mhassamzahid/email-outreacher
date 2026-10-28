import { Pill, type PillTone } from "@/components/status"
import type { PipelineStatus } from "@/lib/api"

const STATUS: Record<PipelineStatus, { label: string; tone: PillTone }> = {
  found: { label: "To research", tone: "neutral" },
  qualified: { label: "Qualified", tone: "positive" },
  not_fit: { label: "Not a fit", tone: "negative" },
  error: { label: "Couldn't finish", tone: "warning" },
}

export function StatusPill({ status }: { status: PipelineStatus }) {
  const s = STATUS[status]
  return <Pill tone={s.tone}>{s.label}</Pill>
}

export function SourcePill({ source }: { source: "lead_intel" | "apollo" }) {
  return <Pill tone={source === "lead_intel" ? "info" : "neutral"}>{source === "lead_intel" ? "Lead Intel" : "Apollo"}</Pill>
}
