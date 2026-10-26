"use client"

import Link from "next/link"
import { FileText } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { TableSkeleton } from "@/components/table-skeleton"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMockLoading } from "@/hooks/use-mock-loading"
import { shortDate } from "@/lib/format"
import { icpsUsingTemplate } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import type { PromptKind } from "@/lib/types"

const SECTIONS: { kind: PromptKind; title: string; description: string }[] = [
  { kind: "hook", title: "Hook selection", description: "Picks the best piece of a lead's content to open with, or none." },
  { kind: "email", title: "Email writing", description: "Writes the subject and body from the ICP, the lead and the hook." },
]

export default function PromptsPage() {
  const { templates, versions, icps } = useStore()
  const loading = useMockLoading()

  return (
    <>
      <PageHeader title="Prompts" description="Every template is versioned. Open one to edit, test and compare versions." />
      <div className="space-y-8 p-4 md:p-6">
        {SECTIONS.map(({ kind, title, description }) => {
          const list = templates.filter((t) => t.kind === kind)
          return (
            <section key={kind} className="space-y-2">
              <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              {loading ? (
                <TableSkeleton rows={2} />
              ) : list.length === 0 ? (
                <EmptyState icon={FileText} title={`No ${title.toLowerCase()} prompts`} />
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Used by</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((t) => {
                        const v = versions.find((x) => x.id === t.currentVersionId)
                        const count = versions.filter((x) => x.templateId === t.id).length
                        const usedBy = icpsUsingTemplate(icps, t)
                        return (
                          <TableRow key={t.id}>
                            <TableCell>
                              <Link href={`/prompts/${t.id}`} className="font-medium hover:underline">
                                {t.name}
                              </Link>
                              {t.isDefault && (
                                <Badge variant="secondary" className="ml-2">
                                  Default
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground tabular-nums">
                              v{v?.version} <span className="text-xs">({count} total)</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{v?.model}</TableCell>
                            <TableCell>
                              {usedBy.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {usedBy.map((icp) => (
                                    <Link key={icp.id} href={`/icps/${icp.id}/prompts`}>
                                      <Badge variant="outline" className="font-normal">
                                        {icp.name}
                                      </Badge>
                                    </Link>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not used</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {v && shortDate(v.createdAt)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
