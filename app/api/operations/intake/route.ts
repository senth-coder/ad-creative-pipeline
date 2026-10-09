import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser,mayCreate } from '@/lib/permissions';
import { error,jsonBody } from '@/lib/api';
const providers=['motion','tally','slack','notion'];
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);const events=await db.inboundEvent.findMany({where:{provider:{in:providers}},orderBy:{receivedAt:'desc'},take:500});return NextResponse.json({events});}
export async function PATCH(request:Request){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const parsed=z.object({id:z.string(),duplicateOfId:z.string().optional(),reason:z.string().trim().min(3).max(500)}).safeParse(await jsonBody(request));if(!parsed.success)return error('Add a reason for dismissing this intake');
 const input=parsed.data;const event=await db.inboundEvent.findUnique({where:{id:input.id}});if(!event||!providers.includes(event.provider))return error('Intake not found',404);
 if(input.duplicateOfId){const original=await db.inboundEvent.findUnique({where:{id:input.duplicateOfId}});if(!original||original.id===event.id||!providers.includes(original.provider)||original.dismissedAt)return error('Choose an active original intake');}
 try{await db.$transaction(async tx=>{const result=await tx.inboundEvent.updateMany({where:{id:input.id,processedAt:null,dismissedAt:null},data:{dismissedAt:new Date(),duplicateOfId:input.duplicateOfId}});if(result.count!==1)throw new Error('Intake was already handled');await tx.auditEvent.create({data:{actorId:user.id,action:'intake.dismissed',after:{intakeId:input.id,duplicateOfId:input.duplicateOfId||null},reason:input.reason}});});return NextResponse.json({saved:true});}catch(e){return error((e as Error).message,409);}
}
