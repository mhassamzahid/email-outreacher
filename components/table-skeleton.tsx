import { Skeleton } from "@/components/ui/skeleton"

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Skeleton className="h-6 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  )
}
