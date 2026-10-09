import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {error} from '@/lib/api';
import {verifySignature} from '@/lib/signature';
const schema=z.object({id:z.string().min(1),type:z.enum(['notification.sent','notification.failed']),outboxEventId:z.string().min(1),receiptId:z.string().optional(),leaseToken:z.string().optional(),message:z.string().max(1000).optional()});
export async function POST(request:Request){const body=await request.text();if(!verifySignature(body,request.headers.get('x-make-signature'),process.env.MAKE_WEBHOOK_SECRET))return error('Invalid signature',401);let json:unknown;try{json=JSON.parse(body)}catch{return error('Invalid JSON')};const parsed=schema.safeParse(json);if(!parsed.success)return error('Invalid event');const e=parsed.data;
 try{await db.$transaction(async tx=>{if(await tx.inboundEvent.findUnique({where:{externalId:`make:${e.id}`}}))return;const event=await tx.outboxEvent.findUnique({where:{id:e.outboxEventId}});if(!event)throw new Error('Outbox event not found');if(event.deliveredAt)return;
 if(event.leaseToken&&(event.leaseToken!==e.leaseToken||!event.leasedUntil||event.leasedUntil<new Date()))throw new Error('Expired or incorrect work lease');if(e.type==='notification.sent'&&!e.receiptId)throw new Error('Receipt ID required');
 await tx.inboundEvent.create({data:{provider:'make',externalId:`make:${e.id}`,payload:json as object,processedAt:new Date()}});
 const updated=await tx.outboxEvent.updateMany({where:{id:event.id,deliveredAt:null,leaseToken:event.leaseToken},data:e.type==='notification.sent'?{deliveredAt:new Date(),lastError:null,leaseToken:null,leasedUntil:null}:{lastError:e.message||'Worker reported a failure',leaseToken:null,leasedUntil:null,...(!event.leaseToken?{attempts:{increment:1}}:{})}});if(updated.count!==1)throw new Error('Event lease changed while acknowledging');
 });return NextResponse.json({accepted:true});}catch(e){return error((e as Error).message,409)}
}
