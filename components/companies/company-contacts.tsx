"use client"

import { useState } from "react"
import { Ban, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { type ExclusionReason, type PipelineCompany, addPerson, excludeCompany } from "@/lib/api"

export const EXCLUSION_REASON_LABEL: Record<ExclusionReason, string> = {
  current_client: "Current client",
  past_client: "Past client",
  do_not_contact: "Asked not to be contacted",
  competitor: "Competitor",
  other: "Other",
}

/** What the company's own site publishes for reaching them, and a way to make that a person (and a lead). */
export function CompanyContacts({ workspaceId, company }: { workspaceId: string; company: PipelineCompany }) {
  const contacts = company.research?.contacts
  const [adding, setAdding] = useState(false)
  if (!company.researchedAt) return <p className="text-[13px] text-muted-foreground">Research reads them from their website.</p>
  if (!contacts) return <p className="text-[13px] text-muted-foreground">Their website doesn&apos;t publish an email, phone or owner.</p>

  const others = contacts.all_emails.filter((e) => e !== contacts.email)
  const canAdd = !!contacts.email

  const add = async () => {
    const [first, ...rest] = (contacts.owner_name ?? "").split(" ")
    setAdding(true)
    try {
      const r = await addPerson(workspaceId, {
        icpId: company.icpId,
        firstName: first ?? "",
        lastName: rest.join(" "),
        title: contacts.owner_name ? "Owner" : "",
        company: company.name,
        email: contacts.email ?? "",
        linkedinUrl: "",
        website: company.domain ?? "",
      })
      toast.success(r.new ? `Added ${contacts.owner_name ?? contacts.email}` : `Updated ${contacts.owner_name ?? contacts.email}`, {
        description: r.leadCreated ? "They're a lead now, on the People and Leads pages." : "They're on the People page.",
      })
    } catch (e) {
      toast.error("Couldn't add them", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {contacts.email && (
          <>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 truncate font-medium">{contacts.email}</dd>
          </>
        )}
        {others.length > 0 && (
          <>
            <dt className="text-muted-foreground">Also</dt>
            <dd className="min-w-0 truncate text-[13px]">{others.join(", ")}</dd>
          </>
        )}
        {contacts.phone && (
          <>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{contacts.phone}</dd>
          </>
        )}
        {contacts.owner_name && (
          <>
            <dt className="text-muted-foreground">Owner</dt>
            <dd>
              {contacts.owner_name} <span className="text-[13px] text-muted-foreground">from {contacts.owner_name_source}</span>
            </dd>
          </>
        )}
      </dl>
      {canAdd && (
        <Button size="sm" variant="outline" disabled={adding} onClick={() => void add()}>
          <UserPlus /> {adding ? "Adding…" : `Add ${contacts.owner_name ?? contacts.email} as a person`}
        </Button>
      )}
    </div>
  )
}

/** Put the company on the do-not-contact list by every key it has. */
export function ExcludeCompanyDialog({
  workspaceId,
  company,
  onClose,
  onExcluded,
}: {
  workspaceId: string
  company: PipelineCompany
  onClose: () => void
  onExcluded: () => void
}) {
  const [reason, setReason] = useState<ExclusionReason>("do_not_contact")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await excludeCompany(workspaceId, company.id, reason, note)
      toast.success(`${company.name} is on the do-not-contact list`, { description: "It won't be found, made a lead or written to again." })
      onExcluded()
      onClose()
    } catch (e) {
      toast.error("Couldn't add it to the list", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md!">
        <DialogHeader>
          <DialogTitle>Never contact {company.name}?</DialogTitle>
          <DialogDescription>
            It goes on the do-not-contact list for every workspace, by its website, phone, Google listing and name with city. It
            won&apos;t be found again, its people won&apos;t become leads, and no email will be written to them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="exclude-reason">Why</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ExclusionReason)}>
              <SelectTrigger id="exclude-reason" className="w-full!">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXCLUSION_REASON_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exclude-note">Note (optional)</Label>
            <Textarea id="exclude-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void submit()}>
            <Ban /> {busy ? "Adding…" : "Add to do-not-contact list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
