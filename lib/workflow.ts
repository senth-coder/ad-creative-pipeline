import { reviewReadiness, operationsFor, type JobOperations } from './operations';
export const statuses = ['Briefed','In Production','Internal Review','Client Review','Approved','Delivered'] as const;
export type Status = typeof statuses[number];
export type CreativeType = 'Video' | 'Static' | 'Carousel' | 'Motion';
export type Job = { id: string; number: number; title: string; client: string; clientCode?: string; campaign: string; concept: string; type: CreativeType; status: Status; assignee: string; qa: string; mediaBuyer: string; approvalOwner?:string; releaseOwner?:string; due: string; variants: string[]; reviewUrl: string; source: 'Manual' | 'Motion' | 'Tally' | 'Slack' | 'Notion'; operations?: JobOperations; parentJobId?: string; deliveredAt?: string; updatedAt: string; brief?: Record<string,string>; briefRevision?:number; deliveryError?: string; deliveryBatchId?: string; approvedBy?: string; driveUrl?: string; deliveryReceipt?: string };
export const transitions: Record<Status, Status[]> = {
  'Briefed': ['In Production'], 'In Production': ['Internal Review'], 'Internal Review': ['In Production','Client Review'], 'Client Review': ['In Production','Approved'], 'Approved': [], 'Delivered': []
};
export function transition(job: Job, next: Status, actor: string): Job {
  if (!transitions[job.status].includes(next)) throw new Error(`Cannot move ${job.status} to ${next}`);
  const issue=reviewReadiness(job,next); if(issue)throw new Error(issue);
  const ops=operationsFor(job);
  if(next==='Approved'&&!ops.approvalEvidenceUrl)throw new Error('Record the external approval reference in QA & blockers.');
  if(next==='In Production'&&job.status!=='Briefed'&&(!ops.revisionReason||!ops.feedbackUrl||!ops.revisionDue))throw new Error('Record the revision reason, feedback link and return date in QA & blockers.');
  return { ...job, operations:next==='In Production'&&job.status!=='Briefed'?{...ops,checklist:[],approvalEvidenceUrl:''}:ops, status: next, updatedAt: new Date().toISOString(), ...(next === 'Approved' ? {approvedBy: actor} : {}) };
}
export const seedJobs: Job[] = [
  {id:'j-501',number:501,title:'Fresh start hooks',client:'Ghost Growth',campaign:'Autumn Acquisition',concept:'First impression',type:'Video',status:'Briefed',assignee:'Unassigned',qa:'Creative QA',mediaBuyer:'Media buyer',due:'2026-10-08',variants:['A','B','C'],reviewUrl:'',source:'Manual',updatedAt:'2026-10-01T13:00:00Z'},
  {id:'j-500',number:500,title:'Product benefits cutdowns',client:'CareBox',campaign:'Q4 Growth',concept:'More in every box',type:'Video',status:'In Production',assignee:'Alex Morgan',qa:'CareBox QA',mediaBuyer:'Jordan Lee',due:'2026-10-05',variants:['A','B','C','D'],reviewUrl:'https://frame.io/',source:'Motion',updatedAt:'2026-10-01T12:00:00Z'},
  {id:'j-499',number:499,title:'Testimonial refresh',client:'CareBox',campaign:'Q4 Growth',concept:'Real customer stories',type:'Static',status:'Internal Review',assignee:'Sam Rivera',qa:'CareBox QA',mediaBuyer:'Jordan Lee',due:'2026-10-03',variants:['A','B'],reviewUrl:'https://figma.com/',source:'Manual',updatedAt:'2026-09-30T15:00:00Z'},
  {id:'j-498',number:498,title:'Unboxing story',client:'Northstar',campaign:'October Launch',concept:'The reveal',type:'Motion',status:'Client Review',assignee:'Taylor Chen',qa:'Northstar QA',mediaBuyer:'Morgan Hill',due:'2026-10-04',variants:['A','B','C'],reviewUrl:'https://frame.io/',source:'Motion',updatedAt:'2026-09-30T14:00:00Z'},
  {id:'j-497',number:497,title:'Feature spotlight set',client:'Northstar',campaign:'October Launch',concept:'Made for your day',type:'Carousel',status:'Approved',assignee:'Sam Rivera',qa:'Northstar QA',mediaBuyer:'Morgan Hill',due:'2026-10-02',variants:['A','B'],reviewUrl:'https://figma.com/',source:'Manual',updatedAt:'2026-09-29T13:00:00Z'},
  {id:'j-496',number:496,title:'Lifestyle video series',client:'Ghost Growth',campaign:'Summer Retargeting',concept:'Everyday moments',type:'Video',status:'Delivered',assignee:'Alex Morgan',qa:'Creative QA',mediaBuyer:'Media buyer',due:'2026-09-25',variants:['A','B','C'],reviewUrl:'https://frame.io/',source:'Manual',updatedAt:'2026-09-25T18:00:00Z',driveUrl:'https://drive.google.com/',deliveryReceipt:'Slack DM confirmed'}
];
export function variantsFor(type: CreativeType) { return type === 'Carousel' ? ['A','B'] : type === 'Static' ? ['A','B','C'] : type === 'Motion' ? ['A','B'] : ['A','B','C','D']; }
