import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith('/tournament/admin');
      const isOnLogin = nextUrl.pathname === '/login';

      // 1. If trying to access admin
      if (isOnAdmin) {
        if (isLoggedIn) return true;
        return false; // Automatically redirects to /login
      }

      // 2. Redirect logged-in users away from the login page
      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL('/tournament/admin', nextUrl));
      }

      // 3. Allow all other pages (including client-view /tournament)
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;