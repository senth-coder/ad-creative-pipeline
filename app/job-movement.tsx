'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,ArrowLeft} from 'lucide-react';
import {statuses,type Job,type Status} from '@/lib/workflow';
import {operationsFor,reviewReadiness} from '@/lib/operations';
import {movementLabel,nextOwner,stageGuide,stageTitle} from '@/lib/pipeline';

export function JobMovement({onLaunch,job,allowed,onAdvance,onNavigate}:{onLaunch:()=>void;job:Job;allowed:Status[];onAdvance:(job:Job,next:Status)=>Promise<string|null>;onNavigate:(tab:string)=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const guide=stageGuide[job.status],ops=operationsFor(job),forward=allowed.find(s=>statuses.indexOf(s)>statuses.indexOf(job.status));
 const requirement=forward?(reviewReadiness(job,forward)||(forward==='Approved'&&!ops.approvalEvidenceUrl?'Save the external client approval reference in Checks & feedback first.':null)):null;
 useEffect(()=>setMessage(''),[job.status,job.updatedAt]);
 async function move(next:Status){if(busy)return;if(next==='In Production'&&job.status!=='Briefed'&&(!ops.revisionReason||!ops.feedbackUrl||!ops.revisionDue)){setMessage('Add and save the revision reason, feedback link and return date below, then select Request changes.');onNavigate('QA & blockers');return;}setBusy(true);try{setMessage(await onAdvance(job,next)||'')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 return <section className="job-movement" aria-label="Job movement">
  <ol className="job-stage-track">{statuses.map((s,i)=><li key={s} aria-current={s===job.status?'step':undefined}><span>{i+1}</span><small>{stageTitle(s)}</small></li>)}</ol>
  {['Internal Review','Client Review'].includes(job.status)&&<div className={`review-gate-label ${job.status==='Internal Review'?'internal':'client'}`}>{job.status==='Internal Review'?'REVIEW GATE 1 · INTERNAL QA':'REVIEW GATE 2 · CLIENT QA'}</div>}<div className="job-next-heading"><span>STEP {guide.step} OF 6</span><strong>Next owner: {nextOwner(job)}</strong></div>
  <h3>{job.status==='Delivered'?'Delivery complete':job.status==='Approved'?(job.deliveryError?'Delivery needs attention':'Automatic delivery in progress'):`Next: ${forward?movementLabel(job.status,forward):guide.owner+' action'}`}</h3>
  <p>{guide.exit}</p>
  {(ops.blockerReason||job.deliveryError)&&job.status!=='Delivered'&&<p className="pipeline-blocker">Blocked: {ops.blockerReason||job.deliveryError}</p>}
  {requirement&&<p className="movement-requirement">Before moving: {requirement}</p>}
  <div className="movement-prep"><span>Prepare this handoff</span>{(job.status==='In Production'?['Review','Assets & results','QA & blockers']:[guide.tab]).map(t=><button key={t} onClick={()=>onNavigate(t)}>{t==='Overview'?'Assignment & brief':t==='Review'?'Review link':t==='QA & blockers'?'Checks & feedback':t==='Assets & results'?'Assets & QA':t} ↗</button>)}<button onClick={()=>onNavigate('History')}>Movement history ↗</button></div>
  {job.status==='Delivered'&&<div className="launch-state"><strong>{job.launchState||'Awaiting launch'} · {job.launchedVariants||0}/{job.variants.length} variants live</strong><p>The assigned media buyer confirms launch separately. Delivery alone does not mark an ad live.</p><button className="primary-btn" onClick={onLaunch}>Open launch checklist</button></div>}<div className="action-row">{allowed.includes('In Production')&&job.status!=='Briefed'&&<button disabled={busy} className="secondary-btn" onClick={()=>void move('In Production')}><ArrowLeft size={15}/> Request changes</button>}{forward&&<button disabled={busy||Boolean(requirement)} className="primary-btn" onClick={()=>void move(forward)}>{busy?'Moving…':movementLabel(job.status,forward)}<ArrowRight size={15}/></button>}</div>
  {!allowed.length&&!['Approved','Delivered'].includes(job.status)&&<p className="muted">{guide.owner} is responsible for moving this job.</p>}
  {message&&<p role="alert" className="movement-error">{message}</p>}
 </section>;
}
