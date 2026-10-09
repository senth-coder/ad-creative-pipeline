import { z } from 'zod';
import type { Job } from './workflow';

export const qaChecks = [
  ['offer','Price and offer match the final brief'],
  ['brand','Correct logo, packaging and approved assets'],
  ['claims','Required disclaimers and approved claims are present'],
  ['mobile','Copy is readable on mobile and within safe zones'],
  ['format','Format, dimensions and variant count match the brief'],
  ['access','Review links open for the assigned reviewers'],
] as const;
const optionalUrl=z.union([z.url().refine(v=>/^https?:\/\//i.test(v),'Use an HTTP or HTTPS URL'),z.literal('')]);
export const operationsSchema=z.object({
  priority:z.enum(['Normal','High','Urgent']).default('Normal'),
  effortHours:z.number().min(0).max(500).default(0),
  blockerReason:z.string().trim().max(1000).default(''),
  blockerOwner:z.string().trim().max(100).default(''),
  blockedUntil:z.union([z.iso.date(),z.literal('')]).default(''),
  checklist:z.array(z.enum(['offer','brand','claims','mobile','format','access'])).default([]),
  revisionReason:z.string().trim().max(1000).default(''),
  feedbackUrl:optionalUrl.default(''),
  revisionDue:z.union([z.iso.date(),z.literal('')]).default(''),
  approvalEvidenceUrl:optionalUrl.default(''),
}).strict();
export type JobOperations=z.infer<typeof operationsSchema>;
export const emptyOperations=():JobOperations=>operationsSchema.parse({});
export function operationsFor(job:Pick<Job,'operations'>):JobOperations {return {...emptyOperations(),...job.operations};}
export function reviewReadiness(job:Job,next:string):string|null {
  const ops=operationsFor(job);
  if(ops.blockerReason)return 'Clear the blocker before moving this job.';
  if(next==='In Production'&&job.assignee==='Unassigned')return 'Assign a designer or editor first.';
  if(['Internal Review','Client Review','Approved'].includes(next)&&!job.reviewUrl)return 'Add a review link first.';
  if(next==='Internal Review'&&!qaChecks.every(([key])=>ops.checklist.includes(key)))return 'Complete all six pre-review checks first.';
  return null;
}
export const planSchema=z.object({clientId:z.string().min(1),cycleStart:z.iso.date(),cadenceDays:z.union([z.literal(7),z.literal(14)]),targetJobs:z.number().int().min(0).max(1000),targetVariants:z.number().int().min(0).max(10000),formatMix:z.string().trim().max(500),approverEmail:z.union([z.email(),z.literal('')]),releaseOwnerEmail:z.union([z.email(),z.literal('')]),notes:z.string().max(1500)});
export type ClientPlan=z.infer<typeof planSchema>;
export type TeamMember={id:string;name:string;email:string;role:string;weeklyCapacityHours:number};
export type PlanClient={id:string;name:string;code:string;plan:ClientPlan|null};
export const launchStatuses=['Not launched','Scheduled','Live','Paused','Needs retest'] as const;
export const launchSchema=z.object({id:z.string().optional(),jobId:z.string(),variantCode:z.string().regex(/^[A-Z]$/),platform:z.enum(['Meta','Google','TikTok','Other']),account:z.string().trim().min(1).max(120),status:z.enum(launchStatuses),plannedAt:z.union([z.iso.date(),z.literal('')]),launchedAt:z.union([z.iso.date(),z.literal('')]),destinationUrl:optionalUrl,adUrl:optionalUrl,campaign:z.string().max(200),adSet:z.string().max(200),notes:z.string().max(2000)});
export type LaunchRecord=z.infer<typeof launchSchema>;
export function validateLaunch(launch:LaunchRecord,job:Pick<Job,'status'|'variants'>):string|null {
  if(job.status!=='Delivered')return 'Launch records require a delivered job.';
  if(!job.variants.includes(launch.variantCode))return 'Variant does not belong to this job.';
  if(launch.status==='Scheduled'&&(!launch.plannedAt||!launch.destinationUrl))return 'Scheduled launches need a date and destination URL.';
  if(['Live','Paused','Needs retest'].includes(launch.status)&&(!launch.launchedAt||!launch.adUrl||!launch.destinationUrl))return 'Record the actual launch date, destination URL and ad link.';
  return null;
}
export function cycleWindow(start:string,cadence:number,today:string){
  const anchor=Date.parse(start+'T00:00:00Z'),now=Date.parse(today+'T00:00:00Z'),day=86400000;
  const offset=Math.max(0,Math.floor((now-anchor)/(cadence*day)));
  const from=new Date(anchor+offset*cadence*day).toISOString().slice(0,10);
  const until=new Date(anchor+(offset+1)*cadence*day).toISOString().slice(0,10);
  return {from,until};
}
export type Intake={id:string;provider:string;externalId:string;receivedAt:string;processedAt?:string|null;dismissedAt?:string|null;duplicateOfId?:string|null;jobId?:string|null;payload:{title?:string;client?:string;sourceUrl?:string;task?:{title?:string};brief?:Record<string,string>;offers?:{name:string;price?:string;url?:string}[];attachments?:{name:string;url:string}[]}};
export type IntakeDraft={title:string;eventId?:string;source?:Job['source'];client?:string;brief?:Record<string,string>;parentJobId?:string;creativeType?:Job['type'];campaign?:string;concept?:string};
export const intakeSchema=z.object({id:z.string().min(1).max(200),title:z.string().trim().min(2).max(160),client:z.string().trim().max(100),sourceUrl:optionalUrl.default(''),brief:z.record(z.string(),z.string()).default({}),offers:z.array(z.object({name:z.string().min(1),price:z.string().optional(),url:optionalUrl.optional()})).max(50).default([]),attachments:z.array(z.object({name:z.string(),url:optionalUrl})).max(50).default([])});
export function intakeTitle(event:Intake){return event.payload.title||event.payload.task?.title||'Untitled intake';}
export function duplicateCandidates(event:Intake,events:Intake[]){return events.filter(other=>other.id!==event.id&&!other.dismissedAt&&intakeTitle(other).trim().toLowerCase()===intakeTitle(event).trim().toLowerCase()&&(other.payload.client||'').trim().toLowerCase()===(event.payload.client||'').trim().toLowerCase());}

export function localDate(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
