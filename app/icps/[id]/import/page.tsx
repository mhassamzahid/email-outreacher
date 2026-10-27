"use client"

import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, type DragEvent } from "react"
import { AlertTriangle, ArrowLeft, Download, FileUp } from "lucide-react"
import { toast } from "sonner"
import { SourceIcons } from "@/components/source-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIcpParam } from "@/hooks/use-icp"
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv"
import { fullName, formatUsd } from "@/lib/format"
import { LEAD_FIELDS, SAMPLE_CSV, buildImport, downloadLeadTemplate, suggestMapping, type MappingTarget } from "@/lib/import"
import { estimateEnrichmentCost } from "@/lib/mock-actions"
import { leadSources } from "@/lib/mock-data"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

interface Parsed {
  fileName: string
  headers: string[]
  rows: string[][]
}

export default function ImportPage() {
  const icp = useIcpParam()
  const { leads, settings, addLeads } = useStore()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [mapping, setMapping] = useState<MappingTarget[]>([])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const existingEmails = useMemo(
    () => new Set(leads.filter((l) => l.icpId === icp?.id).map((l) => l.email.toLowerCase())),
    [leads, icp?.id],
  )
  const result = useMemo(
    () => (parsed && icp ? buildImport(parsed.headers, parsed.rows, mapping, icp.id, existingEmails) : null),
    [parsed, mapping, icp, existingEmails],
  )
  if (!icp) return null

  const readFile = async (file: File) => {
    setError(null)
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("That file isn't a CSV. Export your list as .csv and try again.")
      return
    }
    const table = parseCsv(await file.text())
    if (table.length < 2) {
      setError("We couldn't find any data rows. Check that the first row has column headers and the rest have leads.")
      return
    }
    const [headers, ...rows] = table
    setParsed({ fileName: file.name, headers, rows })
    setMapping(suggestMapping(headers))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void readFile(file)
  }

  const emailMapped = mapping.includes("email")
  const estimate = result ? estimateEnrichmentCost(result.leads, icp.enabledSources, settings.postsPerLead) : null

  const confirm = () => {
    if (!result) return
    addLeads(result.leads)
    toast.success(`Imported ${result.leads.length} leads into ${icp.name}`)
    router.push(`/icps/${icp.id}/leads`)
  }

  if (!parsed || !result) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            dragging ? "border-foreground/50 bg-muted" : "hover:bg-muted/50",
          )}
        >
          <FileUp className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a CSV here, or click to choose a file</p>
          <p className="text-xs text-muted-foreground">One lead per row with a header row. Email is required.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void readFile(file)
              e.target.value = ""
            }}
          />
        </div>
        {error && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="size-4" /> {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Button variant="link" className="px-0" onClick={downloadLeadTemplate}>
            <Download /> Download template
          </Button>
          <Button
            variant="link"
            className="px-0 font-normal text-muted-foreground!"
            onClick={() => downloadCsv("sample-leads.csv", toCsv(SAMPLE_CSV))}
          >
            Download sample with test rows
          </Button>
        </div>
      </div>
    )
  }

  const { stats } = result
  const dropped = stats.missingEmail + stats.duplicatesInFile + stats.duplicatesExisting
  const summary: [string, number | string, boolean?][] = [
    ["Rows in file", stats.totalRows],
    ["Leads to import", result.leads.length],
    ["Duplicates removed (in file)", stats.duplicatesInFile, stats.duplicatesInFile > 0],
    ["Already in this ICP", stats.duplicatesExisting, stats.duplicatesExisting > 0],
    ["Missing email (skipped)", stats.missingEmail, stats.missingEmail > 0],
    ["With LinkedIn URL", stats.withLinkedin],
    ["With Instagram URL", stats.withInstagram],
    ["With Facebook URL", stats.withFacebook],
    ["With website", `${stats.withWebsite} (${stats.websitesDerived} from email domain)`],
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>
          <ArrowLeft /> Choose another file
        </Button>
        <span className="text-sm text-muted-foreground">{parsed.fileName}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Map columns</CardTitle>
              <CardDescription>
                Suggested from your headers. Columns you don&apos;t map are kept as custom fields, usable in prompts as{" "}
                <code className="font-mono text-xs">{"{{lead.extra.column}}"}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV column</TableHead>
                    <TableHead>Sample</TableHead>
                    <TableHead className="w-56">Maps to</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.headers.map((h, col) => (
                    <TableRow key={col}>
                      <TableCell className="font-medium">{h || `Column ${col + 1}`}</TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">
                        {parsed.rows.find((r) => r[col]?.trim())?.[col] ?? ""}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping[col]}
                          onValueChange={(v) =>
                            setMapping((m) =>
                              m.map((t, i) => (i === col ? (v as MappingTarget) : t === v ? "__extra__" : t)),
                            )
                          }
                        >
                          <SelectTrigger size="sm" className="w-full!" aria-label={`Map ${h}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_FIELDS.map((f) => (
                              <SelectItem key={f.field} value={f.field}>
                                {f.label}
                              </SelectItem>
                            ))}
                            <SelectSeparator />
                            <SelectItem value="__extra__">Custom field (extra)</SelectItem>
                            <SelectItem value="__ignore__">Don&apos;t import</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>First 5 rows as they will be imported.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Sources</TableHead>
                    <TableHead>Extra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rowOutcome.slice(0, 5).map((outcome, i) => {
                    if (typeof outcome !== "number")
                      return (
                        <TableRow key={i} className="text-muted-foreground">
                          <TableCell colSpan={7}>
                            Row {i + 2} skipped: {outcome === "duplicate" ? "duplicate email" : "missing email"}
                          </TableCell>
                        </TableRow>
                      )
                    const lead = result.leads[outcome]
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{fullName(lead) || "–"}</TableCell>
                        <TableCell>{lead.email}</TableCell>
                        <TableCell>{lead.company || "–"}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.title || "–"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {lead.website.replace(/^https?:\/\//, "") || "–"}
                          {result.derivedWebsite.has(outcome) && (
                            <Badge variant="secondary" className="ml-1.5 font-normal">
                              from email
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <SourceIcons sources={leadSources(lead)} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {Object.entries(lead.extra)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ") || "–"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-4">
          <CardHeader>
            <CardTitle>Validation</CardTitle>
            <CardDescription>Check this before importing. Nothing runs until you enrich.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!emailMapped && (
              <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Map a column to Email to continue.
              </p>
            )}
            <dl className="space-y-1.5 text-sm">
              {summary.map(([label, value, warn]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={cn("text-right tabular-nums", warn && "text-amber-700 dark:text-amber-300")}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-between border-t pt-3 text-sm">
              <span>Estimated enrichment cost</span>
              <span className="font-medium tabular-nums">{formatUsd(estimate?.total ?? 0)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on enabled sources for this ICP at {settings.postsPerLead} posts per source.
              {dropped > 0 && ` ${dropped} row${dropped === 1 ? "" : "s"} will not be imported.`}
            </p>
            <Button className="w-full" disabled={!emailMapped || result.leads.length === 0} onClick={confirm}>
              Import {result.leads.length} lead{result.leads.length === 1 ? "" : "s"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
