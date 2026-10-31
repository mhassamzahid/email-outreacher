"use client"

import { useState } from "react"
import { AlertTriangle, Search } from "lucide-react"
import { TagInput } from "@/components/tag-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type ApiIcp, type SourceFindResult, findCompanies } from "@/lib/api"

const SIZES: { value: string; label: string }[] = [
  { value: "1,10", label: "1–10" },
  { value: "11,50", label: "11–50" },
  { value: "51,200", label: "51–200" },
  { value: "201,500", label: "201–500" },
  { value: "501,1000", label: "501–1,000" },
  { value: "1001,1000000", label: "1,000+" },
]

function ResultLine({ label, r }: { label: string; r: SourceFindResult | null }) {
  if (!r) return null
  if (r.error)
    return (
      <p className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
        <AlertTriangle className="mt-0.5 size-4 flex-none text-warning" />
        <span>
          <span className="font-medium">{label}:</span> {r.error}
        </span>
      </p>
    )
  return (
    <p className="rounded-md bg-muted/50 px-3 py-2 text-sm tabular-nums">
      <span className="font-medium">{label}:</span> {r.found} found, {r.added} new
      {r.duplicates ? `, ${r.duplicates} already in the pipeline` : ""}
      {r.excluded ? `, ${r.excluded} on the do-not-contact list` : ""}
      {r.totalAvailable !== null && r.totalAvailable > r.found ? ` (${r.totalAvailable.toLocaleString()} available)` : ""}
    </p>
  )
}

/** Search Apollo for companies that fit an ICP; they're researched and scored next. */
export function ApolloSearchDialog({
  workspaceId,
  icps,
  initialIcpId,
  onClose,
  onFound,
}: {
  workspaceId: string
  icps: ApiIcp[]
  initialIcpId: string
  onClose: () => void
  /** Called with the ICP the new companies were added to. */
  onFound: (icpId: string) => void
}) {
  const [icpId, setIcpId] = useState(initialIcpId)
  const icp = icps.find((i) => i.id === icpId) ?? icps[0]
  const defaultKeywords = (i: ApiIcp) => (i.searchTerms.length ? i.searchTerms : [i.industry])
  const [keywords, setKeywords] = useState<string[]>(defaultKeywords(icp))
  const [locations, setLocations] = useState<string[]>(icp.places)
  const [sizes, setSizes] = useState<string[]>(["1,10", "11,50", "51,200"])
  const [perPage, setPerPage] = useState("25")
  const [page, setPage] = useState(1)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SourceFindResult | null>(null)
  const [failure, setFailure] = useState("")

  const run = async (atPage: number) => {
    setRunning(true)
    setFailure("")
    try {
      const r = await findCompanies(workspaceId, {
        icpId: icp.id,
        sources: ["apollo"],
        apollo: {
          keywords,
          locations,
          employeeRanges: sizes,
          page: atPage,
          perPage: Number(perPage),
        },
      })
      setResult(r.apollo)
      setPage(atPage)
      if ((r.apollo?.added ?? 0) > 0) onFound(icp.id)
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "The search failed.")
    } finally {
      setRunning(false)
    }
  }

  // Another ICP: start over from its search terms and places.
  const changeIcp = (id: string) => {
    const next = icps.find((i) => i.id === id)
    if (!next) return
    setIcpId(id)
    setKeywords(defaultKeywords(next))
    setLocations(next.places)
    setResult(null)
    setPage(1)
    setFailure("")
  }

  const morePages = !!result && !result.error && (result.totalAvailable ?? 0) > page * Number(perPage)

  return (
    <Dialog open onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl!">
        <DialogHeader>
          <DialogTitle>Search Apollo</DialogTitle>
          <DialogDescription>
            Companies that fit an ICP. They&apos;re researched and scored before you look for their people. Companies already in
            the pipeline are skipped. 1 Apollo credit per page of results.
          </DialogDescription>
        </DialogHeader>

        <form
          id="find-companies"
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            void run(1)
          }}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="find-icp">ICP</Label>
              <Select value={icp.id} onValueChange={changeIcp} disabled={running}>
                <SelectTrigger id="find-icp" className="w-60!">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {icps.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">The companies found go into this ICP&apos;s pipeline.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="find-keywords">Keywords</Label>
              <TagInput id="find-keywords" value={keywords} onChange={setKeywords} placeholder="screen printing" />
              <p className="text-xs text-muted-foreground">
                From the ICP&apos;s Google Maps search terms. Apollo matches its company keyword tags.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="find-locations">Locations</Label>
              <TagInput places id="find-locations" value={locations} onChange={setLocations} placeholder="City, state or country" />
              <p className="text-xs text-muted-foreground">From the ICP&apos;s places. Empty means anywhere.</p>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Company size (employees)</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {SIZES.map((s) => (
                  <Label key={s.value} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={sizes.includes(s.value)}
                      onCheckedChange={(v) =>
                        setSizes((list) => (v === true ? [...list, s.value] : list.filter((x) => x !== s.value)))
                      }
                    />
                    {s.label}
                  </Label>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center gap-2">
              <Label htmlFor="find-per-page" className="text-sm font-normal text-muted-foreground">
                Companies per page
              </Label>
              <Select value={perPage} onValueChange={setPerPage}>
                <SelectTrigger id="find-per-page" className="w-24!">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["25", "50", "100"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {failure && <p className="text-sm text-destructive">{failure}</p>}
          <ResultLine label={`Page ${page}`} r={result} />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={running}>
            {result ? "Done" : "Cancel"}
          </Button>
          {morePages ? (
            <Button disabled={running} onClick={() => void run(page + 1)}>
              <Search /> {running ? "Searching…" : `Apollo page ${page + 1}`}
            </Button>
          ) : (
            <Button type="submit" form="find-companies" disabled={running}>
              <Search /> {running ? "Searching…" : "Search Apollo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
