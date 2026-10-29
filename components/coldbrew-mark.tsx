import { cn } from "@/lib/utils"

/** The Coldbrew mark: an envelope of ice, sealed with a drop of coffee. Same drawing as app/icon.svg (the favicon). */
export function ColdbrewMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-6 shrink-0", className)} aria-hidden>
      <rect width="64" height="64" rx="15" fill="#21160f" />
      <rect x="9" y="16" width="46" height="33" rx="6" fill="#d4f0f8" />
      <path d="M14 21.5 h6" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M11.5 19 L32 35 L52.5 19"
        fill="none"
        stroke="#9fd2e0"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 27.5 C29.6 31.4 26.4 34.6 26.4 38.6 a5.6 5.6 0 0 0 11.2 0 C37.6 34.6 34.4 31.4 32 27.5 Z"
        fill="#7a4a2c"
        stroke="#21160f"
        strokeWidth="2.2"
      />
    </svg>
  )
}
