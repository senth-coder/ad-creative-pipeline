import {isDeepStrictEqual} from 'node:util';
import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {error} from '@/lib/api';
import {verifySignature} from '@/lib/signature';
import {deliveryReceiptSchema,receiptProblem,receiptKey,driveReady} from '@/lib/delivery';
import {lockBatch} from '@/lib/delivery-server';
export async function POST(request:Request,{params}:{params:Promise<{batchId:string}>}){
 const body=await request.text();if(!verifySignature(body,request.headers.get('x-integration-signature'),process.env.MAKE_WEBHOOK_SECRET))return error('Invalid signature',401);
 let json:unknown;try{json=JSON.parse(body)}catch{return error('Invalid JSON')};const parsed=deliveryReceiptSchema.safeParse(json);if(!parsed.success)return error('Invalid receipt: filename, positive file size and intended Slack recipient are required');
 const {batchId}=await params;const event=parsed.data;
 try{return NextResponse.json(await db.$transaction(async tx=>{
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
 }));}catch(e){return error((e as Error).message,409)}
}
