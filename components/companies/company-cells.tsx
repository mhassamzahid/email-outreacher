import { SourceIcon } from "@/components/source-icon"
import { Pill, type PillTone } from "@/components/status"
import { compactCount } from "@/lib/format"
import type { Company } from "@/lib/types"

const TIER_TONE: Record<number, PillTone> = { 1: "positive", 2: "info", 3: "neutral", 4: "neutral" }

/** Name with the domain underneath. */
export function CompanyName({ company }: { company: Company }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{company.name}</p>
      <p className="truncate text-[13px] text-muted-foreground">{company.domain ?? "No website"}</p>
    </div>
  )
}

export function Location({ company }: { company: Company }) {
  return <span className="whitespace-nowrap text-muted-foreground">{[company.city, company.state].filter(Boolean).join(", ") || "—"}</span>
}

/** Lead Intel's tier, 1 is best. Unscored companies say so rather than showing a number. */
export function TierPill({ tier }: { tier: number | null }) {
  if (tier === null) return <span className="text-[13px] text-muted-foreground">Not scored</span>
  return <Pill tone={TIER_TONE[tier]}>Tier {tier}</Pill>
}

export function IcpPill({ name }: { name: string | null }) {
  return name ? <Pill>{name}</Pill> : <span className="text-[13px] text-muted-foreground">No ICP matched</span>
}

export function InstagramCell({ company }: { company: Company }) {
  const { handle, followers } = company.instagram
  if (!handle) return <span className="text-[13px] text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <SourceIcon source="instagram" />
      <span className="max-w-32 truncate">@{handle}</span>
      {followers !== null && <span className="text-muted-foreground tabular-nums">{compactCount(followers)}</span>}
    </span>
  )
}
