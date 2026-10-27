"use client"

import { useState } from "react"
import { AlertTriangle, Search } from "lucide-react"
import { TagInput } from "@/components/tag-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type ApiIcp, type IcpSearch, searchByIcp } from "@/lib/api"

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

const SIZES: { value: string; label: string }[] = [
  { value: "1,10", label: "1–10" },
  { value: "11,50", label: "11–50" },
  { value: "51,200", label: "51–200" },
  { value: "201,500", label: "201–500" },
  { value: "501,1000", label: "501–1,000" },
  { value: "1001,5000", label: "1,001–5,000" },
  { value: "5001,1000000", label: "5,000+" },
]

const DEFAULT_TITLES = ["Owner", "Founder", "CEO", "President", "General Manager"]

type Form = Omit<IcpSearch, "icpId" | "page">

/** What an ICP says, as a starting search: its outreach titles, its places, its search terms. */
function fromIcp(icp: ApiIcp | undefined): Form {
  return {
    titles: icp?.profile?.titles.length ? icp.profile.titles : DEFAULT_TITLES,
    seniorities: ["owner", "founder", "c_suite"],
    locations: icp?.places ?? [],
    keywords: icp?.searchTerms[0] ?? icp?.industry ?? "",
    employeeRanges: ["1,10", "11,50", "51,200"],
    verifiedEmailOnly: true,
    perPage: 25,
  }
}

/** Search Apollo for people who fit one of Lead Intel's ICPs. Free; revealing emails is separate. */
export function IcpSearchDialog({
  workspaceId,
  icps,
  initialIcpId,
  onClose,
  onFound,
}: {
  workspaceId: string
  icps: ApiIcp[]
  initialIcpId?: string
  onClose: () => void
  /** Called after a search that saved anyone, so the list can reload. */
  onFound: () => void
}) {
  const [icpId, setIcpId] = useState(initialIcpId ?? icps[0]?.id ?? "")
  const [form, setForm] = useState<Form>(() => fromIcp(icps.find((i) => i.id === (initialIcpId ?? icps[0]?.id))))
  const [page, setPage] = useState(1)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ found: number; new: number; totalAtApollo: number | null } | null>(null)
  const [error, setError] = useState("")

  const icp = icps.find((i) => i.id === icpId)
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setResult(null)
    setPage(1)
  }
  const noFilters =
    !form.titles.length && !form.seniorities.length && !form.locations.length && !form.keywords.trim() && !form.employeeRanges.length

  const run = async (atPage: number) => {
    setRunning(true)
    setError("")
    try {
      const r = await searchByIcp(workspaceId, { icpId, page: atPage, ...form })
      if (r.error) {
        setError(r.error)
        setResult(null)
      } else {
        setResult(r)
        setPage(atPage)
        if (r.new > 0) onFound()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The search failed.")
    } finally {
      setRunning(false)
    }
  }

  const pages = result?.totalAtApollo ? Math.min(500, Math.ceil(result.totalAtApollo / form.perPage)) : 1

  return (
    <Dialog open onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl!">
        <DialogHeader>
          <DialogTitle>Search Apollo by ICP</DialogTitle>
          <DialogDescription>
            Finds people anywhere who fit the ICP, not only at companies you&apos;ve imported. Searching is free; only
            revealing an email uses credits.
          </DialogDescription>
        </DialogHeader>

        <form
          id="icp-search"
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!noFilters && icpId) void run(1)
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="icp-search-icp">ICP</Label>
            <Select
              value={icpId}
              onValueChange={(v) => {
                setIcpId(v)
                setForm(fromIcp(icps.find((i) => i.id === v)))
                setResult(null)
                setPage(1)
              }}
            >
              <SelectTrigger id="icp-search-icp" className="w-full!">
                <SelectValue placeholder="Pick an ICP" />
              </SelectTrigger>
              <SelectContent>
                {icps.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} <span className="text-muted-foreground">· {i.industry}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Filled in from the ICP: titles from its outreach settings
              {icp?.profile?.titles.length ? "" : " (none saved yet, so common owner titles)"}, places and search terms from Lead
              Intel. Change anything below.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="icp-search-titles">Job titles</Label>
            <TagInput id="icp-search-titles" value={form.titles} onChange={(v) => set("titles", v)} placeholder="Add a title and press Enter" />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Seniority</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              {SENIORITIES.map((s) => (
                <Label key={s.value} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={form.seniorities.includes(s.value)}
                    onCheckedChange={(v) =>
                      set("seniorities", v === true ? [...form.seniorities, s.value] : form.seniorities.filter((x) => x !== s.value))
                    }
                  />
                  {s.label}
                </Label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="icp-search-locations">Company locations</Label>
              <TagInput
                id="icp-search-locations"
                value={form.locations}
                onChange={(v) => set("locations", v)}
                placeholder="City, state or country"
              />
              <p className="text-xs text-muted-foreground">Where the company is based. Empty means anywhere.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="icp-search-keywords">Keywords</Label>
              <Input id="icp-search-keywords" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Free text, e.g. &quot;screen printing&quot;. Apollo has no plain-text industry filter, so this stands in.
              </p>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Company size (employees)</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {SIZES.map((s) => (
                <Label key={s.value} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={form.employeeRanges.includes(s.value)}
                    onCheckedChange={(v) =>
                      set(
                        "employeeRanges",
                        v === true ? [...form.employeeRanges, s.value] : form.employeeRanges.filter((x) => x !== s.value),
                      )
                    }
                  />
                  {s.label}
                </Label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
              <Checkbox checked={form.verifiedEmailOnly} onCheckedChange={(v) => set("verifiedEmailOnly", v === true)} />
              Only people with a verified email
            </Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="icp-search-per-page" className="text-sm font-normal text-muted-foreground">
                Per search
              </Label>
              <Select value={String(form.perPage)} onValueChange={(v) => set("perPage", Number(v))}>
                <SelectTrigger id="icp-search-per-page" className="w-24!">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {noFilters && <p className="text-sm text-destructive">Add at least one filter, or the search would match everyone.</p>}
          {error && (
            <p className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 flex-none text-warning" />
              <span>
                <span className="font-medium">Apollo refused the search.</span> {error}
              </span>
            </p>
          )}
          {result && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm tabular-nums">
              Page {page}: {result.found} found, {result.new} new.
              {result.totalAtApollo !== null && ` Apollo has ${result.totalAtApollo.toLocaleString()} matching people.`}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={running}>
            {result ? "Done" : "Cancel"}
          </Button>
          {result && page < pages ? (
            <Button disabled={running} onClick={() => void run(page + 1)}>
              <Search /> {running ? "Searching…" : `Get page ${page + 1}`}
            </Button>
          ) : (
            <Button type="submit" form="icp-search" disabled={running || noFilters || !icpId}>
              <Search /> {running ? "Searching…" : "Search Apollo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
