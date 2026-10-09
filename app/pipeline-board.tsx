'use client';
import {briefCode} from '@/lib/brief-plan';
import {ClientScheduleProgress} from './client-schedule';
import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowLeft,Search,AlertCircle,CheckCircle2} from 'lucide-react';
import {statuses,type Job,type Status} from '@/lib/workflow';
import {operationsFor,type PlanClient} from '@/lib/operations';
import {nextAction,nextOwner,stageGuide,stageTitle} from '@/lib/pipeline';

const date=(value:string)=>new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/Toronto'});
export function PipelineBoard({plans,onPlan,jobs,clients,today,ready,canCreate,onOpen,onCreate}: {plans:PlanClient[];onPlan:()=>void;jobs:Job[];clients:string[];today:string;ready:boolean;canCreate:boolean;onOpen:(job:Job,tab?:string)=>void;onCreate:()=>void}){
 const [query,setQuery]=useState(''),[client,setClient]=useState('All clients'),[focus,setFocus]=useState('All jobs'),[phase,setPhase]=useState('All stages');
 const choices=useMemo(()=>Array.from(new Set([...clients,...jobs.map(j=>j.client)])).sort(),[clients,jobs]);
 const scoped=jobs.filter(j=>(client==='All clients'||j.client===client)&&`${briefCode(j.number)} ${j.number} ${j.title} ${j.client} ${j.campaign} ${j.concept} ${j.assignee} ${j.qa}`.toLowerCase().includes(query.toLowerCase()));
 const blocked=(j:Job)=>j.status!=='Delivered'&&Boolean(operationsFor(j).blockerReason||j.deliveryError);
 const matches=(j:Job,f:string)=>f==='All jobs'||(f==='Needs attention'&&j.status!=='Delivered'&&(j.due<=today||blocked(j)||j.assignee==='Unassigned'))||(f==='Awaiting launch'&&j.status==='Delivered'&&j.launchState!=='Launched')||(f==='Priority clients'&&['High','Urgent'].includes(j.clientPriority||''))||(f==='Blocked'&&blocked(j))||(f==='Unassigned'&&j.assignee==='Unassigned'&&j.status!=='Delivered')||(f==='Delivered'&&j.status==='Delivered');
 const shown=scoped.filter(j=>matches(j,focus)).sort((a,b)=>({Normal:0,High:1,Urgent:2}[b.clientPriority||'Normal']-({Normal:0,High:1,Urgent:2}[a.clientPriority||'Normal']))||Number(blocked(b))-Number(blocked(a))||a.due.localeCompare(b.due)||a.number-b.number);
 const columns=statuses.filter(s=>phase==='All stages'||stageGuide[s].phase===phase);
 return <section className="pipeline-workspace" aria-label="Creative job pipeline">
  <div className="pipeline-explainer"><div><strong>One card = one job</strong><span>Variants and revisions stay inside the job. Move forward with the handoff buttons in the job.</span></div><div><ArrowLeft size={16}/><span><strong>Changes required?</strong> Return to In Production with a feedback link and a due date.</span></div></div>
  <div className="pipeline-phases" aria-label="Focus on a phase">{['All stages','Create','Review','Deliver'].map((p,i)=><button key={p} aria-pressed={phase===p} onClick={()=>setPhase(p)}><span>{i===0?'Overview':`0${i}`}</span><strong>{p}</strong><small>{i===0?'Entire workflow':p==='Create'?'Brief → production':p==='Review'?'Internal QA → Client QA': 'Approved → delivered'}</small><b>{scoped.filter(j=>p==='All stages'||stageGuide[j.status].phase===p).length}</b></button>)}</div>
  <div className="pipeline-toolbar"><label><Search size={16}/><input aria-label="Search pipeline jobs" placeholder="Find a job, client or maker…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter pipeline by client" value={client} onChange={e=>setClient(e.target.value)}><option>All clients</option>{choices.map(c=><option key={c}>{c}</option>)}</select>{canCreate&&<button className="secondary-btn" onClick={onPlan}>Client priority & cadence</button>}<span>{shown.filter(j=>columns.includes(j.status)).length} of {jobs.length} jobs</span></div>
  <div className="pipeline-filters" aria-label="Filter jobs">{['All jobs','Needs attention','Priority clients','Blocked','Unassigned','Delivered','Awaiting launch'].map(f=><button key={f} aria-pressed={focus===f} onClick={()=>{setFocus(f);if(f==='Delivered'||f==='Awaiting launch')setPhase('Deliver')}}>{f}<span>{scoped.filter(j=>matches(j,f)).length}</span></button>)}{(query||client!=='All clients'||focus!=='All jobs'||phase!=='All stages')&&<button className="clear-filters" onClick={()=>{setQuery('');setClient('All clients');setFocus('All jobs');setPhase('All stages')}}>Clear filters</button>}</div>
  {client!=='All clients'&&<ClientScheduleProgress value={plans.find(p=>p.name===client)?.plan?.deliverySchedule||jobs.find(j=>j.client===client)?.deliverySchedule} jobs={jobs} client={client} compact/>}<div className="pipeline-direction"><span>01 → 06 · Jobs move left to right</span><span>Approved → Delivered is automatic · Scroll sideways for later stages</span></div>
  {!ready?<p role="status" className="pipeline-loading">Loading your workspace…</p>:<div className={`pipeline-columns ${columns.length===2?'phase-focused':''}`} tabIndex={0} aria-label="Pipeline stages; scroll horizontally to see more">
   {columns.map(status=>{const guide=stageGuide[status],items=shown.filter(j=>j.status===status);return <section className="pipeline-column" key={status} aria-label={`${status}: ${items.length} jobs`}>
    <header className="pipeline-column-header"><div><span className={`pipeline-step step-${guide.step}`}>{guide.step}</span><h2>{stageTitle(status)}</h2><b>{items.length}</b></div><p>{guide.description}</p><small>{guide.owner}{status==='Approved'?' · Automatic':''}</small></header>
    <div className="pipeline-job-list">{items.map(job=>{const ops=operationsFor(job),isBlocked=blocked(job),overdue=job.status!=='Delivered'&&job.due<today;return <button className={`pipeline-card ${isBlocked?'has-blocker':''}`} key={job.id} onClick={()=>onOpen(job)} aria-label={`Open job ${job.number}: ${job.title}. ${nextAction(job)}`}>
     <div className="pipeline-card-meta"><span>{briefCode(job.number)} · {job.type}</span><span>{job.variants.length} assets</span></div><small className="pipeline-client">{job.client}</small>{job.clientPriority&&job.clientPriority!=='Normal'&&<span className={`client-priority-label priority-${job.clientPriority.toLowerCase()}`}>{job.clientPriority} priority client</span>}<h3>{job.title}</h3><p className="pipeline-campaign">{job.campaign}{job.concept?` / ${job.concept}`:''}</p>
     {isBlocked&&<p className="pipeline-blocker"><AlertCircle size={14}/>{ops.blockerReason||job.deliveryError}</p>}{ops.revisionReason&&job.status==='In Production'&&<p className="pipeline-revision">Revision requested{ops.revisionDue?` · return ${date(ops.revisionDue)}`:''}</p>}
     <dl><div><dt>Next owner</dt><dd>{nextOwner(job)}</dd></div><div><dt>Maker</dt><dd>{job.assignee}</dd></div><div><dt>{job.status==='Delivered'?'Delivered':'Due'}</dt><dd className={overdue?'is-late':''}>{job.status==='Delivered'?(job.deliveredAt?date(job.deliveredAt):'Confirmed'):job.due===today?'Today':`${date(job.due)}${overdue?' · overdue':''}`}</dd></div></dl>
     {ops.priority!=='Normal'&&job.status!=='Delivered'&&<span className="pipeline-priority">{ops.priority} priority</span>}
     {job.status==='Delivered'&&<p className="launch-state"><strong>{job.launchState||'Awaiting launch'}</strong><span>{job.launchedVariants||0} / {job.variants.length} variants live</span></p>}<div className="pipeline-card-action"><span>{nextAction(job)}</span>{job.status==='Delivered'?<CheckCircle2 size={16}/>:<ArrowRight size={16}/>}</div>
    </button>})}
    {!items.length&&<div className="pipeline-empty"><span>{focus==='All jobs'&&!query&&client==='All clients'?'Nothing here yet':'No matching jobs'}</span><p>{guide.exit}</p>{status==='Briefed'&&canCreate&&focus==='All jobs'&&<button onClick={onCreate}>Create a brief <ArrowRight size={14}/></button>}</div>}
    </div><footer className="pipeline-stage-footer">{status==='Delivered'?'Complete · media buying can begin':`Next: ${status==='Approved'?'Delivered after Drive + Slack':stageTitle(statuses[guide.step])}`}</footer>
   </section>})}
  </div>}
 </section>;
}

