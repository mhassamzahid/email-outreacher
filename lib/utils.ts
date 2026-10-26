type ClassValue = string | number | null | undefined | false | ClassValue[] | Record<string, unknown>

// Minimal class joiner. Swap for the `cn` package (clsx + tailwind-merge) once approved,
// so conflicting Tailwind classes passed via className override component defaults reliably.
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = []
  const walk = (v: ClassValue) => {
    if (!v) return
    if (typeof v === "string" || typeof v === "number") out.push(String(v))
    else if (Array.isArray(v)) v.forEach(walk)
    else for (const [k, on] of Object.entries(v)) if (on) out.push(k)
  }
  inputs.forEach(walk)
  return out.join(" ")
}
