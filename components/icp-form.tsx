"use client"

import type { ReactNode } from "react"
import { Plus } from "lucide-react"
import { SourceIcon } from "@/components/source-icon"
import { TagInput } from "@/components/tag-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { SOURCE_LABEL, formatUsd } from "@/lib/format"
import { costPerLeadForSource } from "@/lib/mock-actions"
import type { ICP } from "@/lib/types"
import { SOURCES } from "@/lib/types"

// Shared by the Definition tab (editing) and the New ICP page (creating), so both stay in step.

export type IcpDraft = Omit<ICP, "id" | "createdAt" | "updatedAt" | "hookPromptId" | "emailPromptId">
export type SetDraft = <K extends keyof IcpDraft>(key: K, value: IcpDraft[K]) => void

export const toDraft = (icp: ICP): IcpDraft => ({
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

export const emptyDraft = (): IcpDraft => ({
  name: "",
  description: "",
  titles: [],
  industries: [],
  companySize: "",
  locations: [],
  pains: "",
  offer: "",
  proof: "",
  cta: "",
  tone: "",
  exampleEmail: "",
  wordsToAvoid: "",
  hookGuidance: "",
  enabledSources: ["linkedin", "website"],
})

/** Messaging fields in the order the email prompt reads them, with how each one is used. */
export const MESSAGING_FIELDS: {
  key: "pains" | "offer" | "proof" | "cta" | "tone" | "wordsToAvoid" | "hookGuidance" | "exampleEmail"
  label: string
  hint: string
  placeholder: string
  rows: number
  wide?: boolean
  core?: boolean
}[] = [
  {
    key: "pains",
    label: "Pains",
    hint: "What keeps them up at night. The email ties the hook to one of these.",
    placeholder: "Rising ad costs, creative fatigue, discounting too deep to hit targets",
    rows: 3,
    core: true,
  },
  {
    key: "offer",
    label: "Offer",
    hint: "What you do for them, in one or two plain sentences.",
    placeholder: "Meta ads and landing page CRO focused on profitable new customers",
    rows: 3,
    core: true,
  },
  {
    key: "proof",
    label: "Proof",
    hint: "Only verified claims. The model is told never to invent results.",
    placeholder: "Who you work with and what you can show on request",
    rows: 3,
  },
  {
    key: "cta",
    label: "Call to action",
    hint: "One low-friction next step the email ends on.",
    placeholder: "Offer a free teardown of their account and top landing page",
    rows: 3,
    core: true,
  },
  {
    key: "tone",
    label: "Tone",
    hint: "How it should sound.",
    placeholder: "Direct, friendly, peer to peer. Plain language.",
    rows: 2,
  },
  {
    key: "wordsToAvoid",
    label: "Words to avoid",
    hint: "Comma separated. Passed to the model as a hard rule.",
    placeholder: "synergy, game-changer, quick question",
    rows: 2,
  },
  {
    key: "hookGuidance",
    label: "Hook guidance",
    hint: "What makes a good or bad opening for this audience. Read by the hook prompt.",
    placeholder: "Good: launches, hiring, posts about growth. Never: personal or sensitive posts.",
    rows: 2,
    wide: true,
  },
  {
    key: "exampleEmail",
    label: "Example email",
    hint: "One email in your voice. The model matches its length and tone, not its words.",
    placeholder: "Hi Sam,\n\n…",
    rows: 7,
    wide: true,
  },
]

export const SUGGESTIONS = {
  titles: ["Founder", "Co-founder", "CEO", "Head of Growth", "Head of Marketing", "Head of Ecommerce", "Marketing Director", "COO"],
  industries: ["Apparel", "Fashion", "Activewear", "Footwear", "Beauty", "B2B SaaS", "Real estate"],
  locations: ["United States", "Canada", "United Kingdom", "Australia"],
}

export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {(error || hint) && (
        <p id={`${id}-note`} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

/** Quick-add chips under a tag input. */
function Suggestions({ options, value, onAdd }: { options: string[]; value: string[]; onAdd: (tag: string) => void }) {
  const left = options.filter((o) => !value.includes(o))
  if (left.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {left.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onAdd(o)}
          className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <Plus className="size-3" /> {o}
        </button>
      ))}
    </div>
  )
}

export function BasicsFields({
  draft,
  set,
  nameError,
  onNameBlur,
  autoFocus,
}: {
  draft: IcpDraft
  set: SetDraft
  nameError?: string
  onNameBlur?: () => void
  autoFocus?: boolean
}) {
  return (
    <div className="grid gap-4">
      <Field id="name" label="Name" error={nameError} hint="Who this is, in a few words. Shown across the app and in prompts as {{icp.name}}.">
        <Input
          id="name"
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          onBlur={onNameBlur}
          placeholder="e.g. US activewear brands on Shopify"
          aria-invalid={!!nameError || undefined}
          aria-describedby="name-note"
          autoFocus={autoFocus}
        />
      </Field>
      <Field id="description" label="Description" hint="For your team. Not sent to the model.">
        <Textarea
          id="description"
          rows={2}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Which companies, what stage, and why they're a fit"
        />
      </Field>
    </div>
  )
}

export function TargetingFields({ draft, set, suggestions }: { draft: IcpDraft; set: SetDraft; suggestions?: boolean }) {
  const tags = (key: "titles" | "industries" | "locations", label: string, placeholder: string, hint: string) => (
    <Field id={key} label={label} hint={hint}>
      <TagInput id={key} value={draft[key]} onChange={(v) => set(key, v)} placeholder={placeholder} />
      {suggestions && (
        <Suggestions options={SUGGESTIONS[key]} value={draft[key]} onAdd={(t) => set(key, [...draft[key], t])} />
      )}
    </Field>
  )
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {tags("titles", "Job titles", "Founder, CEO", "Who you write to. Enter or comma adds a tag.")}
      {tags("industries", "Industries", "Apparel", "Used to frame the email and pick hooks.")}
      <Field id="companySize" label="Company size" hint="Employees, as a range.">
        <Input
          id="companySize"
          value={draft.companySize}
          onChange={(e) => set("companySize", e.target.value)}
          placeholder="10–50"
        />
      </Field>
      {tags("locations", "Locations", "United States", "Countries, states or cities.")}
    </div>
  )
}

export function MessagingFields({ draft, set }: { draft: IcpDraft; set: SetDraft }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {MESSAGING_FIELDS.map((f) => (
        <Field key={f.key} id={f.key} label={f.label} hint={f.hint} className={f.wide ? "md:col-span-2" : undefined}>
          <Textarea
            id={f.key}
            rows={f.rows}
            value={draft[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
            placeholder={f.placeholder}
          />
        </Field>
      ))}
    </div>
  )
}

export function costPerLead(draft: Pick<IcpDraft, "enabledSources">, postsPerLead: number): number {
  return draft.enabledSources.reduce((sum, s) => sum + costPerLeadForSource(s, postsPerLead), 0)
}

export function SourcesFields({ draft, set, postsPerLead }: { draft: IcpDraft; set: SetDraft; postsPerLead: number }) {
  return (
    <div className="space-y-3">
      {SOURCES.map((s) => {
        const on = draft.enabledSources.includes(s)
        const cost = costPerLeadForSource(s, postsPerLead)
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
        Up to <b className="text-foreground tabular-nums">{formatUsd(costPerLead(draft, postsPerLead))}</b> per lead
        when every enabled source has a URL, at {postsPerLead} posts per source.
      </p>
    </div>
  )
}
