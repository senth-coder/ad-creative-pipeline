import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {currentUser,mayView} from '@/lib/permissions';
import {error} from '@/lib/api';
const status:Record<string,string>={BRIEFED:'Briefed',IN_PRODUCTION:'In Production',INTERNAL_REVIEW:'Internal QA',CLIENT_REVIEW:'Client QA',APPROVED:'Approved',DELIVERED:'Delivered'};
const labels:Record<string,string>={'launch.updated':'Launch confirmation updated','job.created':'Brief created','job.updated':'Job details updated','job.transition':'Stage changed','review.changes_required':'Changes requested','asset.revision.registered':'Asset revision registered','asset.qa.reviewed':'Asset QA recorded','delivery.manifest.created':'Delivery prepared','job.delivered':'Drive delivery and buyer notification confirmed','job.readiness.updated':'Readiness and blockers updated','delivery.retry_requested':'Delivery retry requested','acceptance.fixture.created':'Synthetic test job created','acceptance.providers.verified':'Synthetic delivery test verified'};
function stage(value:unknown){const s=(value as {status?:string}|null)?.status;return s?status[s]:undefined;}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return error('Sign in required',401);
 const {id}=await params,job=await db.job.findUnique({where:{id}});if(!job)return error('Job not found',404);if(!await mayView(user,job))return error('Not permitted',403);
 const events=await db.auditEvent.findMany({where:{jobId:id},orderBy:{at:'desc'},take:100,include:{actor:{select:{name:true}}}});
 return NextResponse.json({events:events.map(e=>({id:e.id,label:labels[e.action]||e.action.replaceAll('.',' '),from:stage(e.before),to:stage(e.after),actor:e.actor?.name||'Automation',at:e.at,reason:e.reason||undefined}))});
}
