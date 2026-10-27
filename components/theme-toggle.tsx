"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

/** A row for a sidebar menu; place it inside a SidebarMenu. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip="Toggle theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="h-8 text-[14px]"
      >
        <Sun className="text-muted-foreground dark:hidden" />
        <Moon className="hidden text-muted-foreground dark:block" />
        <span>Toggle theme</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
