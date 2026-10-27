"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties } from "react"
import { FileText, Inbox, PanelLeftClose, Settings, Target, Users } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { formatUsd } from "@/lib/format"
import { generationByLead } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/** The product mark: an open ring with one message leaving it. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
      <path d="M19.5 9.2A8 8 0 1 0 20 12" fill="none" stroke="var(--data)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20.2" cy="5.6" r="2.4" fill="var(--data)" />
    </svg>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { generations, settings } = useStore()
  const toReview = Array.from(generationByLead(generations).values()).filter(
    (g) => g.status === "draft" || g.status === "edited",
  ).length
  const ratio = settings.spentThisMonthUsd / settings.monthlyBudgetUsd

  const nav = [
    { href: "/icps", label: "ICPs", icon: Target },
    { href: "/review", label: "Review", icon: Inbox, count: toReview, countLabel: `${toReview} drafts need review` },
    { href: "/leads", label: "Leads", icon: Users },
    { href: "/prompts", label: "Prompts", icon: FileText },
    { href: "/settings", label: "Settings", icon: Settings },
  ]

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-3 px-2 pt-3">
        <Link href="/icps" className="flex min-w-0 items-center gap-2.5 rounded-md px-1.5 py-1 group-data-[collapsible=icon]:px-1">
          <Mark />
          <span className="sidebar-reveal truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground group-data-[collapsible=icon]:hidden">
            Outreacher
          </span>
        </Link>
        <div
          className="sidebar-reveal flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] whitespace-nowrap group-data-[collapsible=icon]:hidden"
          style={{ "--i": 1 } as CSSProperties}
        >
          <span className="text-muted-foreground">Workspace</span>
          <span className="font-medium text-foreground">AheadTech360</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {nav.map(({ href, label, icon: Icon, count, countLabel }, i) => (
                <SidebarMenuItem key={href} style={{ "--i": i + 2 } as CSSProperties}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(href)}
                    tooltip={label}
                    className="h-8 text-[14px] data-[active=true]:font-medium"
                  >
                    <Link href={href}>
                      <Icon className="text-muted-foreground" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {!!count && (
                    <SidebarMenuBadge className="tabular-nums text-muted-foreground" title={countLabel} aria-label={countLabel}>
                      {count}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 px-2 pb-3">
        <Link
          href="/settings"
          className="sidebar-reveal space-y-1.5 rounded-md px-2 py-2 whitespace-nowrap transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden"
          style={{ "--i": 6 } as CSSProperties}
        >
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-muted-foreground">Spend this month</span>
            <span className="text-muted-foreground tabular-nums">{Math.round(ratio * 100)}%</span>
          </div>
          <div className="text-[13px] tabular-nums">
            <span className="font-medium text-foreground">{formatUsd(settings.spentThisMonthUsd)}</span>
            <span className="text-muted-foreground"> of {formatUsd(settings.monthlyBudgetUsd)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sidebar-accent">
            <div
              className={cn("h-full rounded-full", ratio >= 1 ? "bg-negative" : ratio >= 0.8 ? "bg-warning" : "bg-data")}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>
        </Link>
        <SidebarMenu className="gap-0.5">
          <ThemeToggle />
          <CollapseToggle />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

/** Collapses the sidebar to an icon rail, or pins it open again. Ctrl/⌘ B does the same.
 *  It is the last row of the footer so it stays under the pointer in every state. */
function CollapseToggle() {
  const { state, peek, toggleSidebar, isMobile } = useSidebar()
  if (isMobile) return null
  const collapsed = state === "collapsed"
  const label = !collapsed ? "Collapse sidebar" : peek ? "Keep sidebar open" : "Expand sidebar"
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={toggleSidebar} aria-expanded={!collapsed} tooltip={`${label} (Ctrl/⌘ B)`} className="h-8 text-[14px]">
        <PanelLeftClose
          className={cn(
            "text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            collapsed && !peek && "rotate-180",
          )}
        />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
