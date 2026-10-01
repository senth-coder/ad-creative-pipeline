import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser, mayCreate } from '@/lib/permissions';
import { error, jsonBody } from '@/lib/api';
import { jobInclude, serializeJob } from '@/lib/serialize';
import { variantsFor, type CreativeType } from '@/lib/workflow';
import type { Prisma } from '@prisma/client';
import { ruleSchema } from '@/lib/config';

export const dynamic='force-dynamic';
const createSchema=z.object({title:z.string().trim().min(2).max(160),client:z.string().min(1),campaign:z.string().trim().min(2),concept:z.string().trim().min(2),type:z.enum(['Video','Static','Carousel','Motion']),due:z.iso.date(),assignee:z.string().trim().optional(),source:z.enum(['Manual','Motion']).default('Manual'),brief:z.record(z.string(),z.unknown()).optional()});

export async function GET() {
 const user=await currentUser(); if(!user)return error('Sign in required',401);
 const where=user.role==='ADMIN'||user.role==='STRATEGIST'?{}:user.role==='MAKER'?{assigneeId:user.id}:user.role==='QA'?{client:{qaMembers:{some:{userId:user.id}}}}:{client:{mediaBuyerId:user.id}};
 const jobs=await db.job.findMany({where,include:jobInclude,orderBy:{number:'desc'},take:500});
 return NextResponse.json({jobs:jobs.map(serializeJob)});
}

export async function POST(request:Request) {
 const user=await currentUser(); if(!user)return error('Sign in required',401); if(!mayCreate(user))return error('Not permitted',403);
 const parsed=createSchema.safeParse(await jsonBody(request)); if(!parsed.success)return error('Invalid brief: '+parsed.error.issues.map(i=>i.path.join('.')).join(', '));
 const data=parsed.data;
 const motionEventId=data.source==='Motion'&&typeof data.brief?.motionEventId==='string'?data.brief.motionEventId:null;
 if(data.source==='Motion'&&motionEventId){const event=await db.inboundEvent.findUnique({where:{id:motionEventId}});if(!event||event.provider!=='motion'||event.processedAt)return error('Motion event unavailable',409);}
 const client=await db.client.findUnique({where:{name:data.client}}); if(!client)return error('Unknown client. Configure the client first.');
 const assignee=data.assignee?await db.user.findFirst({where:{name:data.assignee,role:'MAKER'}}):null;
 if(data.assignee && !assignee)return error('Assigned maker must be a configured user.');
 const created=await db.$transaction(async tx=>{
   const campaign=await tx.campaign.upsert({where:{clientId_name:{clientId:client.id,name:data.campaign}},create:{clientId:client.id,name:data.campaign},update:{}});
   let concept=await tx.concept.findFirst({where:{campaignId:campaign.id,name:data.concept}});
   if(!concept)concept=await tx.concept.create({data:{campaignId:campaign.id,name:data.concept}});
   const template=await tx.briefTemplate.findFirst({where:{type:data.type,active:true},orderBy:{version:'desc'}});
   const rule=await tx.variantRule.findFirst({where:{type:data.type,active:true},orderBy:{version:'desc'}});
   const configured=ruleSchema.safeParse(rule?.rule);
   const letters=configured.success?configured.data.letters:variantsFor(data.type as CreativeType);
   const job=await tx.job.create({data:{clientId:client.id,campaignId:campaign.id,conceptId:concept.id,title:data.title,type:data.type,source:data.source==='Motion'?'MOTION':'MANUAL',sourceExternalId:motionEventId||undefined,dueAt:new Date(data.due+'T12:00:00Z'),assigneeId:assignee?.id,brief:(data.brief||{}) as Prisma.InputJsonValue,templateSnapshot:template?.fields||undefined,ruleSnapshot:rule?.rule||undefined,variants:{create:letters.map(code=>({code,spec:{},origin:'RULE'}))}},include:jobInclude});
   if(motionEventId)await tx.inboundEvent.update({where:{id:motionEventId},data:{processedAt:new Date()}});
   await tx.auditEvent.create({data:{jobId:job.id,actorId:user.id,action:'job.created',after:{number:job.number,status:'BRIEFED'}}});
   await tx.outboxEvent.create({data:{type:'job.created',payload:{jobId:job.id,jobNumber:job.number,clientId:client.id}}});
   return job;
 });
 return NextResponse.json({job:serializeJob(created)},{status:201});
}
