import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error} from '@/lib/api';
import {driveReady} from '@/lib/delivery';
import {lockBatch,queueDelivery} from '@/lib/delivery-server';
export async function POST(_request:Request,{params}:{params:Promise<{batchId:string}>}){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);const {batchId}=await params;
 const initial=await db.deliveryBatch.findUnique({where:{id:batchId},include:{items:true}});if(!initial)return error('Batch not found',404);
 try{const result=await db.$transaction(async tx=>{
 if(!initial.items.length)return queueDelivery(tx,batchId,user.id);
 await lockBatch(tx,batchId);const batch=await tx.deliveryBatch.findUniqueOrThrow({where:{id:batchId},include:{items:true,job:true}});
 if(batch.job.status!=='APPROVED'||batch.status==='COMPLETE')throw new Error('Only pending approved deliveries can be retried');
 const type=driveReady(batch)?'delivery.drive_verified':'delivery.ready';
 const event=await tx.outboxEvent.findFirst({where:{type,payload:{path:['batchId'],equals:batchId}},orderBy:{createdAt:'desc'}});if(!event)throw new Error('Original delivery event not found');
 if(event.lastError?.startsWith('WORKER_PENDING:'))throw new Error('Provider outcome is uncertain. Resume the saved Make completion step before retrying delivery.');
 const changed=await tx.outboxEvent.updateMany({where:{id:event.id,OR:[{leasedUntil:null},{leasedUntil:{lt:new Date()}}]},data:{deliveredAt:null,attempts:0,leaseToken:null,leasedUntil:null,lastError:null}});if(!changed.count)throw new Error('Worker is still processing this delivery. Retry after its lease expires.');
 await tx.deliveryBatch.update({where:{id:batchId},data:{status:driveReady(batch)?'DRIVE_VERIFIED':'TRANSFERRING',error:null}});
 await tx.auditEvent.create({data:{jobId:batch.jobId,actorId:user.id,action:'delivery.retry_requested',after:{batchId,eventId:event.id}}});return {queued:true};
 });return NextResponse.json(result);}catch(e){return error((e as Error).message,409)}
}
