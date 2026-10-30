"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Plus } from "lucide-react"
import { SourceIcon } from "@/components/source-icon"
import { TagInput } from "@/components/tag-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { fetchProducts, useApi } from "@/lib/api"
import { SOURCE_LABEL, formatUsd } from "@/lib/format"
import { COST_PER_POST, FETCHED_SOURCES, costPerLeadForSource } from "@/lib/costs"
import { useStore } from "@/lib/store"
import type { ICP, IcpOutreach, IcpSource, VerificationSource } from "@/lib/types"

// The editable half of an ICP: this workspace's outreach settings. The ICP itself (name, industry,
// matching rule) belongs to Lead Intel and is shown read-only by LeadIntelRule.

export type IcpDraft = Omit<IcpOutreach, "verifyPromptId" | "hookPromptId" | "emailPromptId">
export type SetDraft = <K extends keyof IcpDraft>(key: K, value: IcpDraft[K]) => void

export const toDraft = (icp: ICP): IcpDraft => ({
  description: icp.description,
  titles: icp.titles,
  pains: icp.pains,
  offer: icp.offer,
  proof: icp.proof,
  cta: icp.cta,
  tone: icp.tone,
  wordsToAvoid: icp.wordsToAvoid,
  hookGuidance: icp.hookGuidance,
  enabledSources: icp.enabledSources,
  verificationSources: icp.verificationSources,
  postsPerSource: icp.postsPerSource,
  maxPostAgeDays: icp.maxPostAgeDays,
  productId: icp.productId,
})

/** Messaging fields in the order the email prompt reads them, with how each one is used. */
export const MESSAGING_FIELDS: {
  key: "pains" | "offer" | "proof" | "cta" | "tone" | "wordsToAvoid" | "hookGuidance"
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
]

export const SUGGESTIONS = {
  titles: ["Owner", "Founder", "Co-founder", "CEO", "President", "General Manager", "Marketing Director", "Operations Manager"],
}

