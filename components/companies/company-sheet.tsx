"use client"

import type { ReactNode } from "react"
import { AtSign, ExternalLink, Globe, Users } from "lucide-react"
import { IcpPill, TierPill } from "@/components/companies/company-cells"
import { StakeholdersSection } from "@/components/companies/stakeholders-section"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchCompanyDetail, useApi } from "@/lib/api"
import { compactCount } from "@/lib/format"
import type { Company } from "@/lib/types"

const WEBSITE_STATUS_LABEL: Record<string, string> = {
  has_website: "Working website",
  social_only: "Social profiles only",
  no_website: "No website",
  dead: "Website down",
  unclear: "Not checked yet",
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Globe; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-rule px-5 py-4">
      <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Everything Lead Intel already knows about a company, so nobody has to look it up again. */
export function CompanySheet({
  company,
  workspaceId,
  stakeholdersVersion,
  onClose,
  onRemove,
  onFindStakeholders,
}: {
  company: Company
  workspaceId: string
  /** Bumped after a stakeholder search so the list reloads. */
  stakeholdersVersion: number
  onClose: () => void
  onRemove?: () => void
  onFindStakeholders: () => void
}) {
  const ig = company.instagram
  // The list doesn't carry the website text; it comes with the company's detail.
  const detail = useApi(() => fetchCompanyDetail(company.id), [company.id])
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full! gap-0 overflow-y-auto sm:max-w-lg!">
        <SheetHeader className="px-5 pt-5 pb-4">
          <SheetTitle className="text-lg">{company.name}</SheetTitle>
          <SheetDescription>
            {[company.city, company.state].filter(Boolean).join(", ") || "Location unknown"}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <IcpPill name={company.icpName} />
            <TierPill tier={company.tier} />
            {company.problemScore !== null && (
              <span className="text-[13px] text-muted-foreground tabular-nums">Problem score {company.problemScore}</span>
            )}
          </div>
        </SheetHeader>

        <Section title="Stakeholders" icon={Users}>
          <StakeholdersSection
            workspaceId={workspaceId}
            companyId={company.id}
            onFind={onFindStakeholders}
            version={stakeholdersVersion}
          />
        </Section>

        <Section title="Website" icon={Globe}>
          {company.websiteUrl ? (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              {company.domain} <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">No website on file.</p>
          )}
          {company.websiteStatus && (
            <p className="text-[13px] text-muted-foreground">
              {WEBSITE_STATUS_LABEL[company.websiteStatus] ?? company.websiteStatus.replaceAll("_", " ")}
            </p>
          )}
          {detail.loading ? (
            <Skeleton className="h-16 w-full" />
          ) : detail.error ? (
            <p className="text-[13px] text-muted-foreground">Couldn&apos;t load the website text: {detail.error}</p>
          ) : detail.data?.siteText ? (
            <blockquote className="max-h-60 overflow-y-auto rounded-md bg-muted/50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line text-foreground/90">
              {detail.data.siteText}
            </blockquote>
          ) : (
            <p className="text-[13px] text-muted-foreground">Lead Intel hasn&apos;t stored any website text for it.</p>
          )}
        </Section>

        <Section title="Instagram" icon={AtSign}>
          {ig.handle ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <a
                  href={ig.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  @{ig.handle} <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
                </a>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {ig.followers !== null ? `${compactCount(ig.followers)} followers` : "Followers not checked yet"}
                </span>
                {ig.category && <span className="text-[13px] text-muted-foreground">{ig.category}</span>}
              </div>
              {ig.bio && <p className="text-[13px] leading-relaxed">{ig.bio}</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No Instagram account found.</p>
          )}
        </Section>

        <p className="border-t border-rule px-5 py-3 text-xs text-muted-foreground">
          Stored by Lead Intel. The website text and Instagram profile are reused, not scraped again.
        </p>

        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-rule px-5 py-4">
          {onRemove && (
            <Button variant="outline" onClick={onRemove}>
              Remove from workspace
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
