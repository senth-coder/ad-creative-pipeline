import type {Job,Status} from './workflow';
import {operationsFor} from './operations';

export const stageGuide:Record<Status,{step:number;phase:string;owner:string;description:string;exit:string;tab:string}>={
 'Briefed':{step:1,phase:'Create',owner:'Strategist',description:'A job is ready to be assigned.',exit:'Assign a designer or editor, then start production.',tab:'Overview'},
 'In Production':{step:2,phase:'Create',owner:'Designer / editor',description:'Build the assets and resolve revisions.',exit:'Register final exports, add the review link and finish the six pre-review checks.',tab:'QA & blockers'},
 'Internal Review':{step:3,phase:'Review',owner:'Internal QA',description:'Check every variant against the brief and client rules.',exit:'Record asset QA, then send to client review. Revisions go back to production.',tab:'Assets & results'},
 'Client Review':{step:4,phase:'Review',owner:'Strategist + client',description:'Collect approval outside Creative OS.',exit:'Save the client approval reference, then approve delivery. Revisions go back to production.',tab:'QA & blockers'},
 'Approved':{step:5,phase:'Deliver',owner:'Automation',description:'The approved exports are being delivered.',exit:'Make verifies the named files in Drive and sends the assigned buyer a Slack DM.',tab:'Delivery'},
 'Delivered':{step:6,phase:'Deliver',owner:'Media buyer',description:'Final files and the buyer notification are confirmed.',exit:'Open the Drive files. Record launches and results when available.',tab:'Delivery'},
};
export function movementLabel(from:Status,to:Status){
 if(to==='In Production')return from==='Briefed'?'Start production':'Request changes';
 if(to==='Internal Review')return 'Send to internal QA';
 if(to==='Client Review')return 'Send to client review';
 if(to==='Approved')return 'Approve & start delivery';
 return `Move to ${to}`;
}
export function nextOwner(job:Job){
 const ops=operationsFor(job);
 if(ops.blockerReason&&job.status!=='Delivered')return ops.blockerOwner||'Blocker owner needed';
 if(job.status==='Briefed')return 'Strategist';
 if(job.status==='In Production')return job.assignee==='Unassigned'?'Maker not assigned':job.assignee;
 if(job.status==='Internal Review')return job.qa==='Unassigned'?'QA not assigned':job.qa;
 if(job.status==='Client Review')return job.approvalOwner||'Strategist';
 return job.status==='Delivered'?job.mediaBuyer:stageGuide[job.status].owner;
}
export function nextAction(job:Job){
 const ops=operationsFor(job);
 if(ops.blockerReason&&job.status!=='Delivered')return 'Resolve blocker';
 if(job.status==='Briefed')return job.assignee==='Unassigned'?'Assign a maker':'Start production';
 if(job.status==='In Production')return ops.revisionReason?'Finish requested revisions':'Prepare QA handoff';
 if(job.status==='Internal Review')return 'Review assets & record QA';
 if(job.status==='Client Review')return 'Record external client approval';
 if(job.status==='Approved')return job.deliveryError?'Resolve delivery issue':job.driveUrl?'Confirm buyer notification':'Verify files in Drive';
 return 'Open final delivery';
}
