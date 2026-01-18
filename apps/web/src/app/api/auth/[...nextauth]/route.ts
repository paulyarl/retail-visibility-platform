import NextAuth, { NextAuthOptions } from 'next-auth';
import { applyRateLimit } from '@/lib/rate-limiting';

// Simplified auth configuration for now
// TODO: Implement full authentication with Prisma adapter when User model is ready
export const authOptions: NextAuthOptions = {
  providers: [],
  session: {
    strategy: 'jwt' as const,
  },
  secret: process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production',
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
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
