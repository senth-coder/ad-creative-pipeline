import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/permissions';
import {motionStatus,cachedMotionReports} from '@/lib/motion-mcp';
export const dynamic='force-dynamic';
const date=(v:string)=>new Date(v).toLocaleString('en-CA',{timeZone:'America/Toronto'});
export default async function MotionConnection({searchParams}:{searchParams:Promise<{result?:string;workspace?:string;reason?:string}>}){
 const user=await currentUser();if(!user)redirect('/sign-in');if(user.role!=='ADMIN')return <main style={{padding:48}}>An administrator manages this connection.</main>;
 const status=await motionStatus();const {result,workspace,reason}=await searchParams;const workspaces=status.workspaceData?.workspaces||[];const selected=workspaces.find(w=>w.id===workspace);const reports=selected?await cachedMotionReports(selected.id):null;
 return <main style={{maxWidth:1100,margin:'0 auto',padding:'48px 28px',color:'#eee'}}>
 <a href="/">← Creative OS dashboard</a><p className="eyebrow" style={{marginTop:32}}>CREATIVE INTELLIGENCE</p><h1>Motion / Runneth</h1><p>Bring your Motion workspaces and saved reports into your creative planning workflow.</p>
 <section className="ops-card" style={{marginTop:24}}><h2>{status.checkedAt?'Connected to Motion':status.connected?'Motion authorized':'Connect Motion'}</h2>
 <p>{status.checkedAt?'Your account is connected. Choose a workspace below to load its saved reports.':status.connected?'Your authorization is saved. Load workspaces to finish setup.':'Sign in with the Motion account that holds your creative reports.'}</p>
 {result==='failed'&&<p role="alert">{reason||'This request could not finish. Your existing connection is preserved.'}</p>}
 {result==='test'&&<p role="status">Connection verified and workspace access refreshed.</p>}
 {result==='reports'&&<p role="status">Saved reports loaded from Motion.</p>}
 <form action="/api/integrations/motion" method="post" className="action-row">
 {status.connected&&<button className="primary-btn" name="action" value="test">Refresh workspaces</button>}
 <button className={status.connected?'secondary-btn':'primary-btn'} name="action" value="connect">{status.connected?'Reconnect':'Connect Motion'}</button>
 {status.connected&&<button className="secondary-btn" name="action" value="disconnect">Disconnect</button>}
 </form>{status.checkedAt&&<p>Last verified: {date(status.checkedAt)} · Toronto time</p>}
 </section>
 {status.connected&&<section className="ops-card" style={{marginTop:20}}><h2>Your Motion workspaces</h2>{workspaces.length?<form action="/api/integrations/motion" method="post" className="ops-form"><label>Workspace<select name="workspaceId" required defaultValue={selected?.id||''}><option value="" disabled>Choose a workspace</option>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><button className="primary-btn" name="action" value="reports">Load saved reports</button></form>:<p>Use Refresh workspaces to retrieve the workspaces available to your account.</p>}</section>}
 {selected&&<section className="ops-card" style={{marginTop:20}}><h2>{selected.name} · Saved reports</h2>{reports?<><p>Updated {date(reports.checkedAt)} · Toronto time</p>{reports.reports.length?reports.reports.map(r=><article key={r.id} style={{borderTop:'1px solid #363143',padding:'20px 0'}}><h3>{r.name}</h3>{r.type&&<p>{r.type}</p>}{r.url?<a href={r.url} target="_blank" rel="noreferrer" className="secondary-btn">Open report in Motion ↗</a>:<p>Motion does not provide a direct link for this report.</p>}</article>):<p>No saved reports were returned for this workspace.</p>}</>:<p>Load this workspace’s saved reports to continue.</p>}</section>}
 <section className="ops-card" style={{marginTop:20}}><h2>How this feeds the pipeline</h2><p>Review the source report, identify what to test, then create a brief from the dashboard. Saved reports are fetched on demand. Automatic performance-to-variant matching is not enabled.</p><a className="secondary-btn" href="/">Go to creative pipeline</a></section>
 <details style={{marginTop:24}}><summary>Connection details</summary><p>{status.endpoint}</p><p>Account and document reading, Runneth reading and MCP access, with access renewal. No document-write or Runneth-work scopes requested.</p><p>{status.tools.length} tools verified.</p>{status.workspaceData&&!workspaces.length&&<pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(status.workspaceData.source,null,2)}</pre>}{reports&&!reports.reports.length&&<pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(reports.source,null,2)}</pre>}</details>
 </main>;
}
