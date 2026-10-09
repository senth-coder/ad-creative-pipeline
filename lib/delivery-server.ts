import {driveSourceId} from './worker';
import {lockClient} from '@/lib/locking';
import type {Prisma} from '@prisma/client';
import {releaseProblem} from './assurance';
import {readGovernance,serializeAsset} from './assurance-server';
// All delivery mutations lock the batch first. PostgreSQL READ COMMITTED then
// reads the receipts committed by the preceding worker before deciding readiness.
export async function lockBatch(tx:Prisma.TransactionClient,batchId:string){
 await tx.$queryRaw`SELECT id FROM "DeliveryBatch" WHERE id = ${batchId} FOR UPDATE`;
}
export async function queueDelivery(tx:Prisma.TransactionClient,batchId:string,actorId?:string){
 const context=await tx.deliveryBatch.findUnique({where:{id:batchId},select:{job:{select:{clientId:true}}}});if(!context)throw new Error('Batch not found');
 await lockClient(tx,context.job.clientId);
 await lockBatch(tx,batchId);
 const batch=await tx.deliveryBatch.findUnique({where:{id:batchId},include:{job:{include:{client:true,variants:true}},items:true}});
 if(!batch||batch.job.status!=='APPROVED')throw new Error('Approved batch not found');
 if(batch.items.length)return {batchId,items:batch.items,alreadyQueued:true};
 const all=await tx.assetVersion.findMany({where:{variant:{jobId:batch.jobId}},include:{variant:true}});
 const tracked=all.map(serializeAsset),g=readGovernance(batch.job.client.governance);
 const gate=releaseProblem(batch.job.variants.map(v=>v.code),tracked,g,batch.job.client.governanceVersion);if(gate)throw new Error(gate);
 const selected=batch.job.variants.map(v=>tracked.filter(a=>a.variantCode===v.code).sort((a,b)=>b.version-a.version)[0]);
 // Fail inside the approval transaction, before the job becomes locked.
 for(const asset of selected)driveSourceId(asset.sourceUrl);
 if(new Set(selected.map(a=>a.filename)).size!==selected.length)throw new Error('Filename collision');
 if(!batch.job.client.driveRootId)throw new Error('Client Drive folder is not configured');
 const buyer=batch.job.client.mediaBuyerId?await tx.user.findUnique({where:{id:batch.job.client.mediaBuyerId}}):null;
 if(!buyer?.slackUserId)throw new Error('Media buyer Slack ID is missing');
 const items=[];
 for(const asset of selected){const item=await tx.deliveryItem.create({data:{batchId,assetVersionId:asset.id,variantCode:asset.variantCode,version:asset.version,sourceAssetId:asset.externalAssetId,finalName:asset.filename}});items.push({...item,sourceUrl:asset.sourceUrl,briefRevision:asset.briefRevision,sourceBriefUrl:asset.sourceBriefUrl,versionFolder:`v${String(asset.version).padStart(2,'0')}`});}
 await tx.deliveryBatch.update({where:{id:batchId},data:{status:'TRANSFERRING',error:null,mediaBuyerSlackId:buyer.slackUserId}});
 await tx.auditEvent.create({data:{jobId:batch.jobId,actorId,action:'delivery.manifest.created',after:{batchId,namingConvention:'scope-type-v1',assetIds:selected.map(a=>a.id)}}});
 await tx.outboxEvent.create({data:{type:'delivery.ready',payload:{schemaVersion:2,batchId,jobId:batch.jobId,jobNumber:batch.job.number,jobFolder:`Job-${batch.job.number}`,campaign:batch.job.campaignId,clientId:batch.job.clientId,driveRootId:batch.job.client.driveRootId,mediaBuyerSlackId:buyer.slackUserId,namingConvention:'scope-type-v1',items}}});
 return {batchId,items,alreadyQueued:false};
}
