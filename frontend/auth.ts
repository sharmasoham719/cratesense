import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Real Google OAuth per knowledge-base/AUTH_AND_SECURITY.md §2. Only
// provider configured (Google-only requirement, no credential form).
// The Google-issued id_token is carried through the JWT session so the
// frontend can forward it to the backend as a Bearer token -- the
// backend verifies it independently against Google's public keys
// (backend/app/api/auth.py), never trusting the frontend's session claim.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  // Required behind Docker/Render's reverse proxy -- NextAuth can't
  // reliably auto-detect the host otherwise (Auth.js docs: "trustHost").
  trustHost: true,
  callbacks: {
    async jwt({ token, account }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
        // Google id_tokens are short-lived (~1h) and, unlike access
        // tokens, can't be silently refreshed -- a new one only comes
        // from a fresh sign-in. Track its real expiry (exp claim, not
        // NextAuth's own longer-lived JWT session) so the session
        // callback can stop handing out an expired token once it lapses,
        // rather than every backend call 401ing forever with no
        // recovery path (this previously left the whole app stuck on
        // loading skeletons: React Query kept retrying the same expired
        // token, the backend correctly rejected it every time, and
        // nothing ever prompted a re-login).
        token.idTokenExpiresAt = account.expires_at ? account.expires_at * 1000 : undefined;
      }
      return token;
    },
    async session({ session, token }) {
      const expired = typeof token.idTokenExpiresAt === "number" && Date.now() >= token.idTokenExpiresAt;
      if (token.idToken && !expired) {
        session.idToken = token.idToken as string;
      }
      // else: leave session.idToken unset -- useAuth()/AuthGate treat a
      // session with no idToken the same as no session, redirecting to
      // /login for a clean re-auth rather than hanging on stale-token 401s.
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
