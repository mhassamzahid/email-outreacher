"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Plus, Target } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { StatusBar } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useMockLoading } from "@/hooks/use-mock-loading"
import { statusCounts } from "@/lib/selectors"
import { useStore } from "@/lib/store"

export default function IcpsPage() {
  const { icps, leads, createIcp } = useStore()
  const loading = useMockLoading()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const create = () => {
    const icp = createIcp(name.trim(), description.trim())
    setOpen(false)
    setName("")
    setDescription("")
    toast.success(`Created ${icp.name}`)
    router.push(`/icps/${icp.id}`)
  }

  const newButton = (
    <Button onClick={() => setOpen(true)}>
      <Plus /> New ICP
    </Button>
  )

  return (
    <>
      <PageHeader title="ICPs" description="Who you sell to, how you talk to them, and their leads" actions={newButton} />
      <div className="p-4 md:p-6">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : icps.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No ICPs yet"
            description="Create an ICP to define who you are targeting, then import leads into it."
            action={newButton}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {icps.map((icp) => {
              const icpLeads = leads.filter((l) => l.icpId === icp.id)
              const counts = statusCounts(icpLeads)
              const enriched = icpLeads.length - counts.imported - counts.enriching - counts.failed - counts.no_content
              const generated = counts.generated + counts.approved + counts.skipped
              const stats = [
                ["Leads", icpLeads.length],
                ["Enriched", enriched],
                ["Generated", generated],
                ["Approved", counts.approved],
              ] as const
              return (
                <Link key={icp.id} href={`/icps/${icp.id}`} className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <Card className="h-full transition-colors group-hover:border-foreground/20">
                    <CardHeader>
                      <CardTitle className="truncate">{icp.name}</CardTitle>
                      <CardDescription className="line-clamp-2 min-h-10">
                        {icp.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <dl className="grid grid-cols-4 gap-2">
                        {stats.map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <StatusBar counts={counts} />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New ICP</DialogTitle>
            <DialogDescription>You can fill in targeting and messaging on the next screen.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) create()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="icp-name">Name</Label>
              <Input id="icp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DTC skincare founders" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="icp-desc">Description</Label>
              <Textarea id="icp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                Create ICP
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
