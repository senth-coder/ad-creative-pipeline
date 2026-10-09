import {briefCode} from './brief-plan';
import {slackText} from './worker';
export const pipelineChannel={id:'C0BC58ZU6BH',name:'adrequest-pipeline'};
const statuses:Record<string,string>={BRIEFED:'Briefed',IN_PRODUCTION:'In Production',INTERNAL_REVIEW:'Internal QA',CLIENT_REVIEW:'Client QA',APPROVED:'Approved',DELIVERED:'Delivered'};
export type NoticeJob={id:string;number:number;title:string;status:string;type:string;dueAt:Date;client:{name:string};assignee:{name:string;slackUserId:string|null}|null};
export function channelNotices(job:NoticeJob,change:{from?:string;to:string;reason?:string;feedbackUrl?:string;revisionDue?:string;assignment?:boolean},base:string){
 const revision=change.to==='IN_PRODUCTION'&&['INTERNAL_REVIEW','CLIENT_REVIEW'].includes(change.from||'');
 const status=`${change.from?`${statuses[change.from]||change.from} → `:''}${statuses[change.to]||change.to}`;
 const code=briefCode(job.number);const owner=job.assignee?.slackUserId&&/^U[A-Z0-9]+$/.test(job.assignee.slackUserId)?`<@${job.assignee.slackUserId}>`:slackText(job.assignee?.name||'Unassigned');
 const text=`*${revision?'Changes required — returned to production':change.assignment?'Creative assigned':'Creative status update'}*\n*${code}* · ${slackText(job.client.name)} · ${slackText(job.title)}\nStatus: ${slackText(status)}\nFormat: ${slackText(job.type)}\nDesigner / editor: ${owner}\n${revision?'Revision due':'Due'}: ${slackText(revision?change.revisionDue||'Not set':job.dueAt.toISOString().slice(0,10))}${change.reason?`\nReason: ${slackText(change.reason)}`:''}${change.feedbackUrl?`\nFeedback: ${slackText(change.feedbackUrl)}`:''}\nBrief: ${base.replace(/\/$/,'')}/?job=${encodeURIComponent(job.id)}`;
 // All designers and editors use the same request-pipeline channel.
 // A revision is one status event, so it produces one channel message.
 return [{channelId:pipelineChannel.id,channelName:pipelineChannel.name,text}];
}
