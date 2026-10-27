"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { ICP_SOURCE_LABELS, SUGGESTIONS } from "@/components/icp-form"
import { PageHeader } from "@/components/page-header"
import { TagInput } from "@/components/tag-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { IcpCreate } from "@/lib/api"
import { useStore } from "@/lib/store"
import type { IcpSource } from "@/lib/types"

const SOURCES = Object.keys(ICP_SOURCE_LABELS) as IcpSource[]

const EMPTY: IcpCreate = {
  name: "",
  industry: "",
  priority: 100,
  enabled: true,
  sources: [],
  anyOf: [],
  noneOf: [],
  websiteAnyOf: [],
  instagramAnyOf: [],
  requireAll: false,
  minFollowers: null,
  maxFollowers: null,
  searchTerms: [],
  requiresWebsite: false,
  minReviews: null,
  places: [],
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {(error || hint) && <p className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{error || hint}</p>}
    </div>
  )
}

const toNumber = (value: string) => (value.trim() === "" ? null : Number(value))

/** Add an ICP. It goes into Lead Intel's ICPs (shared by both projects); who to reach stays in this workspace. */
export default function NewIcpPage() {
  const router = useRouter()
  const { icps, createIcp } = useStore()
  const [icp, setIcp] = useState<IcpCreate>(EMPTY)
  const [titles, setTitles] = useState<string[]>(["Owner", "Founder"])
  const [description, setDescription] = useState("")
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState("")

  const set = <K extends keyof IcpCreate>(key: K, value: IcpCreate[K]) => {
    setIcp((d) => ({ ...d, [key]: value }))
    setServerError("")
  }

  const taken = icps.some((i) => i.name.trim().toLowerCase() === icp.name.trim().toLowerCase())
  const errors = {
    name: !icp.name.trim() ? "Give the ICP a name" : taken ? "An ICP with this name already exists" : "",
    industry: !icp.industry.trim() ? "Add the industry, e.g. Printing" : "",
    priority: !Number.isInteger(icp.priority) || icp.priority < 0 ? "Use a whole number, 0 or more" : "",
    followers:
      icp.minFollowers !== null && icp.maxFollowers !== null && icp.minFollowers > icp.maxFollowers
        ? "Fewest followers can't be more than most followers"
        : [icp.minFollowers, icp.maxFollowers].some((n) => n !== null && (!Number.isInteger(n) || n < 0))
          ? "Use whole numbers, 0 or more"
          : "",
    reviews: icp.minReviews !== null && (!Number.isInteger(icp.minReviews) || icp.minReviews < 0) ? "Use a whole number, 0 or more" : "",
  }
  const valid = !Object.values(errors).some(Boolean)
  const show = (key: keyof typeof errors) => (touched ? errors[key] : "")

  const submit = async () => {
    setTouched(true)
    if (!valid) return
    setSaving(true)
    try {
      const { icp: created, warning } = await createIcp(icp, { titles, description })
      if (warning) toast.warning(warning)
      else toast.success(`Added ${created.name}`, { description: "It's in Lead Intel too. Lead Intel sorts businesses into it on its next match." })
      router.push(`/icps/${created.id}`)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Couldn't add the ICP.")
      setSaving(false)
    }
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 px-4 pt-5 text-[13px] text-muted-foreground md:px-8 md:pt-6">
        <Link href="/icps" className="hover:text-foreground">
          ICPs
        </Link>
        <ChevronRight className="size-3.5" />
        <span>New ICP</span>
      </nav>
      <div className="-mt-4 md:-mt-5">
        <PageHeader
          title="New ICP"
          description="Added to Lead Intel's ICPs, so both projects see it. Who to reach is saved for this workspace."
          actions={
            <>
              <Button variant="outline" asChild>
                <Link href="/icps">Cancel</Link>
              </Button>
              <Button type="submit" form="new-icp" disabled={saving}>
                {saving ? "Adding…" : "Add ICP"}
              </Button>
            </>
          }
        />
      </div>

      <form
        id="new-icp"
        className="grid gap-4 px-4 pb-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>The ICP</CardTitle>
              <CardDescription>Saved in Lead Intel.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id="icp-name" label="Name it" hint="For you, not the business" error={show("name")}>
                  <Input
                    id="icp-name"
                    value={icp.name}
                    autoFocus
                    onBlur={() => setTouched(true)}
                    onChange={(e) => set("name", e.target.value)}
                    aria-invalid={!!show("name") || undefined}
                  />
                </Field>
              </div>
              <Field id="icp-industry" label="Industry" hint="e.g. Printing" error={show("industry")}>
                <Input
                  id="icp-industry"
                  value={icp.industry}
                  onChange={(e) => set("industry", e.target.value)}
                  aria-invalid={!!show("industry") || undefined}
                />
              </Field>
              <Field id="icp-priority" label="Order" hint="Lower is checked first" error={show("priority")}>
                <Input
                  id="icp-priority"
                  type="number"
                  inputMode="numeric"
                  value={icp.priority}
                  onChange={(e) => set("priority", Number(e.target.value))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field id="icp-search-terms" label="Words to find them on Google Maps" hint="Lead Intel searches with these. Empty means it only matches businesses already in the list.">
                  <TagInput id="icp-search-terms" value={icp.searchTerms} onChange={(v) => set("searchTerms", v)} placeholder="screen printing" />
                </Field>
              </div>
              <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal sm:col-span-2">
                <Switch checked={icp.enabled} onCheckedChange={(v) => set("enabled", v)} />
                Turned on (Lead Intel uses it when sorting businesses)
              </Label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Who to reach</CardTitle>
              <CardDescription>Saved for this workspace, not in Lead Intel. You can add messaging after.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="icp-titles" label="Job titles to reach" hint="Who to email at each company. Used to find stakeholders in Apollo.">
                <TagInput id="icp-titles" value={titles} onChange={setTitles} placeholder="Owner, Founder" />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTIONS.titles
                    .filter((t) => !titles.includes(t))
                    .map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTitles((list) => [...list, t])}
                        className="inline-flex h-6 items-center rounded-full border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        + {t}
                      </button>
                    ))}
                </div>
              </Field>
              <Field id="icp-description" label="Description" hint="For your team. Not sent to the model.">
                <Textarea id="icp-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>How Lead Intel recognises them</CardTitle>
            <CardDescription>The rule Lead Intel uses to put a business in this ICP. Saved in Lead Intel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Read</legend>
              <p className="text-xs text-muted-foreground">Which text to look in. None ticked means all of it.</p>
              <div className="grid gap-2 pt-1 sm:grid-cols-2">
                {SOURCES.map((s) => (
                  <Label key={s} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={icp.sources.includes(s)}
                      onCheckedChange={(v) => set("sources", v === true ? [...icp.sources, s] : icp.sources.filter((x) => x !== s))}
                    />
                    {ICP_SOURCE_LABELS[s]}
                  </Label>
                ))}
              </div>
            </fieldset>
            <Field id="icp-any-of" label="Any of these words" hint="Searched in whatever is ticked above.">
              <TagInput id="icp-any-of" value={icp.anyOf} onChange={(v) => set("anyOf", v)} placeholder="screen print, silkscreen" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="icp-website" label="On their website">
                <TagInput id="icp-website" value={icp.websiteAnyOf} onChange={(v) => set("websiteAnyOf", v)} />
              </Field>
              <Field id="icp-instagram" label="On their Instagram">
                <TagInput id="icp-instagram" value={icp.instagramAnyOf} onChange={(v) => set("instagramAnyOf", v)} />
              </Field>
            </div>
            <Label className="flex cursor-pointer items-start gap-2 text-sm font-normal">
              <Switch className="mt-0.5" checked={icp.requireAll} onCheckedChange={(v) => set("requireAll", v)} />
              <span>
                Every filled-in group must match
                <span className="block text-xs text-muted-foreground">Off: any one group is enough.</span>
              </span>
            </Label>
            <Field id="icp-none-of" label="…but never these words" hint="Checked across everything this rule reads. e.g. equipment, repair, wholesale">
              <TagInput id="icp-none-of" value={icp.noneOf} onChange={(v) => set("noneOf", v)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="icp-min-followers" label="Fewest followers" error={show("followers")}>
                <Input id="icp-min-followers" type="number" inputMode="numeric" value={icp.minFollowers ?? ""} onChange={(e) => set("minFollowers", toNumber(e.target.value))} />
              </Field>
              <Field id="icp-max-followers" label="Most followers">
                <Input id="icp-max-followers" type="number" inputMode="numeric" value={icp.maxFollowers ?? ""} onChange={(e) => set("maxFollowers", toNumber(e.target.value))} />
              </Field>
              <Field id="icp-min-reviews" label="Fewest Google reviews" error={show("reviews")}>
                <Input id="icp-min-reviews" type="number" inputMode="numeric" value={icp.minReviews ?? ""} onChange={(e) => set("minReviews", toNumber(e.target.value))} />
              </Field>
            </div>
            <Field id="icp-places" label="Only in these places" hint="Towns or states. Empty means anywhere.">
              <TagInput id="icp-places" value={icp.places} onChange={(v) => set("places", v)} placeholder="Chicago" />
            </Field>
            <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
              <Switch checked={icp.requiresWebsite} onCheckedChange={(v) => set("requiresWebsite", v)} />
              Must have a website
            </Label>
          </CardContent>
        </Card>

        {serverError && <p className="text-sm text-destructive lg:col-span-2">{serverError}</p>}
      </form>
    </>
  )
}
