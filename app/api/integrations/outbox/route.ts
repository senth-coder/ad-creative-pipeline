import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { error } from '@/lib/api';

export async function GET(request:Request){
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!process.env.INTEGRATION_TOKEN||token!==process.env.INTEGRATION_TOKEN)return error('Not authorized',401);
 const events=await db.outboxEvent.findMany({where:{deliveredAt:null,attempts:{lt:10}},orderBy:{createdAt:'asc'},take:50});
 return NextResponse.json({events});
}
