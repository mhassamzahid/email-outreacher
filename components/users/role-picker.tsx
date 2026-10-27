"use client"

import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles"
import { ROLES, type Role } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Three role cards in a radio group: the label and one line on what the role can do. */
export function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: Role
  onChange: (role: Role) => void
  disabled?: (role: Role) => string | undefined
}) {
  return (
    <div role="radiogroup" aria-label="Role" className="grid gap-2">
      {ROLES.map((role) => {
        const reason = disabled?.(role)
        const checked = value === role
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={!!reason}
            title={reason}
            onClick={() => onChange(role)}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              checked ? "border-data bg-data/5" : "hover:bg-muted/60",
              reason && "cursor-not-allowed opacity-50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4 flex-none items-center justify-center rounded-full border",
                checked && "border-data",
              )}
            >
              {checked && <span className="size-2 rounded-full bg-data" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{ROLE_LABEL[role]}</span>
              <span className="block text-[13px] text-muted-foreground">{reason ?? ROLE_DESCRIPTION[role]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
