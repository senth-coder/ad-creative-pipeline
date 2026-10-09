import {canonicalQaClient,briefFormats,qaChoices,reviewerNames} from '@/lib/qa-routing';
import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error} from '@/lib/api';
import {readGovernance} from '@/lib/assurance-server';
import {routeQa} from '@/lib/assurance';
export async function GET(){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const [clients,people,pending,receipts,wake]=await Promise.all([db.client.findMany(),db.user.findMany(),db.outboxEvent.findMany({where:{deliveredAt:null},select:{id:true,type:true,attempts:true,lastError:true,createdAt:true,leasedUntil:true},orderBy:{createdAt:'asc'},take:100}),db.inboundEvent.findFirst({where:{provider:{in:['make','delivery']}},orderBy:{receivedAt:'desc'},select:{receivedAt:true}}),db.auditEvent.findFirst({where:{action:{in:['worker.wake.accepted','worker.wake.failed']}},orderBy:{at:'desc'},select:{action:true,at:true,reason:true}})]);
 const configuration=['DATABASE_URL','AUTH_SECRET','AUTH_GOOGLE_ID','AUTH_GOOGLE_SECRET','MAKE_WEBHOOK_SECRET','INTEGRATION_TOKEN'].map(key=>({key,configured:Boolean(process.env[key])}));
 const checks=clients.map(c=>{const g=readGovernance(c.governance);const buyer=people.find(p=>p.id===c.mediaBuyerId);const qa=routeQa(g,people.map(p=>({...p,onboarding:undefined})));return {id:c.id,name:c.name,issues:[!c.driveRootId?'Set a Drive root folder':null,!buyer?.slackUserId?'Map the media buyer to Slack':null,!g.rulesConfirmed?'Confirm source-linked client rules':null,canonicalQaClient(c.name)?(briefFormats.some(f=>{const choices=qaChoices(c.name,f,people);return choices.length!==reviewerNames(c.name,f).length||!choices.some(p=>!p.qaUnavailable&&p.slackUserId);})?'Check format QA reviewer availability and Slack mappings':null):!qa.person?qa.reason:null].filter(Boolean)}});
 return NextResponse.json({worker:{automatic:Boolean(process.env.MAKE_WORKER_WAKE_URL),lastWake:wake},configuration,clients:checks,pending,lastWorkerReceiptAt:receipts?.receivedAt||null,mode:process.env.NEXT_PUBLIC_DATA_MODE==='server'?'server':'preview'});
}
