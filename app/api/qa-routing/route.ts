import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error} from '@/lib/api';
import {activeQaClients,briefFormats,qaChoices,reviewerNames,canonicalQaClient} from '@/lib/qa-routing';
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);const people=await db.user.findMany();const clients=await db.client.findMany();return NextResponse.json({routes:activeQaClients.map(name=>({client:clients.find(c=>canonicalQaClient(c.name)===name)?.name||name,exists:clients.some(c=>canonicalQaClient(c.name)===name),formats:briefFormats.map(format=>({format,names:reviewerNames(name,format),reviewers:qaChoices(name,format,people).map(p=>({id:p.id,name:p.name,unavailable:p.qaUnavailable,slackReady:Boolean(p.slackUserId)}))}))}))});}
export async function POST(request:Request){const user=await currentUser();if(!user||user.role!=='ADMIN')return error('Administrator required',403);if(request.headers.get('origin')!==new URL(request.url).origin)return error('Invalid origin',403);if(user.email.toLowerCase()!==(process.env.ROUTING_APPROVER_EMAIL||'senth@ghostgrowth.io').toLowerCase())return error('Senth must apply this QA roster',403);
 try{const result=await db.$transaction(async tx=>{
 const people=await tx.user.findMany();const existing=await tx.client.findMany();
 const names=[...new Set(activeQaClients.flatMap(c=>briefFormats.flatMap(f=>reviewerNames(c,f))))];
 for(const name of names){if(people.filter(p=>p.name===name&&['QA','ADMIN','STRATEGIST'].includes(p.role)).length!==1)throw new Error(`Resolve reviewer identity: ${name}`);}
 const missing=activeQaClients.filter(name=>!existing.some(c=>canonicalQaClient(c.name)===name));
 if(missing.length)await tx.client.createMany({data:missing.map(name=>({name,code:name.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)}))});
 const clients=(await tx.client.findMany()).filter(c=>canonicalQaClient(c.name));
 await tx.clientQa.deleteMany({where:{clientId:{in:clients.map(c=>c.id)}}});
 const assignments=clients.flatMap(client=>[...new Set(briefFormats.flatMap(f=>reviewerNames(client.name,f)))].map(name=>({clientId:client.id,userId:people.find(p=>p.name===name&&['QA','ADMIN','STRATEGIST'].includes(p.role))!.id})));
 await tx.clientQa.createMany({data:assignments});
 await tx.auditEvent.create({data:{actorId:user.id,action:'qa.format_roster.applied',after:{rosterVersion:'2026-10-09',clients:activeQaClients,scienceUgc:'Mattan',scienceOther:'Simon Harris',sharedAssignment:'Strategist chooses reviewer per brief'}}});
 return {clients:clients.length,created:missing.length};
 },{timeout:30000});return NextResponse.json({saved:true,...result});}catch(e){const message=(e as Error).message;return error(message.startsWith('Resolve reviewer identity:')?message:'Roster could not be saved. No partial routing changes were committed. Please retry.',409);}}
