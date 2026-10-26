"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIcpParam } from "@/hooks/use-icp"
import { fullDate } from "@/lib/format"
import { currentVersion, resolveTemplate } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import type { PromptKind } from "@/lib/types"

const DEFAULT = "__default__"

const COPY: Record<PromptKind, { title: string; description: string }> = {
  hook: {
    title: "Hook selection prompt",
    description: "Reads the lead's enrichment items and picks the single best hook, or none.",
  },
  email: {
    title: "Email writing prompt",
    description: "Writes the subject and body from the ICP, the lead and the chosen hook.",
  },
}

export default function IcpPromptsPage() {
  const icp = useIcpParam()
  const { templates, versions, updateIcp } = useStore()
  if (!icp) return null

  return (
    <div className="grid max-w-4xl gap-4 md:grid-cols-2">
      {(["hook", "email"] as const).map((kind) => {
        const field = kind === "hook" ? "hookPromptId" : "emailPromptId"
        const options = templates.filter((t) => t.kind === kind)
        const defaultTpl = options.find((t) => t.isDefault)
        const resolved = resolveTemplate(templates, icp, kind)
        const version = currentVersion(versions, resolved)
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle>{COPY[kind].title}</CardTitle>
              <CardDescription>{COPY[kind].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={icp[field] ?? DEFAULT}
                onValueChange={(value) => {
                  updateIcp(icp.id, { [field]: value === DEFAULT ? null : value })
                  toast.success(`${COPY[kind].title} updated`)
                }}
              >
                <SelectTrigger className="w-full!" aria-label={COPY[kind].title}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT}>Use default ({defaultTpl?.name})</SelectItem>
                  {options.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {resolved && version && (
                <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {resolved.name} <span className="font-normal text-muted-foreground">v{version.version}</span>
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/prompts/${resolved.id}`}>
                        Edit prompt <ExternalLink />
                      </Link>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {version.model}, temperature {version.temperature}, saved {fullDate(version.createdAt)}
                  </p>
                  <pre className="line-clamp-4 font-mono text-xs whitespace-pre-wrap text-muted-foreground">{version.userPrompt}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
