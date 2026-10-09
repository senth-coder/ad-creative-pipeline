import {isDeepStrictEqual} from 'node:util';
import type {Prisma} from '@prisma/client';
import {receiptProblem,receiptKey,driveReady,type DeliveryReceipt} from './delivery';
import {lockBatch} from './delivery-server';
export async function recordDeliveryReceipt(tx:Prisma.TransactionClient,batchId:string,event:DeliveryReceipt){
 const json=event;
  await lockBatch(tx,batchId);
  const batch=await tx.deliveryBatch.findUnique({where:{id:batchId},include:{items:true,job:true}});if(!batch)throw new Error('Batch not found');
  const key=receiptKey(batchId,event.id);const prior=await tx.inboundEvent.findUnique({where:{externalId:key}});
  if(prior){if(!isDeepStrictEqual(prior.payload,json))throw new Error('Receipt ID was reused with different contents');return {duplicate:true,delivered:batch.status==='COMPLETE'};}
  if(batch.status==='COMPLETE')return {duplicate:true,delivered:true};
  if(batch.job.status!=='APPROVED')throw new Error('Job is not approved');
  const problem=receiptProblem(event,batch);if(problem)throw new Error(problem);
  if(event.type==='delivery.failed')await tx.deliveryBatch.update({where:{id:batchId},data:{status:'FAILED',error:event.message}});
  else if(event.type==='drive.item_verified'){
   await tx.deliveryItem.update({where:{id:event.itemId},data:{driveFileId:event.driveFileId,checksum:event.checksum,status:'DRIVE_VERIFIED'}});
   await tx.deliveryBatch.update({where:{id:batchId},data:{driveFolderId:event.driveFolderId,error:null}});
  }else await tx.deliveryBatch.update({where:{id:batchId},data:{slackReceiptId:event.receiptId,error:null}});
  await tx.inboundEvent.create({data:{provider:'delivery',externalId:key,payload:json as object,processedAt:new Date()}});
  const refreshed=await tx.deliveryBatch.findUniqueOrThrow({where:{id:batchId},include:{items:true}});
  if(driveReady(refreshed)&&!driveReady(batch)&&event.type==='drive.item_verified'){
   await tx.deliveryBatch.update({where:{id:batchId},data:{status:'DRIVE_VERIFIED'}});
   await tx.outboxEvent.create({data:{type:'delivery.drive_verified',payload:{schemaVersion:2,batchId,jobId:batch.jobId,driveFolderId:refreshed.driveFolderId,driveUrl:`https://drive.google.com/drive/folders/${refreshed.driveFolderId}`,mediaBuyerSlackId:batch.mediaBuyerSlackId}}});
  }
  const complete=driveReady(refreshed)&&Boolean(refreshed.slackReceiptId);
  if(complete){await tx.job.update({where:{id:batch.jobId},data:{status:'DELIVERED'}});await tx.deliveryBatch.update({where:{id:batchId},data:{status:'COMPLETE',error:null,completedAt:new Date()}});await tx.auditEvent.create({data:{jobId:batch.jobId,action:'job.delivered',after:{batchId,driveFolderId:refreshed.driveFolderId,slackReceiptId:refreshed.slackReceiptId}}});await tx.outboxEvent.create({data:{type:'job.delivered',payload:{jobId:batch.jobId,batchId}}});}
  return {duplicate:false,delivered:complete};
}
