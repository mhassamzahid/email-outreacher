import { useParams } from "next/navigation"
import { useStore } from "@/lib/store"

/** The ICP from the current /icps/[id] route, if it exists. */
export function useIcpParam() {
  const { id } = useParams<{ id: string }>()
  const { icps } = useStore()
  return icps.find((i) => i.id === id)
}
