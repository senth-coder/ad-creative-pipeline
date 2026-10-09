import {briefCode} from '@/lib/brief-plan';
import {db} from '@/lib/db';
import {launchSummary} from '@/lib/launch-summary';
import {readSchedule} from '@/lib/client-cadence';
import type { JobOperations } from '@/lib/operations';
import type { Job as DbJob, Prisma } from '@prisma/client';
import type { Job, Status } from '@/lib/workflow';
const labels: Record<DbJob['status'],Status>={BRIEFED:'Briefed',IN_PRODUCTION:'In Production',INTERNAL_REVIEW:'Internal Review',CLIENT_REVIEW:'Client Review',APPROVED:'Approved',DELIVERED:'Delivered'};
export const toDbStatus = Object.fromEntries(Object.entries(labels).map(([key,value])=>[value,key])) as Record<Status,DbJob['status']>;
export const jobInclude={client:{include:{plan:true,qaMembers:{include:{user:true}}}},campaign:true,concept:true,assignee:true,variants:true,launches:{select:{variantCode:true,status:true}},deliveryBatches:{orderBy:{createdAt:'desc' as const},take:1}} as const satisfies Prisma.JobInclude;
export function serializeJob(j: Prisma.JobGetPayload<{include:typeof jobInclude}>):Job {
 const batch=j.deliveryBatches[0];
 return {id:j.id,number:j.number,briefCode:briefCode(j.number),title:j.title,client:j.client.name,clientCode:j.client.code,clientPriority:(['Normal','High','Urgent'].includes(j.client.plan?.priority||'')?j.client.plan?.priority:'Normal') as Job['clientPriority'],deliverySchedule:readSchedule(j.client.plan?.deliverySchedule),campaign:j.campaign.name,concept:j.concept?.name||'',type:j.type as Job['type'],status:labels[j.status],assignee:j.assignee?.name||'Unassigned',qa:(j.brief as Record<string,string>|null)?.qaReviewerName||j.client.qaMembers.map(q=>q.user.name).join(', ')||'Unassigned',approvalOwner:j.client.plan?.approverEmail||undefined,releaseOwner:j.client.plan?.releaseOwnerEmail||undefined,mediaBuyerId:j.client.mediaBuyerId||undefined,mediaBuyer:j.client.mediaBuyerId?'Assigned media buyer':'Unassigned',...launchSummary(j.variants.map(v=>v.code),j.launches),due:j.dueAt.toISOString().slice(0,10),variants:j.variants.map(v=>v.code),reviewUrl:j.reviewUrl||'',source:({MANUAL:'Manual',MOTION:'Motion',TALLY:'Tally',SLACK:'Slack',NOTION:'Notion'} as const)[j.source],operations:(j.operations||undefined) as JobOperations|undefined,parentJobId:j.parentJobId||undefined,deliveredAt:batch?.completedAt?.toISOString(),updatedAt:j.updatedAt.toISOString(),briefRevision:j.briefRevision,brief:j.brief as Record<string,string>,deliveryError:batch?.error||undefined,deliveryBatchId:batch?.id,approvedBy:j.approvedBy||undefined,driveUrl:batch?.driveFolderId?`https://drive.google.com/drive/folders/${batch.driveFolderId}`:undefined,deliveryReceipt:batch?.slackReceiptId||undefined};
}

export async function serializeJobsForUi(jobs:Prisma.JobGetPayload<{include:typeof jobInclude}>[]){const ids=Array.from(new Set(jobs.flatMap(j=>j.client.mediaBuyerId?[j.client.mediaBuyerId]:[])));const people=ids.length?await db.user.findMany({where:{id:{in:ids}},select:{id:true,name:true}}):[];return jobs.map(j=>({...serializeJob(j),mediaBuyer:people.find(p=>p.id===j.client.mediaBuyerId)?.name||'Unassigned'}));}
export async function serializeJobForUi(job:Prisma.JobGetPayload<{include:typeof jobInclude}>){return (await serializeJobsForUi([job]))[0];}
