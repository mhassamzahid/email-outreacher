"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
          <span>Toggle theme</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
