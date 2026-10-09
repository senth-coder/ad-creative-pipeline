import {wakeWorker} from '@/lib/worker-wake';
import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {error} from '@/lib/api';
import {integrationAuthorized} from '@/lib/integration-auth';
import {prepareWorkerAction,workerState} from '@/lib/worker-server';
export async function POST(request:Request){
 if(!integrationAuthorized(request))return error('Not authorized',401);
 const result=await db.$transaction(async tx=>{
  // One external side effect per claim. SKIP LOCKED permits concurrent schedulers.
  const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "OutboxEvent" WHERE "deliveredAt" IS NULL AND attempts < 10 AND ("leasedUntil" IS NULL OR "leasedUntil" < NOW()) AND ("lastError" IS NULL OR "lastError" NOT LIKE 'WORKER_PENDING:%') ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
  if(!rows.length)return {action:null};
  const event=await tx.outboxEvent.findUniqueOrThrow({where:{id:rows[0].id}});
  try{
   const action=await prepareWorkerAction(tx,event);
   if(!action){await tx.outboxEvent.update({where:{id:event.id},data:{deliveredAt:new Date(),lastError:null,leaseToken:null,leasedUntil:null}});return {action:null,completedEventId:event.id};}
   const leaseToken=randomUUID(),leasedUntil=new Date(Date.now()+5*60*1000);
   const payload=event.payload as Record<string,unknown>,state=workerState(payload);
   await tx.outboxEvent.update({where:{id:event.id},data:{payload:{...payload,worker:{...state,pending:action}} as object,leaseToken,leasedUntil,attempts:{increment:1},lastError:'WORKER_PENDING: Awaiting provider result. If overdue, reconcile in Make before retrying.'}});
   return {eventId:event.id,leaseToken,action};
  }catch(e){await tx.outboxEvent.update({where:{id:event.id},data:{lastError:(e as Error).message,attempts:10}});return {action:null,blockedEventId:event.id,message:(e as Error).message};}
 });if(!result.action)wakeWorker();return NextResponse.json(result);
}
