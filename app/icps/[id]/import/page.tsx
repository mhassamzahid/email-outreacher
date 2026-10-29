"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, type DragEvent } from "react"
import { AlertTriangle, ArrowLeft, Download, FileUp } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIcpParam } from "@/hooks/use-icp"
import { downloadTemplate, importLeadsCsv, type LeadImportResult } from "@/lib/api"
import { parseCsv } from "@/lib/csv"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

// Rows shown in the preview; the counts on the right cover the whole file.
const PREVIEW_ROWS = 50

const FIELD_LABEL: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  company: "Company",
  title: "Title",
  website: "Website",
  linkedinUrl: "LinkedIn URL",
  instagramUrl: "Instagram URL",
  facebookUrl: "Facebook URL",
}

const OUTCOME_LABEL = { imported: "Imports", duplicate: "Duplicate", invalid: "Skipped" } as const

interface Loaded {
  fileName: string
  csv: string
  table: string[][]
  preview: LeadImportResult
}

export default function ImportPage() {
  const icp = useIcpParam()
  const { currentWorkspaceId, reloadLeads } = useStore()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [dragging, setDragging] = useState(false)
  const [checking, setChecking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!icp) return null

  const readFile = async (file: File) => {
    setError(null)
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("That file isn't a CSV. Export your list as .csv and try again.")
      return
    }
    const csv = await file.text()
    const table = parseCsv(csv)
    if (table.length < 2) {
      setError("We couldn't find any data rows. Check that the first row has column headers and the rest have leads.")
      return
    }
    setChecking(true)
    try {
      const preview = await importLeadsCsv(currentWorkspaceId, icp.id, csv, true)
      setLoaded({ fileName: file.name, csv, table, preview })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check the file. Try again.")
    } finally {
      setChecking(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void readFile(file)
  }

  const confirm = async () => {
    if (!loaded) return
    setImporting(true)
    try {
      const r = await importLeadsCsv(currentWorkspaceId, icp.id, loaded.csv, false)
      toast.success(`Imported ${r.imported} lead${r.imported === 1 ? "" : "s"} into ${icp.name}`)
      reloadLeads()
      router.push(`/icps/${icp.id}/leads`)
    } catch (e) {
      toast.error("Couldn't import them", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setImporting(false)
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div
          role="button"
          tabIndex={0}
          aria-disabled={checking}
          onClick={() => !checking && inputRef.current?.click()}
          onKeyDown={(e) => !checking && (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
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
          <p className="text-sm font-medium">{checking ? "Checking the file…" : "Drop a CSV here, or click to choose a file"}</p>
          <p className="text-xs text-muted-foreground">
            One lead per row with a header row. Each lead needs an email or a LinkedIn URL. Apollo exports work as they are.
          </p>
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
        <Button variant="link" className="px-0" onClick={() => void downloadTemplate("leads").catch((e) => toast.error(e.message))}>
          <Download /> Download template
        </Button>
      </div>
    )
  }

  const { preview, table } = loaded
  const [headers, ...rows] = table
  const emailCol = headers.findIndex((_, i) => preview.columns[i]?.field === "email")
  const nameCols = ["firstName", "lastName"].map((f) => preview.columns.findIndex((c) => c.field === f))
  const who = (row: number) => {
    const cells = rows[row - 2] ?? []
    const name = nameCols
      .filter((i) => i >= 0)
      .map((i) => cells[i]?.trim())
      .filter(Boolean)
      .join(" ")
    const email = emailCol >= 0 ? cells[emailCol]?.trim() : ""
    return [name, email].filter(Boolean).join(" · ") || `Row ${row}`
  }
  const summary: [string, number, boolean?][] = [
    ["Rows in file", preview.totalRows],
    ["Leads to import", preview.imported],
    ["Repeated in this file", preview.duplicatesInFile, preview.duplicatesInFile > 0],
    ["Already in this workspace", preview.duplicatesExisting, preview.duplicatesExisting > 0],
    ["Skipped (no email or LinkedIn)", preview.invalid, preview.invalid > 0],
    ["Websites taken from the email", preview.websitesFromEmail],
  ]
  const dropped = preview.totalRows - preview.imported

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLoaded(null)} disabled={importing}>
          <ArrowLeft /> Choose another file
        </Button>
        <span className="text-sm text-muted-foreground">{loaded.fileName}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Columns</CardTitle>
              <CardDescription>
                Matched from your headers. Columns that don&apos;t match a lead field are kept as custom fields, usable in
                prompts as <code className="font-mono text-xs">{"{{lead.extra.column}}"}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV column</TableHead>
                    <TableHead>Sample</TableHead>
                    <TableHead>Fills</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.columns.map((c, col) => (
                    <TableRow key={col}>
                      <TableCell className="font-medium">{c.column || `Column ${col + 1}`}</TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">
                        {rows.find((r) => r[col]?.trim())?.[col] ?? ""}
                      </TableCell>
                      <TableCell className={cn(!c.field && "text-muted-foreground")}>
                        {c.field ? (FIELD_LABEL[c.field] ?? c.field) : "Custom field"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rows</CardTitle>
              <CardDescription>
                {preview.rows.length > PREVIEW_ROWS
                  ? `The first ${PREVIEW_ROWS} of ${preview.rows.length} rows and what happens to each.`
                  : "Every row and what happens to it."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, PREVIEW_ROWS).map((r) => (
                    <TableRow key={r.row} className={cn(r.outcome !== "imported" && "text-muted-foreground")}>
                      <TableCell className="tabular-nums">{r.row}</TableCell>
                      <TableCell className="max-w-72 truncate">{who(r.row)}</TableCell>
                      <TableCell>
                        <Badge variant={r.outcome === "imported" ? "secondary" : "outline"} className="font-normal">
                          {OUTCOME_LABEL[r.outcome]}
                        </Badge>
                        {r.reason && <span className="ml-2 text-xs">{r.reason}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-4">
          <CardHeader>
            <CardTitle>Check before importing</CardTitle>
            <CardDescription>Nothing is fetched or written until you run it from the leads tab.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-1.5 text-sm">
              {summary.map(([label, value, warn]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={cn("text-right tabular-nums", warn && "text-amber-700 dark:text-amber-300")}>{value}</dd>
                </div>
              ))}
            </dl>
            {dropped > 0 && (
              <p className="text-xs text-muted-foreground">
                {dropped} row{dropped === 1 ? "" : "s"} won&apos;t be imported.
              </p>
            )}
            <Button className="w-full" disabled={importing || preview.imported === 0} onClick={() => void confirm()}>
              {importing ? "Importing…" : `Import ${preview.imported} lead${preview.imported === 1 ? "" : "s"}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
