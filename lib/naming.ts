export type NamingInput = { clientCode:string; jobNumber:number; version:number; variant:string; mediaFormat:string; jobType:string; product:string; openEntry:string; creativeStyle:string; persona:string; funnelStage:string; baseJob?:string; date?:Date };
const token = (value:string) => value.trim().toUpperCase().replace(/[^A-Z0-9-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
const coreJob = (i:NamingInput) => [i.mediaFormat,i.jobType,i.product,i.openEntry,i.creativeStyle,i.persona,i.funnelStage].map(token).join('_');
const coreUpload = (i:NamingInput) => [i.mediaFormat,i.jobType,i.product,i.openEntry,i.creativeStyle,i.persona,i.baseJob || ''].map(token).filter(Boolean).join('_');
export function adSetFolder(version:number) { if (!Number.isInteger(version) || version < 1) throw new Error('Invalid version'); return `ADSET ${version}`; }
export function variantCode(i:NamingInput) { if (!/^[A-Z]$/.test(i.variant.toUpperCase())) throw new Error('Variant must be one letter'); return `V${i.version}${i.variant.toUpperCase()}`; }
export function jobName(i:NamingInput) { return `${token(i.clientCode)}${i.jobNumber}${variantCode(i)}_${coreJob(i)}`; }
export function sourceAssetName(i:NamingInput) { return `${i.jobNumber}${variantCode(i)}_${coreUpload(i)}`; }
export function uploadName(i:NamingInput, level:'adset'|'ad') {
  const date = i.date || new Date(); const stamp = `${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}.${date.getFullYear()}`;
  return `${stamp}-${i.jobNumber}V${i.version}${level === 'ad' ? i.variant.toUpperCase() : ''}_${coreUpload(i)}`;
}
