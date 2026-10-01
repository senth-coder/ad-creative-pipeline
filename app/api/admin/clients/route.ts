import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/permissions';
import { error, jsonBody } from '@/lib/api';

const schema=z.object({name:z.string().trim().min(2).max(100),code:z.string().trim().regex(/^[A-Z0-9]{2,12}$/),driveRootId:z.string().trim().optional(),mediaBuyerEmail:z.email().optional(),qaEmails:z.array(z.email()).default([])});
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);if(user.role!=='ADMIN'&&user.role!=='STRATEGIST')return error('Not permitted',403);const clients=await db.client.findMany({include:{qaMembers:{include:{user:true}}},orderBy:{name:'asc'}});return NextResponse.json({clients});}
export async function POST(request:Request){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(user.role!=='ADMIN')return error('Not permitted',403);
 const parsed=schema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid client');const input=parsed.data;
 const buyer=input.mediaBuyerEmail?await db.user.findUnique({where:{email:input.mediaBuyerEmail.toLowerCase()}}):null;if(input.mediaBuyerEmail&&!buyer)return error('Media buyer user not found');
 const qa=await db.user.findMany({where:{email:{in:input.qaEmails.map(e=>e.toLowerCase())},role:'QA'}});if(qa.length!==input.qaEmails.length)return error('Each QA email must belong to a QA user');
 try{const client=await db.client.create({data:{name:input.name,code:input.code,driveRootId:input.driveRootId||null,mediaBuyerId:buyer?.id,qaMembers:{create:qa.map(u=>({userId:u.id}))}}});return NextResponse.json({client},{status:201})}catch{return error('Client name or code already exists',409)}
}
