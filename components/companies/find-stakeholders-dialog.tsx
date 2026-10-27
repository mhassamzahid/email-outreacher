"use client"

import { useState } from "react"
import { AlertTriangle, UserSearch } from "lucide-react"
import { Pill } from "@/components/status"
import { TagInput } from "@/components/tag-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { type ApiCompany, type StakeholderSearchResult, searchStakeholders } from "@/lib/api"

const SENIORITIES: { value: string; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-suite" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head of" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
]

const DEFAULT_TITLES = ["Owner", "Founder", "CEO", "President", "General Manager"]
const DEFAULT_SENIORITIES = ["owner", "founder", "c_suite"]

/** Search Apollo for the people at these companies. Free: no credits until an email is revealed. */
export function FindStakeholdersDialog({
  workspaceId,
  companies,
  onClose,
  onDone,
}: {
  workspaceId: string
  companies: ApiCompany[]
  onClose: () => void
  /** Called after a search that saved anyone, so lists can reload. */
  onDone: () => void
}) {
  const [titles, setTitles] = useState(DEFAULT_TITLES)
  const [seniorities, setSeniorities] = useState(DEFAULT_SENIORITIES)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<StakeholderSearchResult | null>(null)
  const [failure, setFailure] = useState("")

  const noDomain = companies.filter((c) => !c.domain)
  const tooMany = companies.length > 25

  const run = async () => {
    setRunning(true)
    setFailure("")
    try {
      const r = await searchStakeholders(workspaceId, { companyIds: companies.map((c) => c.id), titles, seniorities })
      setResult(r)
      if (r.results.some((x) => x.new > 0)) onDone()
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "The search failed.")
    } finally {
      setRunning(false)
    }
  }

  const name = companies.length === 1 ? companies[0].name : `${companies.length} companies`

  return (
    <Dialog open onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg!">
        <DialogHeader>
          <DialogTitle>Find stakeholders at {name}</DialogTitle>
          <DialogDescription>
            Searches Apollo by each company&apos;s website domain. Searching is free; emails are revealed later, per
            person, and only those use credits.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            {result.error && (
              <p className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 flex-none text-warning" />
                <span>
                  <span className="font-medium">Apollo refused the search.</span> {result.error}
                </span>
              </p>
            )}
            <ul className="divide-y divide-rule rounded-md border">
              {result.results.map((r) => (
                <li key={r.companyId} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.name ?? "Unknown company"}</span>
                    {r.reason && r.reason !== result.error && (
                      <span className="block text-[13px] text-muted-foreground">{r.reason}</span>
                    )}
                  </span>
                  {r.status === "searched" ? (
                    <span className="text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">
                      {r.found} found{r.new !== r.found ? `, ${r.new} new` : ""}
                      {r.totalAtApollo && r.totalAtApollo > r.found ? ` (of ${r.totalAtApollo})` : ""}
                    </span>
                  ) : (
                    <Pill tone={r.status === "failed" ? "negative" : "neutral"}>
                      {r.status === "failed" ? "Failed" : "Skipped"}
                    </Pill>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <form
            id="find-stakeholders"
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (!tooMany) void run()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="stakeholder-titles">Job titles</Label>
              <TagInput id="stakeholder-titles" value={titles} onChange={setTitles} placeholder="Add a title and press Enter" />
              <p className="text-xs text-muted-foreground">
                A person needs to match one of these. Similar titles count too. Leave empty to match any title.
              </p>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Seniority</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {SENIORITIES.map((s) => (
                  <Label key={s.value} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={seniorities.includes(s.value)}
                      onCheckedChange={(v) =>
                        setSeniorities((list) => (v === true ? [...list, s.value] : list.filter((x) => x !== s.value)))
                      }
                    />
                    {s.label}
                  </Label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Based on their current job. Leave all unticked for any seniority.</p>
            </fieldset>
            {noDomain.length > 0 && (
              <p className="text-[13px] text-muted-foreground">
                {companies.length === 1
                  ? "This company has no website domain in Lead Intel to search by, so it will be skipped."
                  : noDomain.length === companies.length
                    ? "None of these have a website domain in Lead Intel to search by, so all will be skipped."
                    : `${noDomain.length} of these have no website domain in Lead Intel and will be skipped.`}
              </p>
            )}
            {tooMany && <p className="text-sm text-destructive">Pick 25 companies or fewer per search.</p>}
            {failure && <p className="text-sm text-destructive">{failure}</p>}
          </form>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={running}>
                Cancel
              </Button>
              <Button type="submit" form="find-stakeholders" disabled={running || tooMany}>
                <UserSearch /> {running ? "Searching…" : "Search Apollo"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
