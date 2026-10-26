import { useEffect, useState } from "react"
import { load } from "@/lib/mock-actions"

/** True for a short moment after mount, so pages can show their skeleton state. */
export function useMockLoading(ms = 450): boolean {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    load(null, ms).then(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [ms])
  return loading
}
