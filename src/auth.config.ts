import type { NextAuthConfig } from 'next-auth';
import type { Role } from '@/generated/prisma/enums';

/**
 * إعدادات صالحة للـ Edge runtime (بدون Prisma / bcrypt).
 * تُستخدم في middleware.ts لحماية المسارات.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.name = user.name ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
