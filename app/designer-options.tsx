import {designerOptions} from '@/lib/designer-roster';
export function DesignerOptions({makers,current='',unassigned=''}:{makers:string[];current?:string;unassigned?:string}){
 const options=designerOptions(makers);
 return <><option value={unassigned}>Unassigned</option>{current&&current!==unassigned&&!options.some(o=>o.value===current)&&<option value={current}>{current} · current assignment</option>}{options.map(o=><option key={o.label} value={o.value||`unconfigured:${o.label}`} disabled={!o.available}>{o.label}{o.available?'':' — account setup needed'}</option>)}</>;
}
