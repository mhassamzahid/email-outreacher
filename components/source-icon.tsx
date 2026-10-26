import { Globe } from "lucide-react"
import { SOURCE_LABEL } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Source } from "@/lib/types"

const GLYPH: Record<Exclude<Source, "website">, { text: string; className: string }> = {
  linkedin: { text: "in", className: "bg-[#0a66c2] text-white" },
  instagram: { text: "ig", className: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white" },
  facebook: { text: "f", className: "bg-[#1877f2] text-white" },
}

export function SourceIcon({ source, className }: { source: Source; className?: string }) {
  if (source === "website")
    return (
      <span
        title={SOURCE_LABEL.website}
        className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground", className)}
      >
        <Globe className="size-3" />
      </span>
    )
  const g = GLYPH[source]
  return (
    <span
      title={SOURCE_LABEL[source]}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] leading-none font-bold",
        g.className,
        className,
      )}
    >
      {g.text}
    </span>
  )
}

export function SourceIcons({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return <span className="text-xs text-muted-foreground">None</span>
  return (
    <span className="inline-flex gap-1">
      {sources.map((s) => (
        <SourceIcon key={s} source={s} />
      ))}
    </span>
  )
}
