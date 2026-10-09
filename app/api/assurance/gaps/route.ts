import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error,jsonBody} from '@/lib/api';
import {gapSchema} from '@/lib/assurance';
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);return NextResponse.json({gaps:await db.gapAssessment.findMany()});}
export async function POST(request:Request){const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);const parsed=gapSchema.safeParse(await jsonBody(request));if(!parsed.success)return error('A validated finding needs an evidence link');const d=parsed.data;if(d.status!=='Reported'&&user.email.toLowerCase()!==(process.env.ROUTING_APPROVER_EMAIL||'senth@ghostgrowth.io').toLowerCase())return error('Senth must confirm the gap assessment',403);await db.$transaction(async tx=>{await tx.gapAssessment.upsert({where:{key:d.key},create:{...d,confirmedBy:d.status==='Reported'?null:user.email},update:{...d,confirmedBy:d.status==='Reported'?null:user.email}});await tx.auditEvent.create({data:{actorId:user.id,action:'gap.assessed',after:d}})});return NextResponse.json({saved:true});}
