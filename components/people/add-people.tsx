"use client"

import { useState } from "react"
import { Download, FileUp, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  type ApiIcp,
  type PeopleImportResult,
  type PersonInput,
  downloadTemplate,
  addPerson,
  importPeople,
} from "@/lib/api"

const NO_ICP = "__none__"
const FIELD_LABEL: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  title: "Title",
  company: "Company",
  email: "Email",
  email_status: "Email status",
  seniority: "Seniority",
  linkedin_url: "LinkedIn",
  website: "Website",
  company_linkedin_url: "Company LinkedIn",
  facebook_url: "Facebook",
  twitter_url: "X",
  city: "City",
  state: "State",
  country: "Country",
  phone: "Phone",
  apollo_contact_id: "Apollo id",
  apollo_account_id: "Apollo company id",
}

function IcpPicker({ icps, value, onChange, id }: { icps: ApiIcp[]; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>ICP</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full!">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_ICP}>Their company&apos;s ICP, if it&apos;s in the pipeline</SelectItem>
          {icps.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Emails are written with this ICP&apos;s prompts and notes.</p>
    </div>
  )
}

/** Add one person by hand. With an email or LinkedIn URL they become a lead straight away. */
export function AddPersonDialog({
  workspaceId,
  icps,
  onClose,
  onAdded,
}: {
  workspaceId: string
  icps: ApiIcp[]
  onClose: () => void
  onAdded: () => void
}) {
  const [icp, setIcp] = useState(NO_ICP)
  const [form, setForm] = useState<Omit<PersonInput, "icpId">>({
    firstName: "",
    lastName: "",
    title: "",
    company: "",
    email: "",
    linkedinUrl: "",
    website: "",
  })
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const missingName = !form.firstName.trim() && !form.lastName.trim()
  const missingContact = !form.email.trim() && !form.linkedinUrl.trim() && !form.company.trim() && !form.website.trim()

  const save = async () => {
    setTouched(true)
    if (missingName || missingContact) return
    setBusy(true)
    try {
      const r = await addPerson(workspaceId, { ...form, icpId: icp === NO_ICP ? null : icp })
      toast.success(r.new ? `Added ${form.firstName || form.lastName}` : `Updated ${form.firstName || form.lastName}`, {
        description:
          [r.leadCreated ? "Now a lead." : "", r.companyName ? `Linked to ${r.companyName}.` : ""].filter(Boolean).join(" ") ||
          undefined,
      })
      onAdded()
      onClose()
    } catch (e) {
      toast.error("Couldn't add them", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof typeof form, label: string, placeholder = "", type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`person-${key}`}>{label}</Label>
      <Input id={`person-${key}`} type={type} placeholder={placeholder} value={form[key]} onChange={set(key)} />
    </div>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg!">
        <DialogHeader>
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>
            With an email or a LinkedIn URL they become a lead straight away. They&apos;re linked to their company if it&apos;s in
            the pipeline (same website or name).
          </DialogDescription>
        </DialogHeader>
        <form
          id="add-person"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {field("firstName", "First name")}
            {field("lastName", "Last name")}
            {field("title", "Title", "Owner")}
            {field("company", "Company")}
            {field("email", "Email", "", "email")}
            {field("website", "Company website", "company.com")}
          </div>
          {field("linkedinUrl", "LinkedIn URL", "linkedin.com/in/…")}
          <IcpPicker icps={icps} value={icp} onChange={setIcp} id="person-icp" />
          {touched && missingName && <p className="text-sm text-destructive">Add a first or last name.</p>}
          {touched && missingContact && <p className="text-sm text-destructive">Add an email, a LinkedIn URL, a company or a website.</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-person" disabled={busy}>
            <UserPlus /> {busy ? "Adding…" : "Add person"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Import people from a CSV in Apollo's export format: preview first, then import. */
export function ImportPeopleDialog({
  workspaceId,
  icps,
  onClose,
  onImported,
}: {
  workspaceId: string
  icps: ApiIcp[]
  onClose: () => void
  onImported: () => void
}) {
  const [icp, setIcp] = useState(NO_ICP)
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [preview, setPreview] = useState<PeopleImportResult | null>(null)
  const [failure, setFailure] = useState("")
  const [busy, setBusy] = useState("")
  const icpId = icp === NO_ICP ? null : icp

  const check = async (text: string) => {
    setBusy("check")
    setFailure("")
    setPreview(null)
    try {
      setPreview(await importPeople(workspaceId, text, icpId, true))
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "The file couldn't be read.")
    } finally {
      setBusy("")
    }
  }

  const pick = async (f: File | undefined) => {
    if (!f) return
    const text = await f.text()
    setFile({ name: f.name, text })
    void check(text)
  }

  const run = async () => {
    if (!file) return
    setBusy("import")
    try {
      const r = await importPeople(workspaceId, file.text, icpId, false)
      toast.success(`Imported ${r.added + r.updated} ${r.added + r.updated === 1 ? "person" : "people"}`, {
        description: [
          r.updated ? `${r.added} new, ${r.updated} already here and updated.` : "",
          r.leadsCreated ? `${r.leadsCreated} became leads.` : "",
          r.errors.length ? `${r.errors.length} rows skipped.` : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      })
      onImported()
      onClose()
    } catch (e) {
      toast.error("Couldn't import them", { description: e instanceof Error ? e.message : undefined })
      setBusy("")
    }
  }

  const unused = preview ? Object.keys(FIELD_LABEL).filter((f) => !Object.values(preview.columns).includes(f)) : []

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl!">
        <DialogHeader>
          <DialogTitle>Import people from a CSV</DialogTitle>
          <DialogDescription>
            Use Apollo&apos;s people export as it is, or the template, which has the same columns. Anyone with an email or a
            LinkedIn URL becomes a lead. People already here (same Apollo id, LinkedIn or email) are updated, not added twice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={() => void downloadTemplate("people").catch((e) => toast.error(e.message))}>
            <Download /> Download the template
          </Button>
          <IcpPicker icps={icps} value={icp} onChange={setIcp} id="import-icp" />
          <div className="space-y-1.5">
            <Label htmlFor="import-file">CSV file</Label>
            <Input id="import-file" type="file" accept=".csv,text/csv" onChange={(e) => void pick(e.target.files?.[0])} />
          </div>

          {busy === "check" && <p className="text-sm text-muted-foreground">Reading {file?.name}…</p>}
          {failure && <p className="text-sm text-destructive">{failure}</p>}
          {preview && (
            <div className="space-y-2 rounded-md border px-3 py-3 text-sm">
              <p className="font-medium tabular-nums">
                {preview.valid} {preview.valid === 1 ? "person" : "people"} ready to import
                {preview.totalRows > preview.valid ? ` of ${preview.totalRows} rows` : ""}
              </p>
              <ul className="space-y-0.5 text-[13px] text-muted-foreground tabular-nums">
                <li>{preview.linkedToCompanies} match a company in the pipeline</li>
                {preview.duplicatesInFile > 0 && <li>{preview.duplicatesInFile} repeated in the file, imported once</li>}
                {preview.errors.length > 0 && <li>{preview.errors.length} rows can&apos;t be used (below)</li>}
              </ul>
              <p className="text-xs text-muted-foreground">
                Columns used: {Object.values(preview.columns).map((f) => FIELD_LABEL[f] ?? f).join(", ")}.
                {unused.includes("email") && unused.includes("linkedin_url")
                  ? " No email or LinkedIn column, so nobody becomes a lead yet."
                  : ""}{" "}
                Other columns are kept with each person.
              </p>
              {preview.errors.length > 0 && (
                <ul className="max-h-32 overflow-y-auto text-xs text-destructive">
                  {preview.errors.slice(0, 50).map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={!!busy}>
            Cancel
          </Button>
          <Button disabled={!preview || preview.valid === 0 || !!busy} onClick={() => void run()}>
            <FileUp /> {busy === "import" ? "Importing…" : preview ? `Import ${preview.valid}` : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
