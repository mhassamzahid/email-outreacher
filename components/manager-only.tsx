"use client"

import { cloneElement, type ReactElement } from "react"
import { useAuth } from "@/lib/auth"
import { MANAGERS_ONLY_HINT, canManage } from "@/lib/roles"

/** A Management-only button: for Sales it's disabled, and hovering says why (the backend refuses it anyway). */
export function ManagerOnly({ children }: { children: ReactElement<{ disabled?: boolean }> }) {
  const { me } = useAuth()
  if (canManage(me?.role)) return children
  return (
    <span title={MANAGERS_ONLY_HINT} className="inline-flex">
      {cloneElement(children, { disabled: true })}
    </span>
  )
}
