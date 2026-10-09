import { NextResponse } from 'next/server';
import {Prisma} from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser, mayCreate } from '@/lib/permissions';
import { error,jsonBody } from '@/lib/api';
import { planSchema } from '@/lib/operations';

export async function GET(){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const [clients,team]=await Promise.all([db.client.findMany({include:{plan:true},orderBy:{name:'asc'}}),db.user.findMany({select:{id:true,name:true,email:true,role:true,weeklyCapacityHours:true},orderBy:{name:'asc'}})]);
 return NextResponse.json({clients:clients.map(c=>({id:c.id,name:c.name,code:c.code,plan:c.plan?{...c.plan,cycleStart:c.plan.cycleStart.toISOString().slice(0,10)}:null})),team});
}
export async function POST(request:Request){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const parsed=planSchema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid client plan');
 const input=parsed.data; if(!await db.client.findUnique({where:{id:input.clientId}}))return error('Client not found',404);
 for(const email of [input.approverEmail,input.releaseOwnerEmail].filter(Boolean)){if(!await db.user.findUnique({where:{email:email.toLowerCase()}}))return error('Owners must be registered team members');}
 const data={...input,deliverySchedule:input.deliverySchedule===null?Prisma.DbNull:input.deliverySchedule,approverEmail:input.approverEmail.toLowerCase(),releaseOwnerEmail:input.releaseOwnerEmail.toLowerCase(),cycleStart:new Date(input.cycleStart+'T12:00:00Z')};
 const plan=await db.$transaction(async tx=>{const p=await tx.clientPlan.upsert({where:{clientId:input.clientId},create:data,update:data});await tx.auditEvent.create({data:{actorId:user.id,action:'client.plan.updated',after:input}});return p;});
 return NextResponse.json({plan:{...plan,cycleStart:input.cycleStart}});
}
export async function PATCH(request:Request){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const parsed=z.object({userId:z.string(),weeklyCapacityHours:z.number().int().min(0).max(168)}).safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid capacity');
 const member=await db.user.findUnique({where:{id:parsed.data.userId}});if(!member||member.role!=='MAKER')return error('Maker not found',404);
 await db.$transaction(async tx=>{await tx.user.update({where:{id:member.id},data:{weeklyCapacityHours:parsed.data.weeklyCapacityHours}});await tx.auditEvent.create({data:{actorId:user.id,action:'team.capacity.updated',after:parsed.data}});});
 return NextResponse.json({saved:true});
}
