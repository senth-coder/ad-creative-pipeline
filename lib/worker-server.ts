import type {Prisma} from '@prisma/client';
import {initialWorkerState,nextDeliveryAction,slackText,type WorkerAction,type WorkerState,type Manifest} from './worker';

type Payload=Record<string,unknown>&{worker?:WorkerState};
export function workerState(payload:Payload){return payload.worker||initialWorkerState();}
export async function prepareWorkerAction(tx:Prisma.TransactionClient,event:{id:string;type:string;payload:Prisma.JsonValue}):Promise<WorkerAction|null>{
 const p=event.payload as Payload;
 if(event.type==='delivery.ready')return nextDeliveryAction(event.id,p as unknown as Manifest,workerState(p));
 // These events remain in the audit trail; the corresponding actionable event sends the DM.
 if(['job.transition','job.approved','job.delivered'].includes(event.type))return null;
 const job=typeof p.jobId==='string'?await tx.job.findUnique({where:{id:p.jobId},include:{client:{include:{plan:true}},assignee:true}}):null;
 if(!job)throw new Error('Notification job not found');
 const label=`Job #${job.number} · ${slackText(job.client.name)} · ${slackText(job.title)}`;
 let recipient:string|undefined,text:string;
 if(event.type==='delivery.drive_verified'){
  recipient=typeof p.mediaBuyerSlackId==='string'?p.mediaBuyerSlackId:undefined;
  if(typeof p.driveFolderId!=='string'||!/^[a-zA-Z0-9_-]+$/.test(p.driveFolderId))throw new Error('Verified Drive folder is missing');
  text=`*Final assets ready*\n${label}\nhttps://drive.google.com/drive/folders/${p.driveFolderId}`;
 }else if(event.type==='review.internal.ready'){
  recipient=Array.isArray(p.qaSlackIds)?p.qaSlackIds[0]:undefined;
  text=`*Ready for internal QA*\n${label}\nReview comments belong in Figma/Frame.io.\n${slackText(job.reviewUrl||'')}`;
 }else if(['job.created','job.assigned','review.changes_required'].includes(event.type)){
  recipient=typeof p.assigneeSlackId==='string'?p.assigneeSlackId:undefined;
  if(!recipient&&event.type==='job.created'&&!job.assigneeId)return null;
  if(!recipient&&event.type==='job.assigned'&&!p.assigneeId)return null;
  text=`*${event.type==='review.changes_required'?'Changes required':'Creative assignment'}*\n${label}\nDue: ${job.dueAt.toISOString().slice(0,10)}${p.reason?`\n${slackText(String(p.reason))}`:''}${p.feedbackUrl?`\n${slackText(String(p.feedbackUrl))}`:''}`;
 }else if(event.type==='review.client.ready'||event.type==='job.blocked'){
  const owner=event.type==='review.client.ready'?job.client.plan?.approverEmail:String(p.owner||'');
  const person=owner?await tx.user.findFirst({where:{OR:[{email:owner.toLowerCase()},{id:owner}]}}):null;
  recipient=person?.slackUserId||undefined;
  text=`*${event.type==='job.blocked'?'Creative blocked':'Ready for external client review'}*\n${label}${p.reason?`\n${slackText(String(p.reason))}`:''}`;
 }else throw new Error(`Unsupported worker event: ${event.type}`);
 if(!recipient||!/^U[A-Z0-9]+$/.test(recipient))throw new Error('Map this notification owner to a registered Slack user. Blocker owners must use their email.');
 const base=process.env.AUTH_URL||'https://ad-creative-pipeline-nine.vercel.app';
 return {id:`${event.id}:dm`,kind:'slack',recipient,text:`${text}\n${base}\nCreative OS reference: ${event.id}`};
}
