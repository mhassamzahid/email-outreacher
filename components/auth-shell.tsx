import type { CSSProperties, ReactNode } from "react"
import { ColdbrewMark } from "@/components/coldbrew-mark"

// The product mark, multiplied: nine open rings, each opening a little further round, and from each
// gap a message leaving. One campaign fanning out to many people. Deterministic geometry, so the
// server and the browser draw the same picture.
const CX = 300
const CY = 300
const RINGS = Array.from({ length: 9 }, (_, i) => {
  const r = 40 + i * 25
  // The gap sweeps round to the upper right, where the mark itself opens; the outermost ring leads.
  const gapCenter = 107 - i * 19 // degrees: 0 = east, -90 = north; the outermost opens at -45
  const gap = 34 - i * 1.6
  return { i, r, gapCenter, gap }
})

const rad = (deg: number) => (deg * Math.PI) / 180
// Rounded: the server and the browser can differ in the last digits of a float.
const round = (n: number) => Math.round(n * 100) / 100
const point = (r: number, deg: number) => [round(CX + r * Math.cos(rad(deg))), round(CY + r * Math.sin(rad(deg)))] as const

function ringPath(r: number, gapCenter: number, gap: number) {
  const [x1, y1] = point(r, gapCenter + gap / 2)
  const [x2, y2] = point(r, gapCenter + 360 - gap / 2)
  return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`
}

function Field() {
  return (
    <svg viewBox="0 0 600 600" className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      {/* Faint compass ticks: the field is measured, not decorative noise. */}
      {Array.from({ length: 72 }, (_, k) => {
        const deg = k * 5
        const long = k % 6 === 0
        const [x1, y1] = point(292, deg)
        const [x2, y2] = point(long ? 274 : 283, deg)
        return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} className="login-tick" />
      })}
      {RINGS.map(({ i, r, gapCenter, gap }) => {
        const [dx, dy] = point(r + 12 + i * 2.2, gapCenter)
        const lead = i === RINGS.length - 1
        return (
          <g key={i} style={{ "--i": i } as CSSProperties}>
            <path
              d={ringPath(r, gapCenter, gap)}
              pathLength={1}
              className="login-ring"
              strokeWidth={round(3.2 - i * 0.22)}
              style={{ opacity: round(0.95 - i * 0.075) }}
            />
            <circle cx={dx} cy={dy} r={lead ? 7 : round(4.2 - i * 0.18)} className={lead ? "login-dot login-dot-lead" : "login-dot"} />
          </g>
        )
      })}
    </svg>
  )
}

/** The frame for signing in and resetting a password: the ring field beside a quiet form. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh grid-rows-[auto_1fr] bg-background lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-1">
      <section className="login-panel relative isolate flex h-56 flex-col justify-between overflow-hidden px-6 py-6 sm:h-72 lg:h-auto lg:px-12 lg:py-12">
        <div className="absolute inset-0 -z-10 lg:-right-24 lg:left-auto lg:w-[130%]">
          <Field />
        </div>
        {/* Lets the headline sit on the field without a box. */}
        <div className="absolute inset-x-0 bottom-0 -z-[5] hidden h-1/2 bg-gradient-to-t from-[var(--login-panel)] via-[var(--login-panel)]/70 to-transparent lg:block" />

        <div className="flex items-center gap-2.5">
          <ColdbrewMark className="size-7" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Coldbrew</span>
        </div>
        <p className="hidden max-w-[18ch] text-[44px] leading-[1.05] font-medium tracking-[-0.03em] text-balance lg:block">
          One message, written for each person.
        </p>
      </section>
      <section className="flex items-start justify-center px-6 py-10 sm:items-center lg:px-12">
        <div className="w-full max-w-[360px]">{children}</div>
      </section>
    </main>
  )
}
