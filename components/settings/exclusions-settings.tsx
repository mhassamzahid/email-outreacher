"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { EXCLUSION_REASON_LABEL } from "@/components/companies/company-contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type ExclusionKeyType, type ExclusionReason, addExclusion, fetchExclusions, removeExclusion, useApi } from "@/lib/api"
import { useAuth } from "@/lib/auth"

// What a person can type in; place ids and name-with-city come from "Never contact" on a company.
const TYPED: { value: ExclusionKeyType; label: string; placeholder: string }[] = [
  { value: "domain", label: "Website", placeholder: "inkco.com" },
  { value: "email", label: "Email", placeholder: "owner@inkco.com" },
  { value: "phone", label: "Phone", placeholder: "(312) 555-0100" },
]
const KEY_LABEL: Record<ExclusionKeyType, string> = {
  domain: "Website",
  email: "Email",
  phone: "Phone",
  place_id: "Google listing",
  name_location: "Name and city",
}

/** The do-not-contact list: never found, made a lead, or written to, in any workspace. */
export function ExclusionsSettings() {
  const { me } = useAuth()
  const canEdit = me?.role === "admin" || me?.role === "management"
  const list = useApi(fetchExclusions, [])
  const [keyType, setKeyType] = useState<ExclusionKeyType>("domain")
  const [value, setValue] = useState("")
  const [reason, setReason] = useState<ExclusionReason>("do_not_contact")
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!value.trim()) return
    setBusy(true)
    try {
      const added = await addExclusion({ keyType, value, reason })
      toast.success(`${added.keyValue} is on the list`)
      setValue("")
      list.reload()
    } catch (e) {
      toast.error("Couldn't add it", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string, label: string) => {
    try {
      await removeExclusion(id)
      toast.success(`${label} is off the list`)
      list.reload()
    } catch (e) {
      toast.error("Couldn't remove it", { description: e instanceof Error ? e.message : undefined })
    }
  }

  const rows = list.data ?? []
  const typed = TYPED.find((t) => t.value === keyType) ?? TYPED[0]

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_170px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="exclusion-type">Type</Label>
            <Select value={keyType} onValueChange={(v) => setKeyType(v as ExclusionKeyType)}>
              <SelectTrigger id="exclusion-type" className="w-full!">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPED.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exclusion-value">{typed.label}</Label>
            <Input id="exclusion-value" value={value} placeholder={typed.placeholder} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exclusion-reason">Why</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ExclusionReason)}>
              <SelectTrigger id="exclusion-reason" className="w-full!">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXCLUSION_REASON_LABEL).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy || !value.trim()}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </form>
      )}

      {list.error ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the list: {list.error}</p>
      ) : list.loading && !list.data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody&apos;s on it. Add current clients, competitors and anyone who asked not to be contacted.
        </p>
      ) : (
        <ul className="divide-y divide-rule rounded-md border">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{e.businessName || e.keyValue}</div>
                <div className="truncate text-[13px] text-muted-foreground">
                  {KEY_LABEL[e.keyType]}: {e.keyValue} · {EXCLUSION_REASON_LABEL[e.reason]}
                  {e.note ? ` · ${e.note}` : ""}
                </div>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Take ${e.keyValue} off the list`}
                  onClick={() => void remove(e.id, e.keyValue)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
