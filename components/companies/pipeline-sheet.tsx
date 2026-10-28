"use client"

import type { ReactNode } from "react"
import { AtSign, Check, ExternalLink, Globe, Sparkles, UserSearch, X } from "lucide-react"
import { StatusPill } from "@/components/companies/pipeline-cells"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { type PipelineCompany, fetchCompanyDetail, useApi } from "@/lib/api"
import { compactCount, shortDate } from "@/lib/format"

const RULE_SOURCE: Record<string, string> = {
  business_name: "business name",
  website_text: "website",
  website_domain: "web address",
  instagram_bio: "Instagram bio",
  instagram_category: "Instagram category",
  instagram_handle: "Instagram username",
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Globe; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-rule px-5 py-4">
      <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

function LeadIntelText({ businessId }: { businessId: string }) {
  const detail = useApi(() => fetchCompanyDetail(businessId), [businessId])
  if (detail.loading) return <Skeleton className="h-16 w-full" />
  if (!detail.data?.siteText) return <p className="text-[13px] text-muted-foreground">Lead Intel hasn&apos;t stored any website text.</p>
  return <blockquote className="max-h-60 overflow-y-auto rounded-md bg-muted/50 px-3 py-2 text-[13px] leading-relaxed">{detail.data.siteText}</blockquote>
}

/** Everything known about a pipeline company: why it is where it is, and what was read. */
export function PipelineSheet({
  company,
  busy,
  onClose,
  onStatus,
  onFindStakeholders,
}: {
  company: PipelineCompany
  busy: boolean
  onClose: () => void
  onStatus: (status: "qualified" | "not_fit") => void
  onFindStakeholders: () => void
}) {
  const site = company.research?.website
  const ig = company.research?.instagram
  const socials = { ...(company.research?.socials ?? {}), ...(company.instagramUrl ? { instagram: company.instagramUrl } : {}) }
  const score = company.scoreDetail

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full! gap-0 overflow-y-auto sm:max-w-lg!">
        <SheetHeader className="px-5 pt-5 pb-4">
          <SheetTitle className="text-lg">{company.name}</SheetTitle>
          <SheetDescription>
            {company.domain ?? "No website"} · {company.source === "lead_intel" ? "from Lead Intel" : "from Apollo"}
            {company.researchedAt ? ` · researched ${shortDate(company.researchedAt)}` : ""}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusPill status={company.status} />
            {company.score !== null && <span className="text-sm font-medium tabular-nums">Score {company.score}</span>}
            {company.overridden && <span className="text-xs text-muted-foreground">set by hand</span>}
          </div>
          {company.statusReason && <p className="pt-1 text-[13px] text-muted-foreground">{company.statusReason}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            {company.status === "qualified" && (
              <Button size="sm" onClick={onFindStakeholders}>
                <UserSearch /> Find stakeholders
              </Button>
            )}
            {company.status !== "qualified" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus("qualified")}>
                <Check /> Keep
              </Button>
            )}
            {company.status !== "not_fit" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus("not_fit")}>
                <X /> Drop
              </Button>
            )}
          </div>
        </SheetHeader>

        {score && !score.error && (
          <Section title={`Claude's score (${score.model})`} icon={Sparkles}>
            <p className="text-[13px]">{score.summary}</p>
            {score.reasons.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-[13px]">
                {score.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            {score.concerns.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-warning">
                {score.concerns.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {company.ruleDetail && (
          <Section title="ICP rule" icon={Check}>
            <p className="text-[13px]">
              {company.ruleFit ? "Passes: " : "Fails: "}
              {company.ruleDetail.reason}
            </p>
            {company.ruleDetail.hits.length > 0 && (
              <p className="text-[13px] text-muted-foreground">
                Matched {company.ruleDetail.hits.map((h) => `"${h.term}" on their ${RULE_SOURCE[h.source] ?? h.source}`).join(", ")}
              </p>
            )}
            {company.ruleDetail.skipped.length > 0 && (
              <p className="text-xs text-muted-foreground">Not checked: {company.ruleDetail.skipped.join("; ")}</p>
            )}
          </Section>
        )}

        <Section title="Website" icon={Globe}>
          {company.websiteUrl || company.domain ? (
            <a
              href={company.websiteUrl ?? `https://${company.domain}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              {company.domain ?? company.websiteUrl} <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">No website on file.</p>
          )}
          {company.source === "lead_intel" && company.leadIntelBusinessId ? (
            <LeadIntelText businessId={company.leadIntelBusinessId} />
          ) : !site ? (
            <p className="text-[13px] text-muted-foreground">Not researched yet.</p>
          ) : site.outcome === "ok" ? (
            <>
              <p className="text-xs text-muted-foreground">Read {site.via === "jina" ? "with Jina (a browser)" : "directly"}</p>
              <blockquote className="max-h-60 overflow-y-auto rounded-md bg-muted/50 px-3 py-2 text-[13px] leading-relaxed">{site.text}</blockquote>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">Couldn&apos;t read it: {site.detail ?? site.outcome.replaceAll("_", " ")}</p>
          )}
        </Section>

        <Section title="Instagram and socials" icon={AtSign}>
          {ig ? (
            <div className="space-y-1">
              <p className="text-sm">
                <span className="font-medium">@{ig.handle}</span>
                <span className="text-[13px] text-muted-foreground">
                  {ig.followers !== null ? ` · ${compactCount(ig.followers)} followers` : ""}
                  {ig.category ? ` · ${ig.category}` : ""}
                </span>
              </p>
              {ig.bio && <p className="text-[13px] leading-relaxed">{ig.bio}</p>}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              {socials.instagram ? "Instagram profile not read yet." : "No Instagram linked from their website."}
            </p>
          )}
          {Object.keys(socials).length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[13px]">
              {Object.entries(socials).map(([network, url]) => (
                <a key={network} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 capitalize hover:underline">
                  {network} <ExternalLink className="size-3" aria-hidden />
                </a>
              ))}
            </div>
          )}
        </Section>
      </SheetContent>
    </Sheet>
  )
}
