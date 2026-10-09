import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/permissions';
import { error, jsonBody } from '@/lib/api';

const schema=z.object({name:z.string().trim().min(2).max(100),email:z.email(),role:z.enum(['ADMIN','STRATEGIST','MAKER','QA','MEDIA_BUYER']),slackUserId:z.string().trim().optional()});
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);if(user.role!=='ADMIN'&&user.role!=='STRATEGIST')return error('Not permitted',403);const users=await db.user.findMany({orderBy:{name:'asc'},select:{id:true,name:true,email:true,role:true,slackUserId:true}});return NextResponse.json({users});}
export async function POST(request:Request){const user=await currentUser();if(!user)return error('Sign in required',401);if(user.role!=='ADMIN')return error('Not permitted',403);const parsed=schema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid user');const input=parsed.data;if(input.email.toLowerCase()===user.email&&input.role!=='ADMIN')return error('Keep your administrator role; another administrator can change it.',409);const created=await db.user.upsert({where:{email:input.email.toLowerCase()},create:{...input,email:input.email.toLowerCase()},update:{name:input.name,role:input.role,slackUserId:input.slackUserId}});return NextResponse.json({user:created},{status:201});}
