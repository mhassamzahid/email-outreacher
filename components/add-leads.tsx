"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, type ReactNode } from "react"
import { ChevronDown, Download, Plus, Upload, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fullName } from "@/lib/format"
import { EMAIL_PATTERN, createLead, downloadLeadTemplate, websiteFromEmail, type LeadField } from "@/lib/import"
import { useStore } from "@/lib/store"

/** "Add leads" menu: import a CSV or add one lead by hand. Without an ICP it asks which one. */
export function AddLeadsMenu({ icpId, variant = "outline" }: { icpId?: string; variant?: "default" | "outline" }) {
  const { icps } = useStore()
  const router = useRouter()
  const [manualOpen, setManualOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant}>
            <Plus /> Add leads <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {icpId ? (
            <DropdownMenuItem asChild>
              <Link href={`/icps/${icpId}/import`}>
                <Upload /> Import CSV
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={icps.length === 0}>
                <Upload /> Import CSV into
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-w-72">
                {icps.map((icp) => (
                  <DropdownMenuItem key={icp.id} onSelect={() => router.push(`/icps/${icp.id}/import`)}>
                    <span className="truncate">{icp.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuItem onSelect={() => setManualOpen(true)} disabled={icps.length === 0}>
            <UserPlus /> Add manually
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={downloadLeadTemplate}>
            <Download /> Download CSV template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {manualOpen && <AddLeadDialog icpId={icpId} onClose={() => setManualOpen(false)} />}
    </>
  )
}

type Fields = Record<LeadField, string>

const EMPTY: Fields = {
  firstName: "",
  lastName: "",
  email: "",
  company: "",
  title: "",
  website: "",
  linkedinUrl: "",
  instagramUrl: "",
  facebookUrl: "",
}

function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: ReactNode
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

export function AddLeadDialog({ icpId: fixedIcpId, onClose }: { icpId?: string; onClose: () => void }) {
  const { icps, leads, addLeads } = useStore()
  const [icpId, setIcpId] = useState(fixedIcpId ?? (icps.length === 1 ? icps[0].id : ""))
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [extras, setExtras] = useState<{ key: string; value: string }[]>([])
  const [touched, setTouched] = useState<Partial<Record<"email" | "icp", boolean>>>({})
  const firstRef = useRef<HTMLInputElement>(null)

  const icp = icps.find((i) => i.id === icpId)
  const email = fields.email.trim().toLowerCase()
  const duplicate = !!icpId && !!email && leads.some((l) => l.icpId === icpId && l.email.toLowerCase() === email)
  const errors = {
    email: !email
      ? "Add an email address. It's how leads are matched and deduplicated."
      : !EMAIL_PATTERN.test(email)
        ? "That doesn't look like an email address. Check for a missing @ or domain."
        : duplicate
          ? `This email is already a lead in ${icp?.name}.`
          : "",
    icp: icpId ? "" : "Choose which ICP this lead belongs to.",
    extras: extras.some((x) => x.value.trim() && !x.key.trim()) ? "Give each custom field a name." : "",
  }
  const valid = !errors.email && !errors.icp && !errors.extras
  const derived = !fields.website.trim() && EMAIL_PATTERN.test(email) ? websiteFromEmail(email) : ""

  const set = (key: LeadField) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }))

  const submit = (addAnother: boolean) => {
    setTouched({ email: true, icp: true })
    if (!valid || !icp) return
    const extra = Object.fromEntries(
      extras.filter((x) => x.key.trim() && x.value.trim()).map((x) => [x.key.trim(), x.value.trim()]),
    )
    const { lead } = createLead(fields, extra, icp.id)
    addLeads([lead])
    toast.success(`Added ${fullName(lead) || lead.email} to ${icp.name}`)
    if (addAnother) {
      setFields(EMPTY)
      setExtras([])
      setTouched({})
      firstRef.current?.focus()
    } else {
      onClose()
    }
  }

  const input = (key: LeadField, props: React.ComponentProps<typeof Input> = {}) => (
    <Input id={`lead-${key}`} value={fields[key]} onChange={set(key)} autoComplete="off" {...props} />
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl!">
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>
            {icp && fixedIcpId ? `Goes into ${icp.name} as Not enriched.` : "The lead starts as Not enriched, ready for enrichment."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit(false)
          }}
        >
          {!fixedIcpId && (
            <Field id="lead-icp" label="ICP" error={touched.icp ? errors.icp : ""} className="sm:col-span-2">
              <Select
                value={icpId}
                onValueChange={(v) => {
                  setIcpId(v)
                  setTouched((t) => ({ ...t, icp: true }))
                }}
              >
                <SelectTrigger id="lead-icp" className="w-full!" aria-invalid={(touched.icp && !!errors.icp) || undefined}>
                  <SelectValue placeholder="Choose an ICP" />
                </SelectTrigger>
                <SelectContent>
                  {icps.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field id="lead-firstName" label="First name">
            {input("firstName", { ref: firstRef, autoFocus: true })}
          </Field>
          <Field id="lead-lastName" label="Last name">
            {input("lastName")}
          </Field>
          <Field id="lead-email" label="Email" error={touched.email ? errors.email : ""} className="sm:col-span-2">
            {input("email", {
              type: "email",
              inputMode: "email",
              required: true,
              placeholder: "name@company.com",
              onBlur: () => setTouched((t) => ({ ...t, email: true })),
              "aria-invalid": (touched.email && !!errors.email) || undefined,
              "aria-describedby": "lead-email-note",
            })}
          </Field>
          <Field id="lead-company" label="Company">
            {input("company")}
          </Field>
          <Field id="lead-title" label="Job title">
            {input("title")}
          </Field>
          <Field
            id="lead-website"
            label="Website"
            className="sm:col-span-2"
            hint={
              fields.website.trim()
                ? undefined
                : derived
                  ? `Left blank, it will be ${derived.replace("https://", "")} from the email domain.`
                  : EMAIL_PATTERN.test(email)
                    ? "Free email address, so no website is filled in."
                    : "Left blank, it's taken from the email domain."
            }
          >
            {input("website", { placeholder: "company.com", "aria-describedby": "lead-website-note" })}
          </Field>
          <Field id="lead-linkedinUrl" label="LinkedIn URL" className="sm:col-span-2">
            {input("linkedinUrl", { placeholder: "linkedin.com/in/…" })}
          </Field>
          <Field id="lead-instagramUrl" label="Instagram URL">
            {input("instagramUrl", { placeholder: "instagram.com/…" })}
          </Field>
          <Field id="lead-facebookUrl" label="Facebook URL">
            {input("facebookUrl", { placeholder: "facebook.com/…" })}
          </Field>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Custom fields</span>
              <span className="text-xs text-muted-foreground">
                Usable in prompts as <code className="font-mono">{"{{lead.extra.name}}"}</code>
              </span>
            </div>
            {extras.map((x, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label={`Custom field ${i + 1} name`}
                  placeholder="Name, e.g. city"
                  value={x.key}
                  onChange={(e) => setExtras((list) => list.map((y, j) => (j === i ? { ...y, key: e.target.value } : y)))}
                  className="w-2/5!"
                />
                <Input
                  aria-label={`Custom field ${i + 1} value`}
                  placeholder="Value"
                  value={x.value}
                  onChange={(e) => setExtras((list) => list.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove custom field ${i + 1}`}
                  onClick={() => setExtras((list) => list.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              </div>
            ))}
            {errors.extras && <p className="text-xs text-destructive">{errors.extras}</p>}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() => setExtras((list) => [...list, { key: "", value: "" }])}
            >
              <Plus /> Add custom field
            </Button>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={() => submit(true)}>
              Add and start another
            </Button>
            <Button type="submit">Add lead</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
