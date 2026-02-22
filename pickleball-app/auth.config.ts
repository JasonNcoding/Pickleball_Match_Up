import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // 1. Logic for /tournament/admin (Protected)
      if (pathname.startsWith('/tournament/admin')) {
        if (isLoggedIn) return true;
        return false; // Redirects unauthenticated to /login
      }

      // 2. Logic to redirect base /tournament to /tournament/admin if logged in
      // This ensures authenticated users go straight to their dashboard
      if (pathname === '/tournament' && isLoggedIn) {
        return Response.redirect(new URL('/tournament/admin', nextUrl));
      }

      // 3. Logic for /login page
      if (pathname === '/login' && isLoggedIn) {
        return Response.redirect(new URL('/tournament/admin', nextUrl));
      }

      // 4. Default: Allow access (for public client views)
      return true;
    },
  },
  providers: [], 
} satisfies NextAuthConfig;