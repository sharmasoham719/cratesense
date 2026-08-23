"use client";

import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { AuthGate } from "@/components/auth-gate";
import { Topbar } from "@/components/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Global shell per knowledge-base/LAYOUT.md §2: identical on every route
// post-login. /login is the one route that renders standalone -- it's
// never wrapped in the topbar/sidebar chrome.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <AuthGate>{children}</AuthGate>;
  }

  return (
    <AuthGate>
      <SidebarProvider style={{ "--header-height": "3.5rem" } as React.CSSProperties}>
        <AppSidebar />
        <SidebarInset>
          <Topbar />
          <main className="@container mx-auto w-full max-w-(--breakpoint-2xl) flex-1 px-6 py-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthGate>
  );
}
