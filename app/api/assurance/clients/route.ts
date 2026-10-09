import {canonicalQaClient,briefFormats,reviewerNames} from '@/lib/qa-routing';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error,jsonBody} from '@/lib/api';
import {governanceSchema} from '@/lib/assurance';
import {readGovernance} from '@/lib/assurance-server';
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);const scope=mayCreate(user)?{}:user.role==='QA'?{qaMembers:{some:{userId:user.id}}}:user.role==='MAKER'?{jobs:{some:{assigneeId:user.id}}}:{mediaBuyerId:user.id};const clients=await db.client.findMany({where:scope,orderBy:{name:'asc'}});return NextResponse.json({clients:clients.map(c=>({id:c.id,name:c.name,code:c.code,governance:readGovernance(c.governance),governanceVersion:c.governanceVersion,confirmedBy:c.confirmedBy})),canConfirmRouting:user.email.toLowerCase()===(process.env.ROUTING_APPROVER_EMAIL||'senth@ghostgrowth.io').toLowerCase()});}
export async function POST(request:Request){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const parsed=z.object({clientId:z.string(),expectedVersion:z.number().int(),governance:governanceSchema}).safeParse(await jsonBody(request));if(!parsed.success)return error(parsed.error.issues.map(i=>i.message).join('; '));
 const {clientId,expectedVersion,governance:g}=parsed.data;const client=await db.client.findUnique({where:{id:clientId}});if(!client)return error('Client not found',404);
 const previous=readGovernance(client.governance);const changedRoute=previous.primaryQaEmail!==g.primaryQaEmail||previous.backupQaEmail!==g.backupQaEmail||previous.routingConfirmed!==g.routingConfirmed;
 if(g.routingConfirmed&&changedRoute&&user.email.toLowerCase()!==(process.env.ROUTING_APPROVER_EMAIL||'senth@ghostgrowth.io').toLowerCase())return error('Senth must confirm QA routing changes',403);
 const emails=[g.primaryQaEmail,g.backupQaEmail].filter(Boolean).map(e=>e.toLowerCase());const reviewers=await db.user.findMany({where:{email:{in:emails},role:{in:['QA','ADMIN','STRATEGIST']}}});
 if(reviewers.length!==new Set(emails).size)return error('Reviewers must be registered QA, admin or strategist users');
 const policyChanged=JSON.stringify(previous.rules)!==JSON.stringify(g.rules)||previous.rulesConfirmed!==g.rulesConfirmed||previous.guidelinesUrl!==g.guidelinesUrl||previous.publisher!==g.publisher;
 try{await db.$transaction(async tx=>{
 const updated=await tx.client.updateMany({where:{id:clientId,governanceVersion:expectedVersion},data:{governance:g,governanceVersion:{increment:1},confirmedBy:g.routingConfirmed?(changedRoute?user.email:client.confirmedBy):null}});if(updated.count!==1)throw new Error('Client rules changed. Refresh and try again.');
 await tx.clientQa.deleteMany({where:{clientId}});
 if(canonicalQaClient(client.name)){const names=[...new Set(briefFormats.flatMap(f=>reviewerNames(client.name,f)))];const mapped=await tx.user.findMany({where:{name:{in:names},role:{in:['QA','ADMIN','STRATEGIST']}}});for(const p of mapped)await tx.clientQa.upsert({where:{clientId_userId:{clientId,userId:p.id}},create:{clientId,userId:p.id},update:{}});}
 if(g.routingConfirmed){for(const reviewer of reviewers)await tx.clientQa.upsert({where:{clientId_userId:{clientId,userId:reviewer.id}},create:{clientId,userId:reviewer.id},update:{}});}
 await tx.auditEvent.create({data:{actorId:user.id,action:'client.governance.updated',after:{clientId,version:expectedVersion+1,policyChanged,routingConfirmed:g.routingConfirmed}}});
 });return NextResponse.json({saved:true,version:expectedVersion+1});}catch(e){return error((e as Error).message,409)}
}
