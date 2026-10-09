import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error,jsonBody} from '@/lib/api';
import {onboardingSteps} from '@/lib/assurance';
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);return NextResponse.json({team:await db.user.findMany({select:{id:true,name:true,email:true,role:true,slackUserId:true,qaUnavailable:true,onboarding:true},orderBy:{name:'asc'}})});}
export async function PATCH(request:Request){const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);const parsed=z.object({userId:z.string(),qaUnavailable:z.boolean(),onboarding:z.array(z.enum(onboardingSteps))}).safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid team readiness');const {userId,...data}=parsed.data;try{await db.$transaction(async tx=>{await tx.user.update({where:{id:userId},data});await tx.auditEvent.create({data:{actorId:user.id,action:'team.readiness.updated',after:parsed.data}})});return NextResponse.json({saved:true})}catch{return error('Team member not found',404)}}
