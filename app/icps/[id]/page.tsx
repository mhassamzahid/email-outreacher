"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BasicsFields, MessagingFields, SourcesFields, TargetingFields, toDraft, type IcpDraft } from "@/components/icp-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useIcpParam } from "@/hooks/use-icp"
import { useStore } from "@/lib/store"
import type { ICP } from "@/lib/types"

export default function DefinitionPage() {
  const icp = useIcpParam()
  if (!icp) return null
  return <DefinitionForm key={icp.id} icp={icp} />
}

function DefinitionForm({ icp }: { icp: ICP }) {
  const { updateIcp, settings } = useStore()
  const [draft, setDraft] = useState<IcpDraft>(() => toDraft(icp))
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(icp))

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const set = <K extends keyof IcpDraft>(key: K, value: IcpDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const save = () => {
    if (!draft.name.trim()) {
      toast.error("Give the ICP a name before saving")
      return
    }
    updateIcp(icp.id, draft)
    toast.success("ICP saved")
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 -mt-6 flex items-center gap-2 border-b bg-background px-4 py-2.5 md:-mx-8 md:px-8">
        {dirty ? (
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
            Unsaved changes
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">All changes saved</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={!dirty} onClick={() => setDraft(toDraft(icp))}>
            Discard
          </Button>
          <Button disabled={!dirty} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
            </CardHeader>
            <CardContent>
              <BasicsFields draft={draft} set={set} nameError={draft.name.trim() ? "" : "Give the ICP a name."} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Targeting</CardTitle>
              <CardDescription>Who this ICP covers.</CardDescription>
            </CardHeader>
            <CardContent>
              <TargetingFields draft={draft} set={set} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Messaging</CardTitle>
              <CardDescription>Available in prompts as {"{{icp.pains}}"}, {"{{icp.offer}}"} and so on.</CardDescription>
            </CardHeader>
            <CardContent>
              <MessagingFields draft={draft} set={set} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-16">
          <CardHeader>
            <CardTitle>Enrichment sources</CardTitle>
            <CardDescription>Estimated cost per lead.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourcesFields draft={draft} set={set} postsPerLead={settings.postsPerLead} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
