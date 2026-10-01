import { PrismaClient } from '@prisma/client';
const db=new PrismaClient();
const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
const name=process.env.BOOTSTRAP_ADMIN_NAME?.trim();
if(!email||!name||!process.env.DATABASE_URL){console.error('Set DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_NAME');process.exit(1)}
try{
 const admin=await db.user.upsert({where:{email},create:{email,name,role:'ADMIN'},update:{name,role:'ADMIN'}});
 console.log(`Admin ready: ${admin.email}`);
}finally{await db.$disconnect()}
