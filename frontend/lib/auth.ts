"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

// Mirrors backend/app/api/auth.py's SessionResponse
// (knowledge-base/AUTH_AND_SECURITY.md §1/§2). With DEV_OVERRIDE=true,
// GET /auth/session reflects a static dev identity and NextAuth is never
// consulted. With DEV_OVERRIDE=false, real Google session state comes
// from NextAuth's useSession -- the backend independently verifies the
// forwarded id_token per-request rather than trusting this client state.
export interface SessionResponse {
  authenticated: boolean;
  userName: string | null;
  userEmail: string | null;
  devOverride: boolean;
}

interface RawSessionResponse {
  authenticated: boolean;
  user_name: string | null;
  user_email: string | null;
  dev_override: boolean;
}

export function useAuth() {
  const { data: nextAuthSession, status } = useSession();
  // A session with no idToken means the underlying Google id_token
  // expired and the session callback (auth.ts) deliberately stripped it
  // -- treat that the same as "no session" so AuthGate redirects to
  // /login for a clean re-auth, instead of every backend call 401ing
  // forever with no recovery (the id_token can't be silently refreshed;
  // only a fresh sign-in gets a new one).
  const hasValidSession = !!nextAuthSession?.idToken;

  // Ask the backend (the only place that knows whether DEV_OVERRIDE is
  // on -- a server-only env var, never reaches the client bundle).
  // Only enabled once we know there's no valid NextAuth session, so a
  // healthy Google sign-in never waits on this round-trip.
  const query = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const raw = await apiFetch<RawSessionResponse>("/auth/session");
      const session: SessionResponse = {
        authenticated: raw.authenticated,
        userName: raw.user_name,
        userEmail: raw.user_email,
        devOverride: raw.dev_override,
      };
      return session;
    },
    enabled: status !== "loading" && !hasValidSession,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // A real, non-expired NextAuth session is authoritative the moment it
  // exists -- trust it unconditionally rather than gating on the backend
  // call above. (Previously this waited on GET /auth/session to report
  // devOverride:false before trusting NextAuth; if that backend call
  // failed for any reason -- wrong API_URL, cold start, network blip --
  // a genuinely successful Google sign-in stayed stuck on /login
  // forever, since query.data never resolved. NextAuth's own session
  // cookie is enough signal on its own.)
  if (hasValidSession) {
    return {
      user: {
        authenticated: true,
        userName: nextAuthSession!.user?.name ?? null,
        userEmail: nextAuthSession!.user?.email ?? null,
        devOverride: false,
      },
      isLoading: false,
      isAuthenticated: true,
      error: null,
    };
  }

  return {
    user: query.data ?? null,
    isLoading: status === "loading" || query.isLoading,
    isAuthenticated: query.data?.authenticated ?? false,
    error: query.error,
  };
}

// For plain <a href> downloads (export CSV), which -- like EventSource --
// can't carry an Authorization header via browser navigation. Appends
// the id_token as a ?token= query param when a real session exists;
// returns the URL unchanged under DEV_OVERRIDE (no NextAuth session, so
// idToken is undefined and the backend's own bypass applies).
export function useAuthedUrl(url: string): string {
  const { data: session } = useSession();
  if (!session?.idToken) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(session.idToken)}`;
}

// The id_token to forward as a Bearer header on API calls, sourced from
// useSession() (verified working client-side) rather than next-auth/react's
// standalone getSession() -- see the comment in lib/api.ts's apiFetch for
// why that helper hangs in any deployed environment. undefined under
// DEV_OVERRIDE (no NextAuth session), which apiFetch treats as "send no
// Authorization header," matching the backend's own bypass.
export function useApiToken(): string | undefined {
  const { data: session } = useSession();
  return session?.idToken;
}

// True once useSession() has settled (no longer "loading"), for any
// data-fetching hook to gate on -- prevents a query firing on first
// render with no/stale token (status:"loading", data:undefined) under
// DEV_OVERRIDE=false, which the backend would reject and which then
// left the query's isLoading permanently misleading since the initial
// unauthenticated attempt, not the eventual authenticated one, decided
// the query's resolved state.
export function useAuthReady(): boolean {
  const { status } = useSession();
  return status !== "loading";
}
