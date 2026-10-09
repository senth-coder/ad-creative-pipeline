import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser,mayCreate,mayView } from '@/lib/permissions';
import { error,jsonBody } from '@/lib/api';
import {releaseProblem} from '@/lib/assurance';
import {readGovernance,serializeAsset} from '@/lib/assurance-server';
import { launchSchema,validateLaunch } from '@/lib/operations';
import { jobInclude,serializeJob } from '@/lib/serialize';

export async function GET(){
 const user=await currentUser();if(!user)return error('Sign in required',401);
 const where=mayCreate(user)?{}:user.role==='MEDIA_BUYER'?{job:{client:{mediaBuyerId:user.id}}}:user.role==='MAKER'?{job:{assigneeId:user.id}}:{job:{client:{qaMembers:{some:{userId:user.id}}}}};
 const launches=await db.launchRecord.findMany({where,orderBy:{updatedAt:'desc'},take:1000});
 return NextResponse.json({launches:launches.map(l=>({...l,plannedAt:l.plannedAt?.toISOString().slice(0,10)||'',launchedAt:l.launchedAt?.toISOString().slice(0,10)||''}))});
}
export async function POST(request:Request){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user)&&user.role!=='MEDIA_BUYER')return error('Not permitted',403);
 const parsed=launchSchema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid launch record');
 const {id,...input}=parsed.data;
 const job=await db.job.findUnique({where:{id:input.jobId},include:jobInclude});if(!job)return error('Job not found',404);if(!await mayView(user,job))return error('Not permitted',403);
 if(['Scheduled','Live'].includes(input.status)){const assets=await db.assetVersion.findMany({where:{variant:{jobId:job.id}},include:{variant:true}});const gate=releaseProblem([input.variantCode],assets.map(serializeAsset),readGovernance(job.client.governance),job.client.governanceVersion);if(gate)return error(gate,409);}
 const problem=validateLaunch(input,serializeJob(job));if(problem)return error(problem,409);
 if(id){const existing=await db.launchRecord.findUnique({where:{id}});if(!existing||existing.jobId!==job.id)return error('Launch not found',404);}
 const data={...input,plannedAt:input.plannedAt?new Date(input.plannedAt+'T12:00:00Z'):null,launchedAt:input.launchedAt?new Date(input.launchedAt+'T12:00:00Z'):null};
 try{
 const launch=await db.$transaction(async tx=>{
 const record=id?await tx.launchRecord.update({where:{id},data}):await tx.launchRecord.create({data});
 await tx.auditEvent.create({data:{jobId:job.id,actorId:user.id,action:'launch.updated',after:input}});
 return record;
 });return NextResponse.json({launch:{...launch,plannedAt:input.plannedAt,launchedAt:input.launchedAt}});
 }catch{return error('This variant already has a record for that platform and account. Edit the existing record.',409);}
}
