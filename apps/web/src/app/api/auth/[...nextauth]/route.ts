import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { applyRateLimit } from '@/lib/rate-limiting';

// Auth configuration with credentials provider
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // This is a placeholder - in production, you'd validate against your database
        // For now, we'll accept any email/password for demo purposes
        if (credentials?.email && credentials?.password) {
          // TODO: Implement actual user validation against database
          // For demo, return a mock user
          return {
            id: 'demo-user',
            email: credentials.email,
            name: 'Demo User',
            role: 'user',
          };
        }
        return null;
      }
    })
  ],
  session: {
    strategy: 'jwt' as const,
  },
  secret: process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production',
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub || '';
        session.user.role = token.role || 'user';
        session.user.tenants = token.tenants;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

// Wrapper function to apply rate limiting with warning mode for auth routes
async function rateLimitedHandler(request: Request, method: 'GET' | 'POST') {
  // Apply rate limiting (warning mode for /api/auth)
  const rateLimitResponse = await applyRateLimit(request as any);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Continue with normal auth handling
  return handler(request as any);
}

export async function GET(request: Request) {
  return rateLimitedHandler(request, 'GET');
}

export async function POST(request: Request) {
  return rateLimitedHandler(request, 'POST');
}
