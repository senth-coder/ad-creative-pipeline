import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { error } from '@/lib/api';
import { verifySignature } from '@/lib/signature';

const schema=z.object({id:z.string().min(1),type:z.enum(['notification.sent','notification.failed']),outboxEventId:z.string().min(1),receiptId:z.string().optional()});
export async function POST(request:Request) {
 const body=await request.text();if(!verifySignature(body,request.headers.get('x-make-signature'),process.env.MAKE_WEBHOOK_SECRET))return error('Invalid signature',401);
 let json:unknown;try{json=JSON.parse(body)}catch{return error('Invalid JSON')};const parsed=schema.safeParse(json);if(!parsed.success)return error('Invalid event');
 const event=parsed.data;
 await db.$transaction(async tx=>{
  const prior=await tx.inboundEvent.findUnique({where:{externalId:`make:${event.id}`}});if(prior)return;
  await tx.inboundEvent.create({data:{provider:'make',externalId:`make:${event.id}`,payload:json as object,processedAt:new Date()}});
  if(event.type==='notification.sent')await tx.outboxEvent.updateMany({where:{id:event.outboxEventId,deliveredAt:null},data:{deliveredAt:new Date()}});
  else await tx.outboxEvent.updateMany({where:{id:event.outboxEventId},data:{attempts:{increment:1}}});
 });
 return NextResponse.json({accepted:true});
}
