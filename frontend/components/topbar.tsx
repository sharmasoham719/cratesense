"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Activity, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useJobs } from "@/lib/jobs";

// Topbar per knowledge-base/LAYOUT.md §2: persistent, height driven by
// --header-height (not a hardcoded h-14) so it composes with the
// @container main content below. Wordmark + breadcrumb left, theme
// toggle + live job status badge + user menu right. The badge polls
// useJobs() (already the Dashboard/JobHistoryTable's data source, no new
// endpoint) so any currently-running job is visible and clickable from
// every screen, not just /jobs/[id].
export function Topbar() {
  const { user } = useAuth();
  const { data: jobs } = useJobs({ refetchInterval: 3000 });
  const runningJob = jobs?.find((j) => j.status === "running");
  // The expanded sidebar shows its own "CrateSense" wordmark right above
  // this one -- fade this copy out rather than showing it twice.
  const { state: sidebarState } = useSidebar();

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Link
        href="/"
        className={cn(
          "font-semibold tracking-tight transition-opacity duration-200",
          sidebarState === "expanded" && "pointer-events-none opacity-0"
        )}
      >
        CrateSense
      </Link>

      <div className="ml-auto flex items-center gap-1">
        {runningJob && (
          <>
            <Link
              href={`/jobs/${runningJob.id}`}
              className="border-primary/30 bg-accent-subtle text-primary hover:bg-primary/10 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
            >
              <span className="relative flex size-2">
                <span className="bg-primary motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" />
                <span className="bg-primary relative inline-flex size-2 rounded-full" />
              </span>
              <Activity className="size-3" />
              Enriching {runningJob.rowCount} row{runningJob.rowCount === 1 ? "" : "s"}
            </Link>
            <Separator orientation="vertical" className="mx-1 h-5" />
          </>
        )}
        <ThemeToggle />
        {user && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <DropdownMenu>
              <DropdownMenuTrigger
                className="hover:bg-accent flex items-center gap-2 rounded-md p-1"
                aria-label="User menu"
              >
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">
                    {user.userName?.slice(0, 2).toUpperCase() ?? "??"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 min-w-64">
                <DropdownMenuItem disabled className="flex-col items-start gap-0.5 whitespace-normal">
                  <span className="w-full truncate text-sm font-medium">{user.userName}</span>
                  <span className="text-muted-foreground w-full break-all text-xs">{user.userEmail}</span>
                </DropdownMenuItem>
                {!user.devOverride && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                      <LogOut />
                      Log out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </header>
  );
}
