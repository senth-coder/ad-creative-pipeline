import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { error } from '@/lib/api';
import { verifySignature } from '@/lib/signature';

const eventSchema=z.object({id:z.string().min(1),type:z.string().min(1),task:z.object({id:z.string().min(1),title:z.string().optional()}).optional()});
export async function POST(request:Request) {
 const body=await request.text();
 if(!verifySignature(body,request.headers.get('x-motion-signature'),process.env.MOTION_WEBHOOK_SECRET))return error('Invalid signature',401);
 let json:unknown;try{json=JSON.parse(body)}catch{return error('Invalid JSON')};
 const parsed=eventSchema.safeParse(json);if(!parsed.success)return error('Invalid event');
 const event=parsed.data;
 await db.inboundEvent.upsert({where:{externalId:`motion:${event.id}`},create:{provider:'motion',externalId:`motion:${event.id}`,payload:json as object},update:{}});
 // Motion events are import candidates until a strategist reviews the brief and client mapping.
 return NextResponse.json({accepted:true});
}
