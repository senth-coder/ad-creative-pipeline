import { auth } from '@/auth';
import { db } from '@/lib/db';
import type { User } from '@prisma/client';

export async function currentUser(): Promise<User | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return email ? db.user.findUnique({where:{email}}) : null;
}
export function mayCreate(user: User) { return user.role==='ADMIN' || user.role==='STRATEGIST'; }
export function mayEdit(user: User, assigneeId: string | null) { return mayCreate(user) || (user.role==='MAKER' && user.id===assigneeId); }
export async function mayView(user: User, job: {clientId:string;assigneeId:string|null}) {
  if (mayCreate(user) || user.id===job.assigneeId) return true;
  if (user.role==='QA') return Boolean(await db.clientQa.findUnique({where:{clientId_userId:{clientId:job.clientId,userId:user.id}}}));
  if (user.role==='MEDIA_BUYER') {const client=await db.client.findUnique({where:{id:job.clientId}});return client?.mediaBuyerId===user.id;}
  return false;
}
