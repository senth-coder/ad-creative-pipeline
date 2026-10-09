import {lockClient} from '@/lib/locking';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser, mayCreate } from '@/lib/permissions';
import { error, jsonBody } from '@/lib/api';
import { jobInclude, serializeJob, toDbStatus } from '@/lib/serialize';
import { operationsFor, reviewReadiness } from '@/lib/operations';
import {routeQa,releaseProblem} from '@/lib/assurance';
import {readGovernance,serializeAsset} from '@/lib/assurance-server';
import {queueDelivery} from '@/lib/delivery-server';
import { statuses, transitions } from '@/lib/workflow';

const schema=z.object({next:z.enum(statuses),reason:z.string().trim().max(1000).optional(),approvalEvidenceUrl:z.url().refine(v=>/^https?:\/\//i.test(v)).optional()});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 const user=await currentUser();if(!user)return error('Sign in required',401);
 const parsed=schema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid transition');
 const {id}=await params;const {next,reason,approvalEvidenceUrl}=parsed.data;
 const job=await db.job.findUnique({where:{id},include:jobInclude});if(!job)return error('Job not found',404);
 const operations=operationsFor(serializeJob(job));
 const current=Object.keys(toDbStatus).find(k=>toDbStatus[k as keyof typeof toDbStatus]===job.status) as keyof typeof toDbStatus;
 if(!transitions[current].includes(next))return error(`Cannot move ${current} to ${next}`,409);
 const isMaker=user.role==='MAKER'&&job.assigneeId===user.id;
 const isQa=user.role==='QA'&&job.client.qaMembers.some(q=>q.userId===user.id);
 const permitted=mayCreate(user)||(current==='Briefed'&&isMaker)||(current==='In Production'&&isMaker)||(current==='Internal Review'&&isQa);
 if(!permitted)return error('Not permitted',403);
 const readiness=reviewReadiness(serializeJob(job),next);if(readiness)return error(readiness,409);
 const revision=next==='In Production'&&job.status!=='BRIEFED';
 const effectiveReason=reason||operations.revisionReason;
 const evidence=approvalEvidenceUrl||operations.approvalEvidenceUrl;
 if(revision&&(!effectiveReason||!operations.feedbackUrl||!operations.revisionDue))return error('Record revision reason, feedback link and return date first');
 if((next==='Internal Review'||next==='Client Review'||next==='Approved')&&!job.reviewUrl)return error('A Figma or Frame.io review link is required',409);
 const governance=readGovernance(job.client.governance);
 let qaSlackIds:string[]=[];
 if(next==='Internal Review'){
 const people=await db.user.findMany({where:{email:{in:[governance.primaryQaEmail,governance.backupQaEmail].map(e=>e.toLowerCase())}}});
 const route=routeQa(governance,people.map(p=>({...p,onboarding:undefined})));if(!route.person)return error(route.reason,409);qaSlackIds=[route.person.slackUserId!];
 }
 if(next==='Approved'||next==='Client Review'){
 const assets=await db.assetVersion.findMany({where:{variant:{jobId:id}},include:{variant:true}});
 const problem=releaseProblem(job.variants.map(v=>v.code),assets.map(serializeAsset),governance,job.client.governanceVersion);if(problem)return error(problem,409);
 }

 if(next==='In Production'&&current!=='Briefed'&&!effectiveReason)return error('Changes Required needs a reason or feedback reference');
 if(next==='Approved'&&!evidence)return error('Record the external client approval evidence URL');
 try {
  const updated=await db.$transaction(async tx=>{
   await lockClient(tx,job.clientId);
   const liveClient=await tx.client.findUniqueOrThrow({where:{id:job.clientId}});
   if(liveClient.governanceVersion!==job.client.governanceVersion)throw new Error('Client rules changed. Review again.');
   const result=await tx.job.updateMany({where:{id,status:job.status,updatedAt:job.updatedAt},data:{operations:{...operations,...(revision?{checklist:[],approvalEvidenceUrl:''}:{}),...(next==='Approved'?{approvalEvidenceUrl:evidence}:{})},status:toDbStatus[next],approvedBy:next==='Approved'?user.name:undefined,approvedAt:next==='Approved'?new Date():undefined}});
   if(result.count!==1)throw new Error('Job changed while you were editing');
   await tx.auditEvent.create({data:{jobId:id,actorId:user.id,action:next==='In Production'&&current!=='Briefed'?'review.changes_required':'job.transition',before:{status:job.status},after:{status:toDbStatus[next],approvalEvidenceUrl:evidence},reason:effectiveReason}});
   const type=next==='Internal Review'?'review.internal.ready':next==='Client Review'?'review.client.ready':next==='Approved'?'job.approved':next==='In Production'&&current!=='Briefed'?'review.changes_required':'job.transition';
   await tx.outboxEvent.create({data:{type,payload:{jobId:id,clientId:job.clientId,from:job.status,to:toDbStatus[next],reason:effectiveReason,feedbackUrl:operations.feedbackUrl,revisionDue:operations.revisionDue,assigneeSlackId:job.assignee?.slackUserId,approvalOwnerEmail:job.client.plan?.approverEmail,releaseOwnerEmail:job.client.plan?.releaseOwnerEmail,qaSlackIds}}});
   if(revision)await tx.assetVersion.updateMany({where:{variant:{jobId:id}},data:{approved:false,review:Prisma.DbNull}});
   if(next==='Approved'){const batch=await tx.deliveryBatch.create({data:{jobId:id}});await queueDelivery(tx,batch.id,user.id);}
   return tx.job.findUniqueOrThrow({where:{id},include:jobInclude});
  });
  return NextResponse.json({job:serializeJob(updated)});
 } catch(e) {return error((e as Error).message,409)}
}
