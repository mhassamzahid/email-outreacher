"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Mail, Settings, Target, Users } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

const NAV = [
  { href: "/icps", label: "ICPs", icon: Target },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/prompts", label: "Prompts", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/icps">
                <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Mail className="size-4" />
                </div>
                <div className="grid text-left leading-tight">
                  <span className="text-sm font-semibold">Outreacher</span>
                  <span className="text-xs text-muted-foreground">Personalized email</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(href)} tooltip={label}>
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  )
}
