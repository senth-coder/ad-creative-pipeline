import {wakeWorker} from '@/lib/worker-wake';
import {Prisma} from '@prisma/client';
import {sharedFields,typeFields,requiredBriefProblem,type BriefField} from '@/lib/templates';
import {operationsFor} from '@/lib/operations';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser, mayCreate, mayView } from '@/lib/permissions';
import { error, jsonBody } from '@/lib/api';
import { jobInclude, serializeJob } from '@/lib/serialize';

const editSchema=z.object({brief:z.record(z.string(),z.string()).optional(),title:z.string().trim().min(2).max(160).optional(),expectedUpdatedAt:z.string().optional(),assignee:z.string().trim().optional(),due:z.iso.date().optional(),reviewUrl:z.union([z.url().refine(v=>/^https?:\/\//i.test(v)),z.literal('')]).optional()});
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const user=await currentUser();if(!user)return error('Sign in required',401);
 const {id}=await params;const job=await db.job.findUnique({where:{id},include:jobInclude});if(!job)return error('Job not found',404);if(!await mayView(user,job))return error('Not permitted',403);
 return NextResponse.json({job:serializeJob(job)});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
 const user=await currentUser();if(!user)return error('Sign in required',401);
 const {id}=await params;const existing=await db.job.findUnique({where:{id},include:jobInclude});if(!existing)return error('Job not found',404);
 const parsed=editSchema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid update');const data=parsed.data;
 const strategic=data.assignee!==undefined||data.due!==undefined||data.brief!==undefined||data.title!==undefined;
 if(strategic&&!mayCreate(user))return error('Only a strategist can assign makers or change due dates',403);
 if(data.reviewUrl!==undefined&&!mayCreate(user)&&!(user.role==='MAKER'&&existing.assigneeId===user.id))return error('Not permitted',403);
 if(['APPROVED','DELIVERED'].includes(existing.status))return error('Approved and delivered jobs are locked',409);
 if(data.reviewUrl!==undefined&&data.reviewUrl!==existing.reviewUrl&&['INTERNAL_REVIEW','CLIENT_REVIEW'].includes(existing.status))return error('Use Changes Required before replacing a review link',409);
 if((data.brief||data.title)&&!['BRIEFED','IN_PRODUCTION'].includes(existing.status))return error('Use Changes Required before editing the brief',409);
 if(data.brief){const fields=(existing.templateSnapshot as BriefField[]|null)||[...sharedFields,...typeFields[existing.type as keyof typeof typeFields]];const issue=requiredBriefProblem(fields,data.brief);if(issue)return error(issue);}
 if(data.expectedUpdatedAt&&data.expectedUpdatedAt!==existing.updatedAt.toISOString())return error('Job changed. Refresh first.',409);
 const matches=data.assignee?await db.user.findMany({where:{name:data.assignee,role:'MAKER'},take:2}):[];if(matches.length>1)return error('More than one maker has this name. Use distinct display names in Settings.');
 const assignee=data.assignee===undefined?undefined:matches[0]||null;
 if(data.assignee && !assignee)return error('Unknown maker');
 try{const updated=await db.$transaction(async tx=>{
   const count=await tx.job.updateMany({where:{id,status:existing.status,updatedAt:existing.updatedAt},data:{...(data.brief?{brief:data.brief,briefRevision:{increment:1},operations:{...operationsFor(serializeJob(existing)),checklist:[],approvalEvidenceUrl:''}}:{}),title:data.title,assigneeId:assignee===undefined?undefined:assignee?.id||null,dueAt:data.due?new Date(data.due+'T12:00:00Z'):undefined,reviewUrl:data.reviewUrl}});
   if(count.count!==1)throw new Error('Job changed. Refresh and try again.');
   if(data.brief)await tx.assetVersion.updateMany({where:{variant:{jobId:id}},data:{approved:false,review:Prisma.DbNull}});
   const job=await tx.job.findUniqueOrThrow({where:{id},include:jobInclude});
   await tx.auditEvent.create({data:{jobId:id,actorId:user.id,action:'job.updated',before:{brief:existing.brief,briefRevision:existing.briefRevision,assigneeId:existing.assigneeId,dueAt:existing.dueAt.toISOString(),reviewUrl:existing.reviewUrl},after:{briefRevision:job.briefRevision,brief:data.brief,assigneeId:job.assigneeId,dueAt:job.dueAt.toISOString(),reviewUrl:job.reviewUrl}}});
   if(assignee!==undefined&&assignee?.id!==existing.assigneeId)await tx.outboxEvent.create({data:{type:'job.assigned',payload:{jobId:id,assigneeId:assignee?.id||null,assigneeSlackId:assignee?.slackUserId||null}}});
   return job;
 });
 wakeWorker();return NextResponse.json({job:serializeJob(updated)});
 }catch(e){return error((e as Error).message,409)}
}
