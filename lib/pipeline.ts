import type {Job,Status} from './workflow';
import {operationsFor} from './operations';

export const stageTitle=(status:Status)=>status==='Internal Review'?'Internal QA':status==='Client Review'?'Client QA':status;
export const stageGuide:Record<Status,{step:number;phase:string;owner:string;description:string;exit:string;tab:string}>={
 'Briefed':{step:1,phase:'Create',owner:'Strategist',description:'A job is ready to be assigned.',exit:'Assign a designer or editor, then start production.',tab:'Overview'},
 'In Production':{step:2,phase:'Create',owner:'Designer / editor',description:'Build the assets and resolve revisions.',exit:'Register final exports, add the review link and finish the six pre-review checks.',tab:'QA & blockers'},
 'Internal Review':{step:3,phase:'Review',owner:'Internal QA',description:'Team-only QA: verify every variant before the client sees it.',exit:'Record a passing internal QA review for every current asset revision. Then send to Client QA. Requested changes return to production.',tab:'Assets & results'},
 'Client Review':{step:4,phase:'Review',owner:'Strategist + client',description:'Client QA: collect feedback and explicit client approval.',exit:'The client reviews in Figma or Frame.io. Save their explicit approval reference, then select Approve & start delivery. Internal QA alone cannot approve delivery.',tab:'QA & blockers'},
 'Approved':{step:5,phase:'Deliver',owner:'Automation',description:'The approved exports are being delivered.',exit:'Make verifies the named files in Drive and sends the assigned buyer a Slack DM.',tab:'Delivery'},
 'Delivered':{step:6,phase:'Deliver',owner:'Media buyer',description:'Final files and the buyer notification are confirmed.',exit:'Open the Drive files. Record launches and results when available.',tab:'Delivery'},
};
export function movementLabel(from:Status,to:Status){
 if(to==='In Production')return from==='Briefed'?'Start production':'Request changes';
 if(to==='Internal Review')return 'Send to internal QA';
 if(to==='Client Review')return 'Pass internal QA → Client QA';
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
 return job.launchState==='Launched'?'View live ads':'Confirm launch';
}
