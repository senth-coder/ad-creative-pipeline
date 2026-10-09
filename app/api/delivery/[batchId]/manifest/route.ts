import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error,jsonBody} from '@/lib/api';
import {releaseProblem} from '@/lib/assurance';
import {readGovernance,serializeAsset} from '@/lib/assurance-server';
const schema=z.object({assetIds:z.array(z.string().min(1)).min(1)});
export async function POST(request:Request,{params}:{params:Promise<{batchId:string}>}){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const parsed=schema.safeParse(await jsonBody(request));if(!parsed.success)return error('Select the approved tracked asset for every variant');
 const {batchId}=await params;
 try{const result=await db.$transaction(async tx=>{
 const batch=await tx.deliveryBatch.findUnique({where:{id:batchId},include:{job:{include:{client:true,variants:true}},items:true}});if(!batch||batch.job.status!=='APPROVED')throw new Error('Approved batch not found');if(batch.items.length)throw new Error('Manifest already exists');
 const claim=await tx.deliveryBatch.updateMany({where:{id:batchId,status:'PENDING'},data:{status:'TRANSFERRING'}});if(claim.count!==1)throw new Error('Manifest is already queued');
 const all=await tx.assetVersion.findMany({where:{variant:{jobId:batch.jobId}},include:{variant:true}});const tracked=all.map(serializeAsset);const gate=releaseProblem(batch.job.variants.map(v=>v.code),tracked,readGovernance(batch.job.client.governance),batch.job.client.governanceVersion);if(gate)throw new Error(gate);
 const selected=tracked.filter(a=>parsed.data.assetIds.includes(a.id));const expected=batch.job.variants.map(v=>v.code).sort().join(',');if(selected.map(a=>a.variantCode).sort().join(',')!==expected||selected.length!==parsed.data.assetIds.length)throw new Error('Select exactly one asset per variant');
 for(const asset of selected){if(tracked.some(a=>a.variantCode===asset.variantCode&&a.version>asset.version))throw new Error('Use the latest reviewed revision for each variant');}
 if(new Set(selected.map(a=>a.filename)).size!==selected.length)throw new Error('Filename collision');
 if(!batch.job.client.driveRootId)throw new Error('Client Drive folder is not configured');const buyer=batch.job.client.mediaBuyerId?await tx.user.findUnique({where:{id:batch.job.client.mediaBuyerId}}):null;if(!buyer?.slackUserId)throw new Error('Media buyer Slack ID is missing');
 const items=[];
 for(const asset of selected){const item=await tx.deliveryItem.create({data:{batchId,variantCode:asset.variantCode,version:asset.version,sourceAssetId:asset.externalAssetId,finalName:asset.filename}});items.push({...item,assetVersionId:asset.id,sourceUrl:asset.sourceUrl,briefRevision:asset.briefRevision,sourceBriefUrl:asset.sourceBriefUrl,versionFolder:`v${String(asset.version).padStart(2,'0')}`});}
 await tx.auditEvent.create({data:{jobId:batch.jobId,actorId:user.id,action:'delivery.manifest.created',after:{batchId,namingConvention:'scope-type-v1',assetIds:parsed.data.assetIds}}});
 await tx.outboxEvent.create({data:{type:'delivery.ready',payload:{batchId,jobId:batch.jobId,clientId:batch.job.clientId,driveRootId:batch.job.client.driveRootId,namingConvention:'scope-type-v1',items}}});return {batchId,items};
 });return NextResponse.json(result,{status:201});}catch(e){return error((e as Error).message,409)}
}
