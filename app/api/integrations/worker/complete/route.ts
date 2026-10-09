import {wakeWorker} from '@/lib/worker-wake';
import {isDeepStrictEqual} from 'node:util';
import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {error,jsonBody} from '@/lib/api';
import {integrationAuthorized} from '@/lib/integration-auth';
import {workerResultSchema,validateWorkerResult,type Manifest} from '@/lib/worker';
import {workerState} from '@/lib/worker-server';
import {recordDeliveryReceipt} from '@/lib/receipt-server';
export async function POST(request:Request){
 if(!integrationAuthorized(request))return error('Not authorized',401);
 const parsed=workerResultSchema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid worker result');const input=parsed.data;
 try{const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "OutboxEvent" WHERE id=${input.eventId} FOR UPDATE`;
  const event=await tx.outboxEvent.findUniqueOrThrow({where:{id:input.eventId}}),key=`worker:${input.actionId}`;
  const previous=await tx.inboundEvent.findUnique({where:{externalId:key}});
  if(previous){if(!isDeepStrictEqual(previous.payload,input))throw new Error('Action result was changed');return {accepted:true,duplicate:true};}
  const payload=event.payload as Record<string,unknown>,state=workerState(payload),action=state.pending;
  // An expired lease may finish only while its token and pending action remain unchanged.
  if(event.deliveredAt||!action||action.id!==input.actionId||event.leaseToken!==input.leaseToken)throw new Error('Action or lease does not match');
  if(input.error){await tx.outboxEvent.update({where:{id:event.id},data:{attempts:10,lastError:input.error,leasedUntil:null,leaseToken:null}});return {accepted:true,failed:true};}
  validateWorkerResult(action,input.result);const r=input.result;
  if(action.kind==='folder'){
   if(action.versionFolder)state.versionFolders[action.versionFolder]=r.id!;else state.jobFolderId=r.id;
  }else if(action.kind==='copy'){
   const manifest=payload as unknown as Manifest;
   await recordDeliveryReceipt(tx,manifest.batchId,{id:action.id,type:'drive.item_verified',itemId:action.itemId!,driveFileId:r.id!,finalName:r.name!,bytes:Number(r.size),checksum:r.md5Checksum,driveFolderId:state.jobFolderId!});
   state.completedItems.push(action.itemId!);
  }else if(event.type==='delivery.drive_verified'){
   await recordDeliveryReceipt(tx,String(payload.batchId),{id:action.id,type:'slack.dm_confirmed',receiptId:`${r.channel}:${r.ts}`,recipientSlackId:action.recipient!});
  }
  delete state.pending;
  const done=event.type!=='delivery.ready'||(payload as unknown as Manifest).items.every(i=>state.completedItems.includes(i.id));
  await tx.outboxEvent.update({where:{id:event.id},data:{payload:{...payload,worker:state} as object,deliveredAt:done?new Date():null,leaseToken:null,leasedUntil:null,lastError:null,attempts:0}});
  await tx.inboundEvent.create({data:{provider:'make',externalId:key,payload:input,processedAt:new Date()}});
  return {accepted:true,complete:done};
 });wakeWorker();return NextResponse.json(result);}catch(e){return error((e as Error).message,409)}
}
