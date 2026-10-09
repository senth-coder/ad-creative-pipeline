import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser,mayCreate,mayView } from '@/lib/permissions';
import { error,jsonBody } from '@/lib/api';
import { jobInclude,serializeJob } from '@/lib/serialize';
import { operationsSchema } from '@/lib/operations';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return error('Sign in required',401);
 const {id}=await params;const job=await db.job.findUnique({where:{id},include:jobInclude});if(!job)return error('Job not found',404);
 if(!await mayView(user,job)||user.role==='MEDIA_BUYER')return error('Not permitted',403);
 if(['APPROVED','DELIVERED'].includes(job.status))return error('Approved and delivered jobs are locked',409);
 const parsed=operationsSchema.safeParse(await jsonBody(request));if(!parsed.success)return error('Check the readiness fields');
 if(parsed.data.blockerReason&&(!parsed.data.blockerOwner||!parsed.data.blockedUntil))return error('A blocker needs an owner and follow-up date');
 try{const saved=await db.$transaction(async tx=>{
 const count=await tx.job.updateMany({where:{id,updatedAt:job.updatedAt},data:{operations:parsed.data}});if(count.count!==1)throw new Error('Job changed. Refresh and try again.');
 await tx.auditEvent.create({data:{jobId:id,actorId:user.id,action:'job.readiness.updated',after:parsed.data}});
 if(parsed.data.blockerReason)await tx.outboxEvent.create({data:{type:'job.blocked',payload:{jobId:id,clientId:job.clientId,reason:parsed.data.blockerReason,owner:parsed.data.blockerOwner,followUp:parsed.data.blockedUntil}}});
 return tx.job.findUniqueOrThrow({where:{id},include:jobInclude});});return NextResponse.json({job:serializeJob(saved)});
 }catch(e){return error((e as Error).message,409)}
}