/** Lead Intel's own words for each source its ICP rules read. */
export const ICP_SOURCE_LABELS: Record<IcpSource, string> = {
  business_name: "Their business name",
  website_text: "Text on their website",
  website_domain: "Their web address",
  instagram_bio: "Their Instagram bio",
  instagram_category: "The category Instagram lists them under",
  instagram_handle: "Their Instagram username",
  meta_ads_text: "The wording of their ads",
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

export function BasicsFields({ draft, set }: { draft: IcpDraft; set: SetDraft }) {
  return (
    <Field id="description" label="Description" hint="For your team. Not sent to the model.">
      <Textarea
        id="description"
        rows={2}
        value={draft.description}
        onChange={(e) => set("description", e.target.value)}
        placeholder="Who you're reaching at these companies, and why"
      />
    </Field>
  )
}

export function TargetingFields({ draft, set }: { draft: IcpDraft; set: SetDraft }) {
  return (
    <Field
      id="titles"
      label="Job titles to reach"
      hint="Who to email at each company. Used to find stakeholders in Apollo and in prompts as {{icp.titles}}."
    >
      <TagInput id="titles" value={draft.titles} onChange={(v) => set("titles", v)} placeholder="Owner, Founder" />
      <Suggestions options={SUGGESTIONS.titles} value={draft.titles} onAdd={(t) => set("titles", [...draft.titles, t])} />
    </Field>
  )
}

function RuleRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

function Terms({ terms, empty }: { terms: string[]; empty: string }) {
  if (!terms.length) return <span className="text-muted-foreground">{empty}</span>
  return (
    <span className="flex flex-wrap gap-1">
      {terms.map((t) => (
        <span key={t} className="rounded-[4px] bg-muted px-1.5 text-[13px] leading-5">
          {t}
        </span>
      ))}
    </span>
  )
}

/** Lead Intel's definition of the ICP, exactly as stored there. Read-only: it's edited in Lead Intel. */
export function LeadIntelRule({ icp }: { icp: ICP }) {
  const range = (min: number | null, max: number | null, unit: string) =>
    min === null && max === null
      ? "Any"
      : min !== null && max !== null
        ? `${min.toLocaleString()}–${max.toLocaleString()} ${unit}`
        : min !== null
          ? `At least ${min.toLocaleString()} ${unit}`
          : `At most ${max!.toLocaleString()} ${unit}`
  return (
    <dl className="divide-y divide-rule">
      <RuleRow label="Industry">{icp.industry}</RuleRow>
      <RuleRow label="Order">
        {icp.priority} <span className="text-muted-foreground">· lower is checked first</span>
        {!icp.enabled && <span className="ml-2 text-warning">Archived</span>}
      </RuleRow>
      <RuleRow label="Searched on Google Maps">
        <Terms terms={icp.searchTerms} empty="Not sourced, only matched" />
      </RuleRow>
      <RuleRow label="Reads">
        {icp.sources.length ? icp.sources.map((s) => ICP_SOURCE_LABELS[s] ?? s).join(", ") : "Everything"}
      </RuleRow>
      <RuleRow label="Any of these words">
        <Terms terms={icp.anyOf} empty="None" />
      </RuleRow>
      <RuleRow label="On their website">
        <Terms terms={icp.websiteAnyOf} empty="None" />
      </RuleRow>
      <RuleRow label="On their Instagram">
        <Terms terms={icp.instagramAnyOf} empty="None" />
      </RuleRow>
      <RuleRow label="Groups that must match">{icp.requireAll ? "Every filled-in group" : "Any filled-in group"}</RuleRow>
      <RuleRow label="Never these words">
        <Terms terms={icp.noneOf} empty="None" />
      </RuleRow>
      <RuleRow label="Instagram followers">{range(icp.minFollowers, icp.maxFollowers, "followers")}</RuleRow>
      <RuleRow label="Google reviews">{icp.minReviews === null ? "Any" : `At least ${icp.minReviews}`}</RuleRow>
      <RuleRow label="Needs a website">{icp.requiresWebsite ? "Yes" : "No"}</RuleRow>
      <RuleRow label="Places">
        <Terms terms={icp.places} empty="Anywhere" />
      </RuleRow>
      <RuleRow label="Businesses in it">{icp.companyCount.toLocaleString()}</RuleRow>
    </dl>
  )
}

const NO_PRODUCT = "__none__"

/** Which product this ICP is sold. Its details fill {{product.*}} in this ICP's prompts. */
export function ProductField({ draft, set }: { draft: IcpDraft; set: SetDraft }) {
  const { currentWorkspaceId } = useStore()
  const products = useApi(
    () => (currentWorkspaceId ? fetchProducts(currentWorkspaceId) : Promise.resolve([])),
    [currentWorkspaceId],
  )
  const chosen = products.data?.find((p) => p.id === draft.productId)
  return (
    <Field
      id="productId"
      label="Product we sell them"
      hint={
        chosen?.description ||
        "Its description, value, proof, offer and call to action are available to this ICP's prompts as {{product.*}}."
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={draft.productId ?? NO_PRODUCT}
          onValueChange={(v) => set("productId", v === NO_PRODUCT ? null : v)}
          disabled={!products.data}
        >
          <SelectTrigger id="productId" className="w-72!">
            <SelectValue placeholder="Loading products…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PRODUCT}>No product</SelectItem>
            {(products.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link href="/products" className="text-[13px] text-data hover:underline">
          {products.data?.length ? "Manage products" : "Add a product"}
        </Link>
      </div>
    </Field>
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

/** What reading one lead's posts costs, at most: every analysis source on, each with a full set of posts. */
export function costPerLead(draft: Pick<IcpDraft, "enabledSources">, postsPerLead: number): number {
  return FETCHED_SOURCES.filter((s) => draft.enabledSources.includes(s)).reduce((sum, s) => sum + costPerLeadForSource(s, postsPerLead), 0)
}

const VERIFICATION: { source: VerificationSource; label: string; hint: string; cost: string }[] = [
  { source: "website", label: "Website", hint: "Read by Coldbrew's own reader. Rules on website words need it.", cost: "Free" },
  { source: "jina", label: "Jina fallback", hint: "Reads a site when it blocks Coldbrew's reader.", cost: "Free without a key" },
  { source: "instagram", label: "Instagram profile", hint: "Followers, bio and recent posts, through Apify.", cost: "Apify" },
  { source: "score", label: "Claude's fit score", hint: "Scores the fit from everything read. Off: the ICP's rules alone decide.", cost: "Claude" },
]

/** Verification: what research reads to decide whether a business is worth contacting. */
export function VerificationSourcesFields({ draft, set }: { draft: IcpDraft; set: SetDraft }) {
  const toggle = (s: VerificationSource, on: boolean) =>
    set("verificationSources", on ? [...new Set([...draft.verificationSources, s])] : draft.verificationSources.filter((x) => x !== s))
  return (
    <div className="space-y-3">
      {VERIFICATION.map((v) => (
        <div key={v.source} className="flex items-start gap-3">
          <Label htmlFor={`verify-${v.source}`} className="flex-1 flex-col items-start gap-0.5 font-normal">
            <span>{v.label}</span>
            <span className="text-xs text-muted-foreground">{v.hint}</span>
          </Label>
          <span className="pt-0.5 text-xs whitespace-nowrap text-muted-foreground">{v.cost}</span>
          <Switch
            id={`verify-${v.source}`}
            checked={draft.verificationSources.includes(v.source)}
            onCheckedChange={(on) => toggle(v.source, on)}
          />
        </div>
      ))}
      <p className="border-t pt-3 text-xs text-muted-foreground">How many pages of each site are read is set in Settings, Website reading.</p>
    </div>
  )
}

/** Analysis: each lead's recent posts, read to find something specific to open the email with. */
export function AnalysisSourcesFields({
  draft,
  set,
  postsPerLead,
  maxPostAgeDays,
}: {
  draft: IcpDraft
  set: SetDraft
  postsPerLead: number
  maxPostAgeDays: number
}) {
  const posts = draft.postsPerSource ?? postsPerLead
  const limit = (key: "postsPerSource" | "maxPostAgeDays", label: string, fallback: number, max: number, unit: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`analysis-${key}`} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`analysis-${key}`}
        inputMode="numeric"
        placeholder={`${fallback} (Settings)`}
        value={draft[key] ?? ""}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "")
          set(key, raw === "" ? null : Math.min(max, Math.max(1, Number(raw))))
        }}
      />
      <p className="text-xs text-muted-foreground">
        1 to {max} {unit}. Empty uses Settings.
      </p>
    </div>
  )
  return (
    <div className="space-y-3">
      {FETCHED_SOURCES.map((s) => (
        <div key={s} className="flex items-center gap-3">
          <SourceIcon source={s} />
          <Label htmlFor={`src-${s}`} className="flex-1 font-normal">
            {SOURCE_LABEL[s]} posts
          </Label>
          <span className="text-xs text-muted-foreground tabular-nums">{formatUsd(COST_PER_POST[s])} a post</span>
          <Switch
            id={`src-${s}`}
            checked={draft.enabledSources.includes(s)}
            onCheckedChange={(checked) =>
              set("enabledSources", checked ? [...new Set([...draft.enabledSources, s])] : draft.enabledSources.filter((x) => x !== s))
            }
          />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3 border-t pt-3">
        {limit("postsPerSource", "Posts per source", postsPerLead, 20, "posts")}
        {limit("maxPostAgeDays", "Max post age (days)", maxPostAgeDays, 365, "days")}
      </div>
      <p className="text-xs text-muted-foreground">
        Up to <b className="text-foreground tabular-nums">{formatUsd(costPerLead(draft, posts))}</b> per lead when each source has a
        profile, at {posts} posts per source.
      </p>
    </div>
  )
}
