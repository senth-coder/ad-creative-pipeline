import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({clientId: process.env.AUTH_GOOGLE_ID || '', clientSecret: process.env.AUTH_GOOGLE_SECRET || ''})],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({user,profile}) {
      const email = user.email?.toLowerCase();
      if (!email || profile?.email_verified !== true) return false;
      const domains = (process.env.AUTH_ALLOWED_DOMAINS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      if (domains.length && !domains.includes(email.split('@')[1])) return false;
      return Boolean(await db.user.findUnique({where:{email},select:{id:true}}));
    }
  }
});
