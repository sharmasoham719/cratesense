// Backend API base URL, per knowledge-base/APPLICATION_ARCHITECTURE.md §5.
// The browser (not the frontend container) makes these calls, so this
// must be a host-reachable URL, not the internal compose service name.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Forwards the Google id_token as a Bearer token when a real NextAuth
// session exists (knowledge-base/AUTH_AND_SECURITY.md §2 -- the backend
// verifies this independently, never trusting the frontend's claim).
// The token is passed in explicitly by the caller (via useSession(),
// which works correctly) rather than fetched here via next-auth/react's
// standalone getSession() -- that helper resolves __NEXTAUTH.baseUrl from
// the server-only NEXTAUTH_URL env var, which is unset in the browser
// bundle and falls back to a hardcoded http://localhost:3000, so in any
// deployed (non-localhost) environment it silently fetches the visitor's
// own loopback address and hangs forever. See lib/auth.ts's useApiToken.
export async function apiFetch<T>(path: string, init?: RequestInit, idToken?: string): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...init?.headers,
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }

  return res.json() as Promise<T>;
}
