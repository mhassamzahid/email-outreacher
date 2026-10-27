"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronRight, Circle, Upload } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  BasicsFields,
  MESSAGING_FIELDS,
  MessagingFields,
  SourcesFields,
  TargetingFields,
  costPerLead,
  emptyDraft,
  toDraft,
  type IcpDraft,
} from "@/components/icp-form"
import { PageHeader } from "@/components/page-header"
import { SourceIcon } from "@/components/source-icon"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SOURCE_LABEL, formatUsd } from "@/lib/format"
import { resolveTemplate } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { PromptKind } from "@/lib/types"

const STEPS = [
  { key: "basics", label: "Basics", description: "Name it, and start blank or from an ICP you already have." },
  { key: "targeting", label: "Targeting", description: "Who these leads are. Used to frame each email and choose hooks." },
  { key: "messaging", label: "Messaging", description: "What you say and how. Every field is available to the prompts." },
  { key: "setup", label: "Sources and prompts", description: "Where to look for hooks, and which prompts write the emails." },
  { key: "review", label: "Review", description: "Check everything before creating. All of it can be changed later." },
] as const

const DEFAULT = "__default__"

export default function NewIcpPage() {
  const { icps, templates, settings, createIcp } = useStore()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<IcpDraft>(emptyDraft)
  const [prompts, setPrompts] = useState<{ hookPromptId: string | null; emailPromptId: string | null }>({
    hookPromptId: null,
    emailPromptId: null,
  })
  const [source, setSource] = useState<string>("blank")
  const [nameTouched, setNameTouched] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [created, setCreated] = useState(false)

  const set = <K extends keyof IcpDraft>(key: K, value: IcpDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const nameError = draft.name.trim() ? "" : "Give the ICP a name to continue."
  const dirty = !created && (JSON.stringify(draft) !== JSON.stringify(emptyDraft()) || source !== "blank")

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const chooseSource = (value: string) => {
    setSource(value)
    const from = icps.find((i) => i.id === value)
    const base = from ? toDraft(from) : emptyDraft()
    setDraft((d) => ({ ...base, name: d.name, description: d.description }))
    setPrompts(from ? { hookPromptId: from.hookPromptId, emailPromptId: from.emailPromptId } : { hookPromptId: null, emailPromptId: null })
  }

  const go = (to: number) => {
    if (to > 0 && nameError) {
      setNameTouched(true)
      setStep(0)
      return
    }
    setStep(Math.max(0, Math.min(STEPS.length - 1, to)))
    window.scrollTo({ top: 0 })
  }

  const create = (then: "leads" | "import") => {
    if (nameError) return go(0)
    const icp = createIcp({ ...draft, ...prompts })
    setCreated(true)
    toast.success(`Created ${icp.name}`, {
      description: then === "import" ? "Map your CSV columns next." : "Add leads to start enriching.",
    })
    router.push(`/icps/${icp.id}/${then}`)
  }

  const missingCore = MESSAGING_FIELDS.filter((f) => f.core && !draft[f.key].trim())
  const current = STEPS[step]

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
          title={draft.name.trim() || "New ICP"}
          description="Define who you're targeting and how you talk to them. Everything can be changed later."
          actions={
            <Button variant="ghost" onClick={() => (dirty ? setConfirmLeave(true) : router.push("/icps"))}>
              Cancel
            </Button>
          }
        />
      </div>

      <div className="px-4 pb-10 md:px-8">
        <ol className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Steps">
          {STEPS.map((s, i) => {
            const done = i < step
            const active = i === step
            const reachable = i === 0 || !nameError
            return (
              <li key={s.key} className="flex-none">
                <button
                  type="button"
                  onClick={() => reachable && go(i)}
                  disabled={!reachable}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[13px] whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                    active ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                      active ? "bg-background text-foreground" : done ? "bg-data text-white dark:text-black" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            )
          })}
        </ol>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <CardHeader>
              <CardTitle>{current.label}</CardTitle>
              <CardDescription>{current.description}</CardDescription>
            </CardHeader>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                if (step < STEPS.length - 1) go(step + 1)
              }}
            >
              <CardContent className="min-h-72">
                {current.key === "basics" && (
                  <div className="space-y-6">
                    <BasicsFields
                      draft={draft}
                      set={set}
                      autoFocus
                      nameError={nameTouched ? nameError : ""}
                      onNameBlur={() => setNameTouched(true)}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="start-from">Start from</Label>
                      <Select value={source} onValueChange={chooseSource}>
                        <SelectTrigger id="start-from" className="w-full!">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blank">A blank ICP</SelectItem>
                          {icps.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              A copy of {i.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {source === "blank"
                          ? "You'll fill in targeting and messaging in the next steps."
                          : "Targeting, messaging, sources and prompts are copied. Leads are not. Edit anything in the next steps."}
                      </p>
                    </div>
                  </div>
                )}
                {current.key === "targeting" && <TargetingFields draft={draft} set={set} suggestions />}
                {current.key === "messaging" && <MessagingFields draft={draft} set={set} />}
                {current.key === "setup" && (
                  <div className="grid gap-8 md:grid-cols-2">
                    <section className="space-y-3">
                      <h3 className="text-sm font-medium">Enrichment sources</h3>
                      <SourcesFields draft={draft} set={set} postsPerLead={settings.postsPerLead} />
                    </section>
                    <section className="space-y-5">
                      <h3 className="text-sm font-medium">Prompts</h3>
                      {(["hook", "email"] as PromptKind[]).map((kind) => {
                        const field = kind === "hook" ? "hookPromptId" : "emailPromptId"
                        const options = templates.filter((t) => t.kind === kind)
                        const fallback = options.find((t) => t.isDefault)
                        return (
                          <div key={kind} className="space-y-1.5">
                            <Label htmlFor={`prompt-${kind}`}>{kind === "hook" ? "Hook selection" : "Email writing"}</Label>
                            <Select
                              value={prompts[field] ?? DEFAULT}
                              onValueChange={(v) => setPrompts((p) => ({ ...p, [field]: v === DEFAULT ? null : v }))}
                            >
                              <SelectTrigger id={`prompt-${kind}`} className="w-full!">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={DEFAULT}>Use default ({fallback?.name})</SelectItem>
                                {options.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {kind === "hook"
                                ? "Picks the best post or page to open with, or none."
                                : "Writes the subject and body from the ICP, the lead and the hook."}
                            </p>
                          </div>
                        )
                      })}
                    </section>
                  </div>
                )}
                {current.key === "review" && (
                  <div className="space-y-5">
                    {missingCore.length > 0 && (
                      <p className="flex items-start gap-2 rounded-lg bg-pill-warning p-3 text-sm text-pill-warning-ink">
                        <AlertTriangle className="mt-0.5 size-4 flex-none" />
                        {missingCore.map((f) => f.label).join(", ")} {missingCore.length === 1 ? "is" : "are"} empty. Emails
                        will be more generic without {missingCore.length === 1 ? "it" : "them"}. You can create the ICP now and
                        fill {missingCore.length === 1 ? "it" : "them"} in later.
                      </p>
                    )}
                    <ReviewSection title="Basics" onEdit={() => go(0)}>
                      <Row label="Name">{draft.name}</Row>
                      <Row label="Description">{draft.description}</Row>
                      <Row label="Started from">
                        {source === "blank" ? "A blank ICP" : `A copy of ${icps.find((i) => i.id === source)?.name}`}
                      </Row>
                    </ReviewSection>
                    <ReviewSection title="Targeting" onEdit={() => go(1)}>
                      <Row label="Job titles">{draft.titles.join(", ")}</Row>
                      <Row label="Industries">{draft.industries.join(", ")}</Row>
                      <Row label="Company size">{draft.companySize}</Row>
                      <Row label="Locations">{draft.locations.join(", ")}</Row>
                    </ReviewSection>
                    <ReviewSection title="Messaging" onEdit={() => go(2)}>
                      {MESSAGING_FIELDS.filter((f) => f.key !== "exampleEmail").map((f) => (
                        <Row key={f.key} label={f.label}>
                          {draft[f.key]}
                        </Row>
                      ))}
                      <Row label="Example email">
                        {draft.exampleEmail.trim() ? `${draft.exampleEmail.trim().split(/\s+/).length} words` : ""}
                      </Row>
                    </ReviewSection>
                    <ReviewSection title="Sources and prompts" onEdit={() => go(3)}>
                      <Row label="Sources">
                        {draft.enabledSources.length ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {draft.enabledSources.map((s) => (
                              <span key={s} className="inline-flex items-center gap-1">
                                <SourceIcon source={s} /> {SOURCE_LABEL[s]}
                              </span>
                            ))}
                          </span>
                        ) : (
                          ""
                        )}
                      </Row>
                      <Row label="Cost per lead">
                        Up to {formatUsd(costPerLead(draft, settings.postsPerLead))}
                      </Row>
                      <Row label="Hook prompt">{resolveTemplate(templates, prompts, "hook")?.name}</Row>
                      <Row label="Email prompt">{resolveTemplate(templates, prompts, "email")?.name}</Row>
                    </ReviewSection>
                  </div>
                )}
              </CardContent>
              <CardFooter className="mt-6 flex flex-wrap justify-between gap-2 border-t pt-5">
                <Button type="button" variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
                  <ArrowLeft /> Back
                </Button>
                {current.key === "review" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => create("import")}>
                      <Upload /> Create and import CSV
                    </Button>
                    <Button type="button" onClick={() => create("leads")}>
                      <Check /> Create ICP
                    </Button>
                  </div>
                ) : (
                  <Button type="submit">
                    Continue to {STEPS[step + 1].label.toLowerCase()} <ArrowRight />
                  </Button>
                )}
              </CardFooter>
            </form>
          </Card>

          <Summary draft={draft} prompts={prompts} postsPerLead={settings.postsPerLead} onJump={go} nameMissing={!!nameError} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        destructive
        title="Discard this ICP?"
        description="Nothing has been created yet. Everything you've entered on this page will be lost."
        confirmLabel="Discard ICP"
        onConfirm={() => {
          setCreated(true)
          router.push("/icps")
        }}
      />
    </>
  )
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-lg border">
      <header className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </header>
      <dl className="divide-y divide-rule">{children}</dl>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === "" || children === undefined || children === null
  return (
    <div className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words whitespace-pre-line", empty && "text-muted-foreground")}>{empty ? "–" : children}</dd>
    </div>
  )
}

