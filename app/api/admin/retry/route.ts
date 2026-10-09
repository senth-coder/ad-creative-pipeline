import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error,jsonBody} from '@/lib/api';
export async function POST(request:Request){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const parsed=z.object({eventId:z.string().min(1)}).safeParse(await jsonBody(request));if(!parsed.success)return error('Choose an event');
 try{await db.$transaction(async tx=>{const pending=await tx.outboxEvent.findUnique({where:{id:parsed.data.eventId}});if(pending?.lastError?.startsWith('WORKER_PENDING:'))throw new Error('Provider outcome is uncertain. Resume the saved Make completion step or reconcile the existing file/message before requesting a new action.');const changed=await tx.outboxEvent.updateMany({where:{id:parsed.data.eventId,deliveredAt:null,OR:[{leasedUntil:null},{leasedUntil:{lt:new Date()}}]},data:{attempts:0,leaseToken:null,leasedUntil:null,lastError:null}});if(!changed.count)throw new Error('Event is complete or currently being processed');await tx.auditEvent.create({data:{actorId:user.id,action:'integration.retry_requested',after:{eventId:parsed.data.eventId}}});});return NextResponse.json({queued:true});}catch(e){return error((e as Error).message,409)}
}
