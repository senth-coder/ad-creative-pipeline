'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';

/** Common dismissal, keyboard containment and focus restoration for workspace overlays. */
export function Dialog({children,onClose,label,protectChanges=false}:{children:ReactNode;onClose:()=>void;label:string;protectChanges?:boolean}){
 const root=useRef<HTMLDivElement>(null);
 const close=useRef(onClose);close.current=onClose;
 const dirty=useRef(false);
 const [confirming,setConfirming]=useState(false);
 function dismiss(){if(protectChanges&&dirty.current)setConfirming(true);else close.current();}
 const dismissRef=useRef(dismiss);dismissRef.current=dismiss;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const panel=root.current!;
  const siblings=Array.from(panel.parentElement?.children||[]).filter((el):el is HTMLElement=>el instanceof HTMLElement&&el!==panel);
  const previousInert=siblings.map(el=>el.inert);siblings.forEach(el=>{el.inert=true});
  const focusable=()=>Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
  (focusable()[0]||panel).focus();
  function key(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismissRef.current();}if(e.key==='Tab'){const items=focusable(),first=items[0],last=items.at(-1);if(!first){e.preventDefault();panel.focus();}else if(e.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){e.preventDefault();first.focus();}}}
  document.addEventListener('keydown',key,true);
  return ()=>{document.removeEventListener('keydown',key,true);document.body.style.overflow=overflow;siblings.forEach((el,i)=>{el.inert=previousInert[i]});if(previous?.isConnected)previous.focus();};
 },[]);
 return <div ref={root} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="modal-backdrop" onChangeCapture={()=>{dirty.current=true}} onMouseDown={e=>{if(e.target===e.currentTarget)dismiss()}} onClickCapture={e=>{const button=(e.target as HTMLElement).closest('button');if(button&&(button.textContent?.trim()==='Cancel'||button.getAttribute('aria-label')?.startsWith('Close'))){e.preventDefault();e.stopPropagation();dismiss()}}}>
 <div style={{display:confirming?'none':'contents'}}>{children}</div>
 {confirming&&<section className="discard-dialog" aria-label="Unsaved changes"><h2>Discard unsaved changes?</h2><p>Your changes have not been saved. Keep editing to finish them.</p><div className="action-row"><button autoFocus className="primary-btn" onClick={()=>setConfirming(false)}>Keep editing</button><button className="secondary-btn" onClick={()=>close.current()}>Discard changes</button></div></section>}
 </div>;
}
