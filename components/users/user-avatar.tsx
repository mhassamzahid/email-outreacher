import { initials } from "@/lib/roles"
import { cn } from "@/lib/utils"

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 flex-none items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
