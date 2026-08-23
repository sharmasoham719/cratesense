"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Boxes } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

// Google's official multi-color "G" mark, per Google's brand guidelines
// for sign-in buttons (flat SVG, not a lucide icon -- lucide has no
// brand-color Google logo).
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14.1-5.2l-6.5-5.5C29.4 35.1 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.6 5C9.8 39.6 16.3 44 24 44z" />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.5 5.5C39.5 37.1 44 31.4 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

// Real Google OAuth per knowledge-base/AUTH_AND_SECURITY.md §2. With
// DEV_OVERRIDE=true (the default), the user is already authenticated and
// never actually sees this page -- AuthGate redirects them straight
// through. This page only renders when DEV_OVERRIDE=false and there is
// genuinely no session yet, and offers the real Google sign-in button.
export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-xl">
            <Boxes className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">CrateSense</h1>
        </div>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Checking session…</p>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">Sign in with your Google account to continue.</p>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => signIn("google", { callbackUrl: "/" })}
            >
              <GoogleIcon />
              Sign in with Google
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
