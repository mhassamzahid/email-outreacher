import { cn } from "@/lib/utils"

/** The Coldbrew mark: ripples spreading from one centre, and one message leaving them. Its colours
 *  follow the theme (--logo-* in globals.css). app/icon.svg is the same drawing for the browser tab. */
export function ColdbrewMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-6 shrink-0", className)} aria-hidden>
      <circle cx="32" cy="32" r="30" fill="var(--logo-disc)" />
      <path d="M44.6 25.5 A14 14 0 1 1 39 19.9" fill="none" stroke="var(--logo-ring)" strokeWidth="3.6" strokeLinecap="round" />
      <path
        d="M51.3 21.5 A22 22 0 1 1 44.2 13.4"
        fill="none"
        stroke="var(--logo-ring-outer)"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".6"
      />
      <circle cx="32" cy="32" r="5" fill="var(--logo-centre)" />
      <circle cx="50" cy="14" r="4.5" fill="var(--logo-dot)" />
    </svg>
  )
}
