"use client"

import Link from "next/link"
import { notFound, usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { useIcpParam } from "@/hooks/use-icp"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "", label: "Definition" },
  { href: "/prompts", label: "Prompts" },
  { href: "/leads", label: "Leads", also: ["/import"] },
  { href: "/review", label: "Review" },
]

export default function IcpLayout({ children }: { children: ReactNode }) {
  const icp = useIcpParam()
  const pathname = usePathname()

  if (!icp) notFound()

  const base = `/icps/${icp.id}`
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Link href="/icps" className="text-muted-foreground hover:text-foreground" aria-label="Back to ICPs">
              <ChevronLeft className="size-4" />
            </Link>
            {icp.name}
          </span>
        }
        description={icp.description}
      />
      <nav className="flex gap-1 overflow-x-auto border-b px-4 md:px-6" aria-label="ICP sections">
        {TABS.map((tab) => {
          const href = base + tab.href
          const active =
            tab.href === ""
              ? pathname === base
              : pathname.startsWith(href) || (tab.also ?? []).some((p) => pathname.startsWith(base + p))
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                active
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      <div className="min-w-0 p-4 md:p-6">{children}</div>
    </>
  )
}
