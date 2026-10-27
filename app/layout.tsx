import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono-face",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Outreacher",
  description: "Personalized cold email from ICPs, enrichment and editable prompts",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Keep the sidebar collapsed or expanded across reloads (the sidebar writes this cookie on toggle).
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <StoreProvider>
              <SidebarProvider defaultOpen={sidebarOpen}>
                <AppSidebar />
                <SidebarInset className="min-w-0">
                  {children}
                </SidebarInset>
              </SidebarProvider>
            </StoreProvider>
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
