import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser, mayCreate, mayView } from '@/lib/permissions';
import { error, jsonBody } from '@/lib/api';
import { jobInclude, serializeJob } from '@/lib/serialize';

const editSchema=z.object({assignee:z.string().trim().optional(),due:z.iso.date().optional(),reviewUrl:z.union([z.url(),z.literal('')]).optional()});
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const user=await currentUser();if(!user)return error('Sign in required',401);
 const {id}=await params;const job=await db.job.findUnique({where:{id},include:jobInclude});if(!job)return error('Job not found',404);if(!await mayView(user,job))return error('Not permitted',403);
 return NextResponse.json({job:serializeJob(job)});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
 const user=await currentUser();if(!user)return error('Sign in required',401);
 const {id}=await params;const existing=await db.job.findUnique({where:{id},include:jobInclude});if(!existing)return error('Job not found',404);
 const parsed=editSchema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid update');const data=parsed.data;
 const strategic=data.assignee!==undefined||data.due!==undefined;
 if(strategic&&!mayCreate(user))return error('Only a strategist can assign makers or change due dates',403);
 if(data.reviewUrl!==undefined&&!mayCreate(user)&&!(user.role==='MAKER'&&existing.assigneeId===user.id))return error('Not permitted',403);
 if(existing.status==='DELIVERED')return error('Delivered jobs are locked',409);
 const assignee=data.assignee===undefined?undefined:data.assignee?await db.user.findFirst({where:{name:data.assignee,role:'MAKER'}}):null;
 if(data.assignee && !assignee)return error('Unknown maker');
 const updated=await db.$transaction(async tx=>{
   const job=await tx.job.update({where:{id},data:{assigneeId:assignee===undefined?undefined:assignee?.id||null,dueAt:data.due?new Date(data.due+'T12:00:00Z'):undefined,reviewUrl:data.reviewUrl},include:jobInclude});
   await tx.auditEvent.create({data:{jobId:id,actorId:user.id,action:'job.updated',before:{assigneeId:existing.assigneeId,dueAt:existing.dueAt.toISOString(),reviewUrl:existing.reviewUrl},after:{assigneeId:job.assigneeId,dueAt:job.dueAt.toISOString(),reviewUrl:job.reviewUrl}}});
   if(assignee!==undefined&&assignee?.id!==existing.assigneeId)await tx.outboxEvent.create({data:{type:'job.assigned',payload:{jobId:id,assigneeId:assignee?.id}}});
   return job;
 });
 return NextResponse.json({job:serializeJob(updated)});
}
