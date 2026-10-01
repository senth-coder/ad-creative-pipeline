import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser, mayCreate } from '@/lib/permissions';
import { error, jsonBody } from '@/lib/api';
import { sourceAssetName } from '@/lib/naming';

const tokenFields=z.object({clientCode:z.string().min(1),mediaFormat:z.string().min(1),jobType:z.string().min(1),product:z.string().min(1),openEntry:z.string().min(1),creativeStyle:z.string().min(1),persona:z.string().min(1),funnelStage:z.string().min(1),baseJob:z.string().min(1)});
const schema=z.object({version:z.number().int().positive(),assets:z.array(z.object({variantCode:z.string().regex(/^[A-Z]$/),sourceAssetId:z.string().min(1),sourceUrl:z.url(),extension:z.string().regex(/^[a-zA-Z0-9]{2,5}$/)})).min(1),tokens:tokenFields});
export async function POST(request:Request,{params}:{params:Promise<{batchId:string}>}){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const parsed=schema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid asset manifest');
 const {batchId}=await params;const batch=await db.deliveryBatch.findUnique({where:{id:batchId},include:{job:{include:{client:true,variants:true}},items:true}});
 if(!batch||batch.job.status!=='APPROVED')return error('Approved delivery batch not found',404);
 if(batch.items.length)return error('Manifest already exists',409);
 const {assets,version,tokens}=parsed.data;
 if(tokens.clientCode!==batch.job.client.code)return error('Client code does not match configured client');
 if(!batch.job.client.driveRootId)return error('Client Google Drive root is not configured');
 const buyer=batch.job.client.mediaBuyerId?await db.user.findUnique({where:{id:batch.job.client.mediaBuyerId}}):null;
 if(!buyer?.slackUserId)return error('Assigned media buyer must have a Slack user ID');
 const expected=batch.job.variants.map(v=>v.code).sort();const supplied=assets.map(a=>a.variantCode).sort();
 if(expected.join(',')!==supplied.join(','))return error('Manifest must include every approved variant exactly once');
 const names=assets.map(asset=>({variantCode:asset.variantCode,version,sourceAssetId:asset.sourceAssetId,finalName:`${sourceAssetName({...tokens,jobNumber:batch.job.number,version,variant:asset.variantCode})}.${asset.extension.toLowerCase()}`,sourceUrl:asset.sourceUrl}));
 if(new Set(names.map(n=>n.finalName)).size!==names.length)return error('Filename collision');
 await db.$transaction(async tx=>{
  await tx.deliveryItem.createMany({data:names.map(({sourceUrl,...item})=>({...item,batchId}))});
  await tx.auditEvent.create({data:{jobId:batch.jobId,actorId:user.id,action:'delivery.manifest.created',after:{batchId,version,items:names.map(n=>({variantCode:n.variantCode,finalName:n.finalName,sourceUrl:n.sourceUrl}))}}});
  await tx.outboxEvent.create({data:{type:'delivery.ready',payload:{batchId,jobId:batch.jobId,clientId:batch.job.clientId,driveRootId:batch.job.client.driveRootId,items:names}}});
 });
 return NextResponse.json({batchId,items:names},{status:201});
}
