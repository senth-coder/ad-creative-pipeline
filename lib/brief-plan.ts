import type { BriefField } from './templates';
export function briefCode(number:number) { return `GG-BR-${String(number).padStart(5,'0')}`; }
export function assetCodes(count:number) {
 if(!Number.isInteger(count)||count<1||count>26)throw new Error('Choose a whole number of assets between 1 and 26.');
 return Array.from({length:count},(_,i)=>String.fromCharCode(65+i));
}
// Flexible briefs keep the objective essential; detailed specifications can be supplied later.
export function flexibleFields(fields:BriefField[]):BriefField[] {return fields.map(f=>({...f,required:f.key==='objective'}));}
export function briefPlan(brief:Record<string,string>,fallback:string[]) {
 return brief.assetCount===undefined?fallback:assetCodes(Number(brief.assetCount));
}