type HistoryEvent={id:string;label:string;from?:string;to?:string;actor:string;at:string;reason?:string};
export function JobHistory({job,server}:{job:Job;server:boolean}){
 const [events,setEvents]=useState<HistoryEvent[]|null>(null),[message,setMessage]=useState('');
 useHistory(job.id,server,setEvents,setMessage);
 if(!server)return <p className="muted">History is available in the connected workspace. Preview changes are stored only in this browser.</p>;
 return <section className="job-history"><h3>Activity for Job #{job.number}</h3><p className="muted">Most recent first. Each move records who acted and when.</p>{message&&<p role="alert" className="ops-warning">{message}</p>}{!events&&!message&&<p>Loading activity…</p>}{events?.length===0&&<p>No activity recorded yet.</p>}<ol>{events?.map(e=><li key={e.id}><strong>{e.from&&e.to?`${e.from} → ${e.to}`:e.label}</strong><span>{e.actor} · {new Date(e.at).toLocaleString()}</span>{e.reason&&<p>{e.reason}</p>}</li>)}</ol></section>;
}
function useHistory(id:string,server:boolean,setEvents:(e:HistoryEvent[])=>void,setMessage:(m:string)=>void){useEffect(()=>{if(!server)return;const controller=new AbortController();fetch(`/api/jobs/${id}/activity`,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load history');return d}).then(d=>setEvents(d.events)).catch(e=>{if(e.name!=='AbortError')setMessage(e.message)});return ()=>controller.abort()},[id,server,setEvents,setMessage]);}
