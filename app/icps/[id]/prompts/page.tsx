"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useIcpParam } from "@/hooks/use-icp"
import { fullDate } from "@/lib/format"
import { ICP_PROMPT_FIELD, type IcpPromptKind, currentVersion, resolveTemplate } from "@/lib/selectors"
import { useStore } from "@/lib/store"

const DEFAULT = "__default__"

const COPY: Record<IcpPromptKind, { title: string; description: string }> = {
  verify: {
    title: "Company verification",
    description: "Scores how well a researched company fits this ICP, from its website, Instagram and Apollo data.",
  },
  hook: {
    title: "Hook selection",
    description: "Reads a person's posts, pulls out the main points and picks the one to focus the email on.",
  },
  email: {
    title: "Email generation",
    description: "Writes the subject and body from this ICP, the person and the chosen hook.",
  },
}

export default function IcpPromptsPage() {
  const icp = useIcpParam()
  const { templates, versions, updateIcp, promptsStatus, promptsError, reloadPrompts } = useStore()
  if (!icp) return null

  if (promptsStatus === "error")
    return (
      <p className="text-sm text-destructive">
        Couldn&apos;t load prompts: {promptsError}{" "}
        <button type="button" className="underline" onClick={reloadPrompts}>
          Try again
        </button>
      </p>
    )

  return (
    <div className="grid max-w-6xl gap-4 lg:grid-cols-3">
      {(["verify", "hook", "email"] as const).map((kind) => {
        const field = ICP_PROMPT_FIELD[kind]
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
              {promptsStatus === "loading" ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={icp[field] ?? DEFAULT}
                  onValueChange={(value) =>
                    updateIcp(icp.id, { [field]: value === DEFAULT ? null : value }).then(
                      () => toast.success(`${COPY[kind].title} prompt updated`),
                      (e: unknown) => toast.error("Couldn't change it", { description: e instanceof Error ? e.message : undefined }),
                    )
                  }
                >
                  <SelectTrigger className="w-full!" aria-label={`${COPY[kind].title} prompt`}>
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
              )}
              {resolved && version && (
                <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">
                      {resolved.name} <span className="font-normal text-muted-foreground">v{version.version}</span>
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/prompts/${resolved.id}`}>
                        Edit prompt <ExternalLink />
                      </Link>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {version.model}, saved {fullDate(version.createdAt)}
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
