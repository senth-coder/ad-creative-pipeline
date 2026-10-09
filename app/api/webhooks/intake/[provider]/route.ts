import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { error } from '@/lib/api';
import { verifySignature } from '@/lib/signature';
import { intakeSchema } from '@/lib/operations';
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){
 const {provider}=await params;if(!['tally','slack','notion'].includes(provider))return error('Unsupported intake source',404);
 const body=await request.text();if(body.length>200000)return error('Payload too large',413);
 if(!verifySignature(body,request.headers.get('x-make-signature'),process.env.MAKE_WEBHOOK_SECRET))return error('Invalid signature',401);
 let json:unknown;try{json=JSON.parse(body)}catch{return error('Invalid JSON');}
 const parsed=intakeSchema.safeParse(json);if(!parsed.success)return error('Invalid intake payload');
 const event=await db.inboundEvent.upsert({where:{externalId:`${provider}:${parsed.data.id}`},create:{provider,externalId:`${provider}:${parsed.data.id}`,payload:parsed.data},update:{}});
 return NextResponse.json({accepted:true,id:event.id});
}
