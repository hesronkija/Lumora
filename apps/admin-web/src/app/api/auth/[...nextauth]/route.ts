import NextAuth from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';
import type { NextAuthOptions } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      roles?: string[];
      tenantId?: string;
      tenantName?: string;
    };
  }
  interface JWT {
    accessToken?: string;
    roles?: string[];
    tenant_id?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env['NEXT_PUBLIC_KEYCLOAK_CLIENT_ID'] ?? 'lumora-admin-web',
      clientSecret: process.env['KEYCLOAK_CLIENT_SECRET'] ?? '',
      issuer: `${process.env['NEXT_PUBLIC_KEYCLOAK_URL']}/realms/${process.env['NEXT_PUBLIC_KEYCLOAK_REALM'] ?? 'lumora'}`,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        // Extract roles and tenant_id from the Keycloak JWT claims
        const claims = profile as Record<string, unknown> | undefined;
        token.roles = (claims?.['roles'] as string[]) ?? [];
        token.tenant_id = (claims?.['tenant_id'] as string) ?? '';
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.roles = (token.roles as string[]) ?? [];
      session.user.tenantId = token.tenant_id as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
