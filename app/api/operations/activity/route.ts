import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error} from '@/lib/api';
export async function GET(){
 const user=await currentUser();if(!user)return error('Sign in required',401);
 const jobScope=user.role==='MAKER'?{assigneeId:user.id}:user.role==='QA'?{client:{qaMembers:{some:{userId:user.id}}}}:{client:{mediaBuyerId:user.id}};
 const events=await db.auditEvent.findMany({where:mayCreate(user)?{}:{job:jobScope},include:{actor:{select:{name:true}},job:{select:{number:true,title:true}}},orderBy:{at:'desc'},take:100});
 return NextResponse.json({events:events.map(e=>({id:e.id,action:e.action,createdAt:e.at,actor:e.actor?.name||'Automation',job:e.job,reason:e.reason}))});
}
