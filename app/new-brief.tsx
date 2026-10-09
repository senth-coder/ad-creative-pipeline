'use client';
import {useState} from 'react';
import {ArrowRight,Plus,X} from 'lucide-react';
import type {Job} from '@/lib/workflow';
import type {IntakeDraft} from '@/lib/operations';
import {sharedFields,typeFields,type BriefField} from '@/lib/templates';
import {assetCodes,briefCode,flexibleFields} from '@/lib/brief-plan';
import {BriefRuleReference} from './assurance-ui';
const serverMode=process.env.NEXT_PUBLIC_DATA_MODE==='server';
export function NewBrief({onClose,onCreate,nextNumber,clients,makers,motionDraft,templateConfig}:{onClose:()=>void;onCreate:(j:Job)=>Promise<void>;nextNumber:number;clients:string[];makers:string[];motionDraft:IntakeDraft|null;templateConfig:Record<string,BriefField[]>;ruleConfig:Record<string,string[]>}) {
 const [title,setTitle]=useState(motionDraft?.title||'');
 const [client,setClient]=useState(motionDraft?.client&&clients.includes(motionDraft.client)?motionDraft.client:clients[0]||'');
 const [campaign,setCampaign]=useState(motionDraft?.campaign||'');
 const [concept,setConcept]=useState(motionDraft?.concept||'');
 const [type,setType]=useState<'Static'|'Video'|''>(motionDraft?.creativeType?(['Static','Carousel'].includes(motionDraft.creativeType)?'Static':'Video'):'');
 const [quantity,setQuantity]=useState(motionDraft?.brief?.assetCount||'1');
 const [assignee,setAssignee]=useState('');const [due,setDue]=useState('');
 const [source,setSource]=useState<Job['source']>(motionDraft?.source||'Manual');
 const [brief,setBrief]=useState<Record<string,string>>(motionDraft?.brief||{});
 const [extras,setExtras]=useState<{id:string;label:string;value:string}[]>([]);
 const [submitting,setSubmitting]=useState(false);const [error,setError]=useState('');
 const fields=type?flexibleFields(templateConfig[type]||[...sharedFields,...typeFields[type]]):[];
 const count=Number(quantity);const validCount=Number.isInteger(count)&&count>=1&&count<=26;
 const codes=validCount?assetCodes(count):[];
 async function submit(e:React.FormEvent){e.preventDefault();if(submitting)return;if(!type){setError('Choose Static or Video.');return;}if(!validCount){setError('Choose 1–26 assets.');return;}
 const names=extras.map(f=>f.label.trim().toLowerCase());if(new Set(names).size!==names.length){setError('Give each custom field a different name.');return;}
 setSubmitting(true);setError('');try{await onCreate({id:crypto.randomUUID(),number:nextNumber,title,client,campaign:campaign.trim()||'General creative',concept:concept.trim()||title,type,status:'Briefed',assignee:assignee||'Unassigned',qa:'Unassigned',mediaBuyer:'Unassigned',due,variants:codes,reviewUrl:'',source,parentJobId:motionDraft?.parentJobId,updatedAt:new Date().toISOString(),brief:{...brief,assetCount:String(count),...Object.fromEntries(extras.map(f=>[`custom: ${f.label.trim()}`,f.value])),...(motionDraft?.eventId?{intakeEventId:motionDraft.eventId}:{})}});}catch(e){setError((e as Error).message);}finally{setSubmitting(false);}}
 return <div className="modal-backdrop" onMouseDown={onClose}><div className="create-modal" role="dialog" aria-modal="true" aria-label="New creative brief" onMouseDown={e=>e.stopPropagation()}><div className="drawer-top"><span>NEW CREATIVE BRIEF</span><button className="icon-btn" aria-label="Close brief" onClick={onClose}><X size={20}/></button></div><form onSubmit={submit}>
 <div className="modal-intro"><h2>What are we making?</h2><p>Choose a format and the exact number of final assets. Fields marked * are required.</p></div>
 {motionDraft?.eventId?<div className="inline-hint">Imported from {source}. Review and complete the same brief fields below.</div>:<div className="source-tabs"><button type="button" className={source==='Manual'?'chosen':''} onClick={()=>setSource('Manual')}>Manual brief</button><button type="button" className={source==='Motion'?'chosen':''} onClick={()=>setSource('Motion')}>Motion source</button></div>}
 {source==='Motion'&&<label className="full-field">Motion report / source link (optional)<input type="url" placeholder="https://projects.motionapp.com/…" value={brief.sourceUrl||''} onChange={e=>setBrief(p=>({...p,sourceUrl:e.target.value}))}/><p className="muted">Paste the report link and add the insight or creative direction below. Motion briefs use the same fields, asset counts and brief codes.</p></label>}
 <div className="field-grid"><label>Client *<select required value={client} onChange={e=>setClient(e.target.value)}><option value="">Select client</option>{clients.map(c=><option key={c}>{c}</option>)}</select></label><label>Creative format *<select required value={type} onChange={e=>setType(e.target.value as 'Static'|'Video')}><option value="">Choose Static or Video</option><option>Static</option><option>Video</option></select></label><label>Number of assets *<input required type="number" min="1" max="26" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/><small>1–26 final files. Count each size or creative variation as a separate asset.</small></label><label>Due date *<input required type="date" value={due} onChange={e=>setDue(e.target.value)}/></label></div>
 <label className="full-field">Brief title *<input required minLength={2} maxLength={160} placeholder="e.g. Three product benefit statics" value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <div className="field-grid"><label>Campaign (optional)<input minLength={2} placeholder="Defaults to General creative" value={campaign} onChange={e=>setCampaign(e.target.value)}/></label><label>Assign {type==='Video'?'Editor':'Designer'} (optional)<select value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Unassigned</option>{makers.map(m=><option key={m}>{m}</option>)}</select></label></div>
 <label className="full-field">Concept / direction (optional)<textarea rows={3} minLength={2} placeholder="Describe the idea, visual direction, or learnings from Motion. Defaults to the brief title." value={concept} onChange={e=>setConcept(e.target.value)}/></label>
 <div className="section-divider"/><h3 className="brief-heading">Creative instructions</h3><BriefRuleReference client={client}/>
 {!type&&<p className="muted">Choose Static or Video above to see the relevant instructions.</p>}
 {fields.map(field=><label className="full-field" key={field.key}>{field.label}{field.required?' *':' (optional)'}<textarea rows={field.key==='objective'?3:2} required={field.required} placeholder={field.placeholder} value={brief[field.key]||''} onChange={e=>setBrief(p=>({...p,[field.key]:e.target.value}))}/></label>)}
 <label className="full-field">Additional notes / asset breakdown (optional)<textarea rows={3} placeholder="e.g. A: product image, B: testimonial, C: offer. Add copy, script, references or constraints." value={brief.additionalNotes||''} onChange={e=>setBrief(p=>({...p,additionalNotes:e.target.value}))}/></label>
 {extras.map(f=><div key={f.id} className="brief-custom-field"><label className="full-field">Custom field name *<input required maxLength={80} value={f.label} onChange={e=>setExtras(rows=>rows.map(r=>r.id===f.id?{...r,label:e.target.value}:r))}/></label><label className="full-field">Details<textarea rows={3} value={f.value} onChange={e=>setExtras(rows=>rows.map(r=>r.id===f.id?{...r,value:e.target.value}:r))}/></label><button type="button" className="secondary-btn" onClick={()=>setExtras(rows=>rows.filter(r=>r.id!==f.id))}>Remove field</button></div>)}
 <button type="button" className="secondary-btn" onClick={()=>setExtras(rows=>[...rows,{id:crypto.randomUUID(),label:'',value:''}])}><Plus size={16}/> Add custom field</button>
 <div className="variant-summary"><div><strong>Production plan{type&&validCount?` · ${count} ${type.toLowerCase()} ${count===1?'asset':'assets'}`:''}</strong></div><small>Brief code: {serverMode?'assigned automatically when submitted (GG-BR-#####)':briefCode(nextNumber)}. The same code follows this brief through review, delivery and launch.</small>{type&&validCount?<><span>{codes.map(c=>`${type} ${c}`).join(' · ')}</span><small>Exactly {count} tracked outputs will be created. Each output gets the brief code plus its letter, for example GG-BR-00501-A. Revisions use v01, v02, etc.; they do not add to the asset count.</small></>:<small>Select a format and valid quantity to preview your output plan.</small>}</div>
 {error&&<p role="alert" className="inline-hint">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button type="submit" disabled={submitting} className="primary-btn">{submitting?'Creating…':'Create brief'} <ArrowRight size={16}/></button></div>
 </form></div></div>;
}
