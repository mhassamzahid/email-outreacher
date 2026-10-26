"use client"

import { useLayoutEffect, type Ref, type RefObject } from "react"
import { isKnownVariable } from "@/lib/templating"
import { cn } from "@/lib/utils"
import type { PromptKind } from "@/lib/types"

// A textarea layered over a highlighted copy of its text. Both share the exact same box and
// typography, and the textarea grows with its content, so the two never scroll out of sync.
const SHARED = "px-3 py-2.5 font-mono text-[13px] leading-6 whitespace-pre-wrap break-words"

function highlight(text: string, kind: PromptKind) {
  const parts = text.split(/(\{\{\s*[a-zA-Z0-9_.]+\s*\}\})/g)
  return parts.map((part, i) => {
    const match = /^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/.exec(part)
    if (!match) return part
    const known = isKnownVariable(match[1], kind)
    return (
      <span
        key={i}
        className={cn(
          "rounded-sm",
          known
            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
            : "bg-red-500/15 text-red-700 underline decoration-wavy dark:text-red-300",
        )}
      >
        {part}
      </span>
    )
  })
}

export function HighlightedEditor({
  id,
  value,
  onChange,
  kind,
  textareaRef,
  onFocus,
  minHeight = 96,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  kind: PromptKind
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onFocus?: () => void
  minHeight?: number
}) {
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`
  }, [value, minHeight, textareaRef])

  return (
    <div className="relative rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <div aria-hidden className={cn(SHARED, "pointer-events-none absolute inset-0 overflow-hidden text-foreground")}>
        {highlight(value, kind)}
        {"\n"}
      </div>
      <textarea
        id={id}
        ref={textareaRef as Ref<HTMLTextAreaElement>}
        value={value}
        spellCheck={false}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          SHARED,
          "relative block w-full resize-none overflow-hidden bg-transparent text-transparent caret-foreground outline-none selection:bg-sky-500/30",
        )}
      />
    </div>
  )
}
