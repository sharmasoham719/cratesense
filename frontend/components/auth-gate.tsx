"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";

// Route protection per knowledge-base/AUTH_AND_SECURITY.md §2/§3: every
// route except /login requires a session (or DEV_OVERRIDE). Real Google
// OAuth is stubbed for v1 -- with DEV_OVERRIDE=true (the default per
// .env.example), GET /auth/session always returns an authenticated dev
// identity and this gate never redirects.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (pathname === "/login" || isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [pathname, isLoading, isAuthenticated, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
