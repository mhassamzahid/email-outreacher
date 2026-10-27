import { Globe } from "lucide-react"
import { SOURCE_LABEL } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Source } from "@/lib/types"

// One neutral glyph set: the source is identity, not data, so it stays grey.
const GLYPH: Record<Exclude<Source, "website">, string> = {
  linkedin: "in",
  instagram: "ig",
  facebook: "f",
}

export function SourceIcon({ source, className }: { source: Source; className?: string }) {
  return (
    <span
      title={SOURCE_LABEL[source]}
      aria-label={SOURCE_LABEL[source]}
      className={cn(
        "inline-flex size-[18px] flex-none items-center justify-center rounded-[4px] bg-pill-neutral text-[10px] leading-none font-semibold text-pill-neutral-ink",
        className,
      )}
    >
      {source === "website" ? <Globe className="size-3" /> : GLYPH[source]}
    </span>
  )
}

export function SourceIcons({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return <span className="text-muted-foreground">–</span>
  return (
    <span className="inline-flex gap-1">
      {sources.map((s) => (
        <SourceIcon key={s} source={s} />
      ))}
    </span>
  )
}
