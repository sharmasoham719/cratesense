"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";

// Dark mode default per knowledge-base/FRONTEND_DESIGN_SYSTEM.md §2 --
// reviewer/ops tools are commonly used in low-light contexts. Always
// starts dark regardless of OS preference (enableSystem off) -- the
// user's own toggle (ThemeToggle) is the only thing that switches it,
// and next-themes persists that choice in localStorage across visits.
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {children}
            <Toaster richColors closeButton />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
