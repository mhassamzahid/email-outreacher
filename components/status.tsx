import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  FLAG_LABEL,
  GENERATION_STATUS_LABEL,
  LEAD_STATUS_COLOR,
  LEAD_STATUS_LABEL,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import type { GenerationFlag, GenerationStatus, LeadStatus } from "@/lib/types"
import { LEAD_STATUSES } from "@/lib/types"

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={cn("size-1.5 rounded-full", LEAD_STATUS_COLOR[status], status === "enriching" && "animate-pulse")} />
      {LEAD_STATUS_LABEL[status]}
    </Badge>
  )
}

const GEN_STYLE: Record<GenerationStatus, string> = {
  draft: "",
  edited: "border-sky-500/40 text-sky-700 dark:text-sky-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  skipped: "border-amber-500/40 text-amber-700 dark:text-amber-300",
}

export function GenerationStatusBadge({ status }: { status: GenerationStatus }) {
  return (
    <Badge variant="outline" className={cn("font-normal", GEN_STYLE[status])}>
      {GENERATION_STATUS_LABEL[status]}
    </Badge>
  )
}

export function StatusBar({ counts, className }: { counts: Record<LeadStatus, number>; className?: string }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return <div className={cn("h-2 rounded-full bg-muted", className)} />
  return (
    <div className={cn("flex h-2 overflow-hidden rounded-full bg-muted", className)}>
      {LEAD_STATUSES.filter((s) => counts[s] > 0).map((s) => (
        <Tooltip key={s}>
          <TooltipTrigger asChild>
            <div className={cn("h-full", LEAD_STATUS_COLOR[s])} style={{ width: `${(counts[s] / total) * 100}%` }} />
          </TooltipTrigger>
          <TooltipContent>
            {LEAD_STATUS_LABEL[s]}: {counts[s]}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

export function ConfidenceBadge({ value }: { value: number }) {
  const tone =
    value >= 75
      ? "text-emerald-700 dark:text-emerald-300"
      : value >= 60
        ? "text-foreground"
        : "text-amber-700 dark:text-amber-300"
  return <span className={cn("font-mono text-xs tabular-nums", tone)}>{value}</span>
}

export function RelevanceDots({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Relevance ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cn("size-1.5 rounded-full", n <= value ? "bg-foreground/70" : "bg-muted-foreground/25")} />
      ))}
    </span>
  )
}

export function FlagBadges({ flags }: { flags: GenerationFlag[] }) {
  if (flags.length === 0) return <span className="text-xs text-muted-foreground">None</span>
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge
          key={f}
          variant="outline"
          className={cn(
            "font-normal",
            f === "sensitive_topic"
              ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
              : "border-amber-500/40 text-amber-700 dark:text-amber-300",
          )}
        >
          {FLAG_LABEL[f]}
        </Badge>
      ))}
    </div>
  )
}

export function NoHookBadge() {
  return (
    <Badge variant="secondary" className="font-normal">
      No hook
    </Badge>
  )
}
