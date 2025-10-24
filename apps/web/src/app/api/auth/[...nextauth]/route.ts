import NextAuth, { NextAuthOptions } from 'next-auth';

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

export { handler as GET, handler as POST };
