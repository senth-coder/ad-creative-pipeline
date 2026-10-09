import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { error } from '@/lib/api';
import { verifySignature } from '@/lib/signature';

const schema=z.discriminatedUnion('type',[
 z.object({id:z.string(),type:z.literal('drive.item_verified'),itemId:z.string(),driveFileId:z.string().min(1),checksum:z.string().optional(),driveFolderId:z.string().min(1)}),
 z.object({id:z.string(),type:z.literal('slack.dm_confirmed'),receiptId:z.string().min(1)})
]);
export async function POST(request:Request,{params}:{params:Promise<{batchId:string}>}){
 const body=await request.text();if(!verifySignature(body,request.headers.get('x-integration-signature'),process.env.MAKE_WEBHOOK_SECRET))return error('Invalid signature',401);
 let json:unknown;try{json=JSON.parse(body)}catch{return error('Invalid JSON')};const parsed=schema.safeParse(json);if(!parsed.success)return error('Invalid receipt');
 const {batchId}=await params;const event=parsed.data;
 try{
  const result=await db.$transaction(async tx=>{
   const prior=await tx.inboundEvent.findUnique({where:{externalId:`delivery:${event.id}`}});if(prior)return {duplicate:true,delivered:false};
   const batch=await tx.deliveryBatch.findUnique({where:{id:batchId},include:{items:true,job:{include:{client:true}}}});if(!batch||batch.job.status!=='APPROVED')throw new Error('Approved batch not found');
   if(event.type==='drive.item_verified'){
   const item=batch.items.find(i=>i.id===event.itemId);if(!item)throw new Error('Item not in batch');
    if(batch.driveFolderId&&batch.driveFolderId!==event.driveFolderId)throw new Error('Drive folder mismatch');
    await tx.deliveryItem.update({where:{id:item.id},data:{driveFileId:event.driveFileId,checksum:event.checksum,status:'DRIVE_VERIFIED'}});
    await tx.deliveryBatch.update({where:{id:batchId},data:{driveFolderId:event.driveFolderId}});
   }else {
    if(!batch.driveFolderId||!batch.items.length||!batch.items.every(i=>i.driveFileId&&i.status==='DRIVE_VERIFIED'))throw new Error('Verify all Drive assets before confirming the Slack handoff');
    await tx.deliveryBatch.update({where:{id:batchId},data:{slackReceiptId:event.receiptId}});
   }
   await tx.inboundEvent.create({data:{provider:'delivery',externalId:`delivery:${event.id}`,payload:json as object,processedAt:new Date()}});
   const refreshed=await tx.deliveryBatch.findUniqueOrThrow({where:{id:batchId},include:{items:true}});
   const driveReady=refreshed.items.length>0&&refreshed.items.every(i=>i.driveFileId&&i.status==='DRIVE_VERIFIED')&&Boolean(refreshed.driveFolderId);
   const wasDriveReady=batch.items.length>0&&batch.items.every(i=>i.driveFileId&&i.status==='DRIVE_VERIFIED');
   if(driveReady&&!wasDriveReady&&event.type==='drive.item_verified'){
    const buyer=batch.job.client.mediaBuyerId?await tx.user.findUnique({where:{id:batch.job.client.mediaBuyerId}}):null;
    if(!buyer?.slackUserId)throw new Error('Media buyer Slack mapping missing');
    await tx.outboxEvent.create({data:{type:'delivery.drive_verified',payload:{batchId,jobId:batch.jobId,driveFolderId:refreshed.driveFolderId,driveUrl:`https://drive.google.com/drive/folders/${refreshed.driveFolderId}`,mediaBuyerSlackId:buyer.slackUserId}}});
   }
   const complete=driveReady&&Boolean(refreshed.slackReceiptId);
   if(complete){
    const moved=await tx.job.updateMany({where:{id:batch.jobId,status:'APPROVED'},data:{status:'DELIVERED'}});
    if(moved.count!==1)throw new Error('Job was already delivered');
    await tx.deliveryBatch.update({where:{id:batchId},data:{status:'COMPLETE',completedAt:new Date()}});
    await tx.auditEvent.create({data:{jobId:batch.jobId,action:'job.delivered',after:{batchId,driveFolderId:refreshed.driveFolderId,slackReceiptId:refreshed.slackReceiptId}}});
    await tx.outboxEvent.create({data:{type:'job.delivered',payload:{jobId:batch.jobId,batchId}}});
   }
   return {duplicate:false,delivered:complete};
  });
  return NextResponse.json(result);
 }catch(e){return error((e as Error).message,409)}
}
