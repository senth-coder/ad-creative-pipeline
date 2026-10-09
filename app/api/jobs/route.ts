import {queueChannelNotices} from '@/lib/channel-notifications-server';
import {canonicalQaClient,chooseQa} from '@/lib/qa-routing';
import {briefPlan,flexibleFields} from '@/lib/brief-plan';
import {wakeWorker} from '@/lib/worker-wake';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser, mayCreate } from '@/lib/permissions';
import { error, jsonBody } from '@/lib/api';
import { serializeJobForUi,serializeJobsForUi,jobInclude, serializeJob } from '@/lib/serialize';
import { variantsFor, type CreativeType } from '@/lib/workflow';
import type { Prisma } from '@prisma/client';
import {sharedFields,typeFields,requiredBriefProblem, type BriefField} from '@/lib/templates';
import { ruleSchema } from '@/lib/config';

export const dynamic='force-dynamic';
const createSchema=z.object({title:z.string().trim().min(2).max(160),client:z.string().min(1),campaign:z.string().trim().min(2),concept:z.string().trim().min(2),type:z.enum(['Video','Static','Carousel','Motion','UGC']),due:z.iso.date(),assignee:z.string().trim().optional(),source:z.enum(['Manual','Motion','Tally','Slack','Notion']).default('Manual'),parentJobId:z.string().optional(),brief:z.record(z.string(),z.string()).optional()});

export async function GET() {
 const user=await currentUser(); if(!user)return error('Sign in required',401);
 const where=user.role==='ADMIN'||user.role==='STRATEGIST'?{}:user.role==='MAKER'?{assigneeId:user.id}:user.role==='QA'?{client:{qaMembers:{some:{userId:user.id}}}}:{client:{mediaBuyerId:user.id}};
 const jobs=await db.job.findMany({where,include:jobInclude,orderBy:{number:'desc'},take:500});
 return NextResponse.json({jobs:await serializeJobsForUi(jobs)});
}

export async function POST(request:Request) {
 const user=await currentUser(); if(!user)return error('Sign in required',401); if(!mayCreate(user))return error('Not permitted',403);
 const parsed=createSchema.safeParse(await jsonBody(request)); if(!parsed.success)return error('Invalid brief: '+parsed.error.issues.map(i=>i.path.join('.')).join(', '));
 const data=parsed.data;
 const eventId=data.brief?.intakeEventId||data.brief?.motionEventId;
 if(['Tally','Slack','Notion'].includes(data.source)&&!eventId)return error('Select an item from Intake first');
 const client=await db.client.findUnique({where:{name:data.client}}); if(!client)return error('Unknown client. Configure the client first.');
 if(data.assignee==='Unassigned')data.assignee='';
 if(data.parentJobId){const parent=await db.job.findUnique({where:{id:data.parentJobId}});if(!parent||parent.clientId!==client.id)return error('Original job must belong to this client');}
 const matches=data.assignee?await db.user.findMany({where:{name:data.assignee,role:'MAKER'},take:2}):[];if(matches.length>1)return error('More than one maker has this name. Give team members distinct display names in Settings.');
 const assignee=matches[0]||null;
 let selectedQa:Awaited<ReturnType<typeof chooseQa>>|undefined;
 if(canonicalQaClient(client.name)){try{selectedQa=chooseQa(client.name,data.type,await db.user.findMany(),data.brief?.qaReviewerId);data.brief={...data.brief,qaReviewerId:selectedQa.id,qaReviewerName:selectedQa.name,qaRouteVersion:'2026-10-09'};}catch(e){return error((e as Error).message);}}else if(data.brief&&['qaReviewerId','qaReviewerName','qaRouteVersion'].some(k=>data.brief?.[k]))return error('Client QA route not configured');
 if(data.assignee && !assignee)return error('Assigned maker must be a configured user.');
 try {const created=await db.$transaction(async tx=>{
   if(eventId){const claimed=await tx.inboundEvent.updateMany({where:{id:eventId,provider:data.source.toLowerCase(),processedAt:null,dismissedAt:null},data:{processedAt:new Date()}});if(claimed.count!==1)throw new Error('Intake item was already processed or is unavailable');}
   if(selectedQa)await tx.clientQa.upsert({where:{clientId_userId:{clientId:client.id,userId:selectedQa.id}},create:{clientId:client.id,userId:selectedQa.id},update:{}});
   const campaign=await tx.campaign.upsert({where:{clientId_name:{clientId:client.id,name:data.campaign}},create:{clientId:client.id,name:data.campaign},update:{}});
   let concept=await tx.concept.findFirst({where:{campaignId:campaign.id,name:data.concept}});
   if(!concept)concept=await tx.concept.create({data:{campaignId:campaign.id,name:data.concept}});
   const template=await tx.briefTemplate.findFirst({where:{type:data.type,active:true},orderBy:{version:'desc'}});
   const rule=await tx.variantRule.findFirst({where:{type:data.type,active:true},orderBy:{version:'desc'}});
   const fields=flexibleFields((template?.fields as BriefField[]|undefined)||[...sharedFields,...typeFields[data.type]]);
   const problem=requiredBriefProblem(fields,data.brief);if(problem)throw new Error(problem);
   const configured=ruleSchema.safeParse(rule?.rule);
   const letters=briefPlan(data.brief||{},configured.success?configured.data.letters:variantsFor(data.type as CreativeType));
   const job=await tx.job.create({data:{clientId:client.id,campaignId:campaign.id,conceptId:concept.id,title:data.title,type:data.type,source:data.source.toUpperCase() as 'MANUAL'|'MOTION'|'TALLY'|'SLACK'|'NOTION',sourceExternalId:eventId||undefined,parentJobId:data.parentJobId,dueAt:new Date(data.due+'T12:00:00Z'),assigneeId:assignee?.id,brief:(data.brief||{}) as Prisma.InputJsonValue,policySnapshot:{version:client.governanceVersion,governance:client.governance as Prisma.InputJsonValue||{}},templateSnapshot:fields as Prisma.InputJsonValue,ruleSnapshot:{letters},variants:{create:letters.map(code=>({code,spec:{},origin:'RULE'}))}},include:jobInclude});
   if(eventId)await tx.inboundEvent.update({where:{id:eventId},data:{jobId:job.id}});
   await tx.auditEvent.create({data:{jobId:job.id,actorId:user.id,action:'job.created',after:{number:job.number,status:'BRIEFED'}}});
   await tx.outboxEvent.create({data:{type:'job.created',payload:{jobId:job.id,jobNumber:job.number,clientId:client.id,assigneeSlackId:assignee?.slackUserId||null}}});
   await queueChannelNotices(tx,job,{to:job.status,assignment:true});
   return job;
 });
 wakeWorker();return NextResponse.json({job:await serializeJobForUi(created)},{status:201});
 }catch(e){return error((e as Error).message,409)}
}
