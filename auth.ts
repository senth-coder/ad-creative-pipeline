import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/lib/db';
import {workspaceLogin} from '@/lib/login-policy';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({clientId: process.env.AUTH_GOOGLE_ID || '', clientSecret: process.env.AUTH_GOOGLE_SECRET || ''})],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({user,profile}) {
      const identity=workspaceLogin(user.email,profile?.email_verified,process.env.AUTH_ALLOWED_DOMAINS);
      if(!identity)return false;
      if(identity.autoEnroll){
        await db.user.upsert({where:{email:identity.email},update:{},create:{email:identity.email,name:user.name?.trim()||identity.email.split('@')[0],role:'MAKER'}});
        return true;
      }
      return Boolean(await db.user.findUnique({where:{email:identity.email},select:{id:true}}));
    }
  }
});