/** Live summary beside the form: what is filled in, what it will cost, and a way to jump back. */
function Summary({
  draft,
  prompts,
  postsPerLead,
  onJump,
  nameMissing,
}: {
  draft: IcpDraft
  prompts: { hookPromptId: string | null; emailPromptId: string | null }
  postsPerLead: number
  onJump: (step: number) => void
  nameMissing: boolean
}) {
  const { templates } = useStore()
  const targeting = [
    draft.titles.length && `${draft.titles.length} title${draft.titles.length === 1 ? "" : "s"}`,
    draft.industries.length && `${draft.industries.length} industr${draft.industries.length === 1 ? "y" : "ies"}`,
    draft.companySize && `${draft.companySize} employees`,
    draft.locations.length && `${draft.locations.length} location${draft.locations.length === 1 ? "" : "s"}`,
  ].filter(Boolean)
  const filled = MESSAGING_FIELDS.filter((f) => draft[f.key].trim()).length

  const item = (done: boolean, label: string, detail: string, step: number) => (
    <li>
      <button
        type="button"
        onClick={() => onJump(step)}
        disabled={nameMissing && step > 0}
        className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent"
      >
        {done ? (
          <Check className="mt-0.5 size-4 flex-none text-data" aria-label="Done" />
        ) : (
          <Circle className="mt-0.5 size-4 flex-none text-muted-foreground/50" aria-label="Not done" />
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
      </button>
    </li>
  )

  return (
    <Card className="lg:sticky lg:top-4" size="sm">
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="-mx-2 space-y-0.5">
          {item(!nameMissing, "Name", draft.name.trim() || "Not set", 0)}
          {item(targeting.length > 0, "Targeting", targeting.join(" · ") || "Nothing yet", 1)}
          {item(
            MESSAGING_FIELDS.filter((f) => f.core).every((f) => draft[f.key].trim()),
            "Messaging",
            `${filled} of ${MESSAGING_FIELDS.length} fields`,
            2,
          )}
          {item(
            draft.enabledSources.length > 0,
            "Sources",
            draft.enabledSources.map((s) => SOURCE_LABEL[s]).join(", ") || "None, so no hooks",
            3,
          )}
          {item(
            true,
            "Prompts",
            `${resolveTemplate(templates, prompts, "hook")?.name} · ${resolveTemplate(templates, prompts, "email")?.name}`,
            3,
          )}
        </ul>
        <div className="rounded-lg bg-muted/60 px-3 py-2.5">
          <div className="text-xs text-muted-foreground">Enrichment, per lead</div>
          <div className="text-xl tabular-nums">Up to {formatUsd(costPerLead(draft, postsPerLead))}</div>
          <div className="text-xs text-muted-foreground">at {postsPerLead} posts per source</div>
        </div>
      </CardContent>
    </Card>
  )
}
