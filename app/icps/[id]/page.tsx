"use client"

import { useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { SourceIcon } from "@/components/source-icon"
import { TagInput } from "@/components/tag-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useIcpParam } from "@/hooks/use-icp"
import { SOURCE_LABEL, formatUsd } from "@/lib/format"
import { costPerLeadForSource } from "@/lib/mock-actions"
import { useStore } from "@/lib/store"
import type { ICP } from "@/lib/types"
import { SOURCES } from "@/lib/types"

type Draft = Omit<ICP, "id" | "createdAt" | "updatedAt" | "hookPromptId" | "emailPromptId">

const toDraft = (icp: ICP): Draft => ({
  name: icp.name,
  description: icp.description,
  titles: icp.titles,
  industries: icp.industries,
  companySize: icp.companySize,
  locations: icp.locations,
  pains: icp.pains,
  offer: icp.offer,
  proof: icp.proof,
  cta: icp.cta,
  tone: icp.tone,
  exampleEmail: icp.exampleEmail,
  wordsToAvoid: icp.wordsToAvoid,
  hookGuidance: icp.hookGuidance,
  enabledSources: icp.enabledSources,
})

export default function DefinitionPage() {
  const icp = useIcpParam()
  if (!icp) return null
  return <DefinitionForm key={icp.id} icp={icp} />
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function DefinitionForm({ icp }: { icp: ICP }) {
  const { updateIcp, settings } = useStore()
  const [draft, setDraft] = useState<Draft>(() => toDraft(icp))
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(icp))

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const text = (key: keyof Draft, label: string, rows: number, hint?: string) => (
    <Field id={key} label={label} hint={hint}>
      <Textarea id={key} rows={rows} value={draft[key] as string} onChange={(e) => set(key, e.target.value)} />
    </Field>
  )

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
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:-mt-6 md:px-6">
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
              <CardTitle>Targeting</CardTitle>
              <CardDescription>Who this ICP covers. Press Enter or comma to add a tag.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field id="name" label="Name">
                  <Input id="name" value={draft.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-2">{text("description", "Description", 2)}</div>
              <Field id="titles" label="Job titles">
                <TagInput id="titles" value={draft.titles} onChange={(v) => set("titles", v)} placeholder="Founder, CEO" />
              </Field>
              <Field id="industries" label="Industries">
                <TagInput id="industries" value={draft.industries} onChange={(v) => set("industries", v)} placeholder="B2B SaaS" />
              </Field>
              <Field id="companySize" label="Company size">
                <Input id="companySize" value={draft.companySize} onChange={(e) => set("companySize", e.target.value)} placeholder="10–50" />
              </Field>
              <Field id="locations" label="Locations">
                <TagInput id="locations" value={draft.locations} onChange={(v) => set("locations", v)} placeholder="United States" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Messaging</CardTitle>
              <CardDescription>Available in prompts as {"{{icp.pains}}"}, {"{{icp.offer}}"} and so on.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {text("pains", "Pains", 3)}
              {text("offer", "Offer", 3)}
              {text("proof", "Proof", 3, "Only verified claims. The model is told not to invent facts.")}
              {text("cta", "Call to action", 3)}
              {text("tone", "Tone", 2)}
              {text("wordsToAvoid", "Words to avoid", 2, "Comma separated")}
              <div className="md:col-span-2">{text("hookGuidance", "Hook guidance", 2, "What makes a good or bad hook for this audience")}</div>
              <div className="md:col-span-2">{text("exampleEmail", "Example email", 8)}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-16">
          <CardHeader>
            <CardTitle>Enrichment sources</CardTitle>
            <CardDescription>
              Estimated cost per lead at {settings.postsPerLead} posts per source.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SOURCES.map((s) => {
              const on = draft.enabledSources.includes(s)
              const cost = costPerLeadForSource(s, settings.postsPerLead)
              return (
                <div key={s} className="flex items-center gap-3">
                  <SourceIcon source={s} />
                  <Label htmlFor={`src-${s}`} className="flex-1 font-normal">
                    {SOURCE_LABEL[s]}
                  </Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{cost ? formatUsd(cost) : "Free"}</span>
                  <Switch
                    id={`src-${s}`}
                    checked={on}
                    onCheckedChange={(checked) =>
                      set("enabledSources", checked ? [...draft.enabledSources, s] : draft.enabledSources.filter((x) => x !== s))
                    }
                  />
                </div>
              )
            })}
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Up to{" "}
              <b className="text-foreground tabular-nums">
                {formatUsd(draft.enabledSources.reduce((sum, s) => sum + costPerLeadForSource(s, settings.postsPerLead), 0))}
              </b>{" "}
              per lead when every enabled source has a URL.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
